import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';
import multer from 'multer';
import { applyPatch } from 'fast-json-patch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');
const serverStartedAt = Date.now();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const app = express();
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ルーム管理
interface PlayerEntry {
  name: string;
  color: string;
  playerId: string; // ゲーム内ID (p0, p1, ...)
}

interface RoomState {
  roomId: string;
  hostId: string;
  players: Map<string, PlayerEntry>; // socketId → PlayerEntry
  nextPlayerIndex: number; // 次に割り当てるプレイヤー番号
  gameState: unknown | null;
  emptyTimer: ReturnType<typeof setTimeout> | null; // 空室削除タイマー
}

const rooms = new Map<string, RoomState>();

// === イベントログ ===
interface EventEntry {
  timestamp: number;
  type: 'connect' | 'disconnect' | 'room:create' | 'room:join' | 'room:leave' | 'room:delete';
  detail: string;
}
const MAX_EVENT_LOG = 200;
const eventLog: EventEntry[] = [];

function pushEvent(type: EventEntry['type'], detail: string) {
  const entry: EventEntry = { timestamp: Date.now(), type, detail };
  eventLog.push(entry);
  if (eventLog.length > MAX_EVENT_LOG) eventLog.shift();
  // リアルタイムで管理画面に通知
  io.to('admin-room').emit('admin:event', entry);
}

// === Google Sheets レスポンスキャッシュ (TTL: 5分) ===
interface SheetCacheEntry {
  data: Record<string, string | null>;
  timestamp: number;
}
const SHEET_CACHE_TTL = 5 * 60 * 1000; // 5分
const sheetCache = new Map<string, SheetCacheEntry>();

function generateRoomId(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function assignPlayerId(room: RoomState): string {
  const playerId = `p${room.nextPlayerIndex}`;
  room.nextPlayerIndex++;
  return playerId;
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);
  pushEvent('connect', socket.id);
  let currentRoom: string | null = null;

  // 管理画面購読
  socket.on('admin:subscribe', () => {
    socket.join('admin-room');
  });

  // 観戦モード（プレイヤー一覧に表示されない）
  let isSpectator = false;
  socket.on('room:spectate', (data: { roomId: string }, callback) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      callback({ ok: false, error: 'ルームが見つかりません' });
      return;
    }
    socket.join(data.roomId);
    currentRoom = data.roomId;
    isSpectator = true;
    console.log(`[room:spectate] ${socket.id} → ${data.roomId}`);
    callback({ ok: true, roomId: data.roomId });
    // 既存の状態を送信
    if (room.gameState) {
      socket.emit('sync:fullState', room.gameState);
    }
  });

  // ルーム作成
  socket.on('room:create', (data: { playerName: string; playerColor: string }, callback) => {
    const roomId = generateRoomId();
    const playerId = 'p0';
    const room: RoomState = {
      roomId,
      hostId: socket.id,
      players: new Map([[socket.id, { name: data.playerName, color: data.playerColor, playerId }]]),
      nextPlayerIndex: 1,
      gameState: null,
      emptyTimer: null,
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    currentRoom = roomId;

    console.log(`[room:create] ${roomId} by ${data.playerName} (${playerId})`);
    pushEvent('room:create', `${roomId} by ${data.playerName}`);
    callback({ ok: true, roomId, isHost: true, playerId });
    io.to(roomId).emit('room:players', getPlayerList(room));
  });

  // ルーム参加
  socket.on('room:join', (data: { roomId: string; playerName: string; playerColor: string }, callback) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      callback({ ok: false, error: 'ルームが見つかりません' });
      return;
    }
    // 空室タイマーをキャンセル（リロード後の再参加）
    if (room.emptyTimer) {
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;
    }
    const playerId = assignPlayerId(room);
    room.players.set(socket.id, { name: data.playerName, color: data.playerColor, playerId });
    socket.join(data.roomId);
    currentRoom = data.roomId;

    console.log(`[room:join] ${data.playerName} (${playerId}) → ${data.roomId}`);
    pushEvent('room:join', `${data.playerName} → ${data.roomId}`);
    callback({ ok: true, roomId: data.roomId, isHost: false, playerId });
    io.to(data.roomId).emit('room:players', getPlayerList(room));

    // 既存の状態を送信
    if (room.gameState) {
      socket.emit('sync:fullState', room.gameState);
    }
  });

  // ゲームアクション同期（アクションベース）
  socket.on('sync:action', (action: { type: string; payload: unknown }) => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit('sync:action', action);
  });

  // フル状態同期（セットアップ/リセット時）
  socket.on('sync:fullState', (state: unknown) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room) {
      room.gameState = state;
    }
    socket.to(currentRoom).emit('sync:fullState', state);
  });

  // 差分同期
  socket.on('sync:patch', (patch: unknown[]) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (room && room.gameState) {
      try {
        applyPatch(room.gameState as any, patch as any);
      } catch (e) {
        console.error('[sync:patch] apply error', e);
      }
    }
    socket.to(currentRoom).emit('sync:patch', patch);
  });

  // 切断
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    pushEvent('disconnect', socket.id);
    if (currentRoom && !isSpectator) {
      const room = rooms.get(currentRoom);
      if (room) {
        const leaving = room.players.get(socket.id);
        if (leaving) {
          pushEvent('room:leave', `${leaving.name} left ${currentRoom}`);
        }
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          // リロード対応: 15秒間ルームを保持してから削除
          const roomId = currentRoom;
          room.emptyTimer = setTimeout(() => {
            const r = rooms.get(roomId);
            if (r && r.players.size === 0) {
              rooms.delete(roomId);
              console.log(`[room:delete] ${roomId} (empty, grace period expired)`);
              pushEvent('room:delete', roomId);
            }
          }, 15000);
          console.log(`[room:empty] ${currentRoom} (waiting 15s for reconnect)`);
        } else {
          // ホストが抜けたら次の人をホストに
          if (room.hostId === socket.id) {
            room.hostId = room.players.keys().next().value!;
          }
          io.to(currentRoom).emit('room:players', getPlayerList(room));
        }
      }
    }
  });
});

function getPlayerList(room: RoomState) {
  return {
    players: Array.from(room.players.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      color: info.color,
      playerId: info.playerId,
      isHost: id === room.hostId,
    })),
    hostId: room.hostId,
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

// === 管理ダッシュボード ===

function getAdminStats() {
  let totalPlayers = 0;
  for (const room of rooms.values()) {
    totalPlayers += room.players.size;
  }
  const mem = process.memoryUsage();
  return {
    uptime: Date.now() - serverStartedAt,
    startedAt: serverStartedAt,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    connections: io.engine.clientsCount,
    rooms: rooms.size,
    totalPlayers,
    sheetCacheEntries: sheetCache.size,
  };
}

function getAdminRooms() {
  return Array.from(rooms.values()).map((room) => {
    const stateSize = room.gameState ? JSON.stringify(room.gameState).length : 0;
    const players = Array.from(room.players.entries()).map(([sid, p]) => ({
      socketId: sid,
      name: p.name,
      color: p.color,
      playerId: p.playerId,
      isHost: sid === room.hostId,
    }));
    return {
      roomId: room.roomId,
      playerCount: room.players.size,
      players,
      stateSize,
      hasEmptyTimer: room.emptyTimer !== null,
    };
  });
}

// 管理画面の認証ミドルウェア
function adminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!ADMIN_TOKEN) { next(); return; } // トークン未設定なら認証なし（ローカル開発用）
  const token = req.query.token as string || req.headers['x-admin-token'] as string;
  if (token === ADMIN_TOKEN) { next(); return; }
  res.status(401).json({ error: '認証が必要です。?token=xxx を付けてアクセスしてください' });
}

app.get('/api/admin/stats', adminAuth, (_req, res) => {
  res.json(getAdminStats());
});

app.get('/api/admin/rooms', adminAuth, (_req, res) => {
  res.json(getAdminRooms());
});

app.get('/api/admin/events', adminAuth, (_req, res) => {
  res.json(eventLog);
});

app.get('/admin', adminAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 管理画面へ定期的にstats配信（5秒ごと）
setInterval(() => {
  const sockets = io.sockets.adapter.rooms.get('admin-room');
  if (sockets && sockets.size > 0) {
    io.to('admin-room').emit('admin:stats', {
      stats: getAdminStats(),
      rooms: getAdminRooms(),
    });
  }
}, 5000);

// Google Sheetsからゲームデータを取得するプロキシ（メモリキャッシュ付き）
// シートを「リンクを知っている全員が閲覧可」にする必要あり
app.get('/api/sheets', async (req, res) => {
  const id = req.query.id as string;
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    res.status(400).json({ error: 'Invalid spreadsheet ID' });
    return;
  }

  // キャッシュチェック
  const cached = sheetCache.get(id);
  if (cached && Date.now() - cached.timestamp < SHEET_CACHE_TTL) {
    console.log(`[sheets] キャッシュヒット: ${id}`);
    res.json(cached.data);
    return;
  }

  const sheetNames = ['cards', 'areas', 'counters', 'templates', 'setup'];

  try {
    // gviz/tq APIはsheet=NAMEが正しく動作する（公開スプレッドシートのみ）
    const results: Record<string, string | null> = {};
    await Promise.all(
      sheetNames.map(async (sheet) => {
        try {
          const url = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&headers=1`;
          const r = await fetch(url, {
            headers: { 'User-Agent': 'BodogeTestPlay/1.0' },
            redirect: 'follow',
          });
          // Googleがログインページに飛ばしてきたらHTML → シート非公開
          const text = await r.text();
          if (!r.ok || text.trimStart().startsWith('<!')) {
            results[sheet] = null;
          } else {
            results[sheet] = text;
          }
        } catch {
          results[sheet] = null;
        }
      })
    );

    // キャッシュに保存
    sheetCache.set(id, { data: results, timestamp: Date.now() });
    console.log(`[sheets] キャッシュ保存: ${id}`);

    res.json(results);
  } catch (err) {
    console.error('[sheets] fetch error', err);
    res.status(500).json({ error: 'Failed to fetch sheets' });
  }
});

// 手動キャッシュリフレッシュ用エンドポイント
app.post('/api/sheets/refresh', (req, res) => {
  const id = req.query.id as string;
  if (id) {
    // 特定のスプレッドシートのキャッシュを無効化
    sheetCache.delete(id);
    console.log(`[sheets] キャッシュ無効化: ${id}`);
    res.json({ ok: true, message: `Cache cleared for ${id}` });
  } else {
    // 全キャッシュをクリア
    sheetCache.clear();
    console.log('[sheets] 全キャッシュクリア');
    res.json({ ok: true, message: 'All sheet cache cleared' });
  }
});

// === 画像アップロード ===
const imageStorage = multer.memoryStorage();
const uploadMiddleware = multer({ storage: imageStorage, limits: { fileSize: 10 * 1024 * 1024 } });
const imageCache = new Map<string, { buffer: Buffer; contentType: string }>();

app.post('/api/upload', uploadMiddleware.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '画像ファイルが必要です' });
    return;
  }
  const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex').slice(0, 16);
  const ext = req.file.mimetype.split('/')[1] || 'png';
  const filename = `${hash}.${ext}`;
  imageCache.set(filename, { buffer: req.file.buffer, contentType: req.file.mimetype });
  console.log(`[upload] ${filename} (${(req.file.size / 1024).toFixed(1)}KB)`);
  res.json({ url: `/api/images/${filename}` });
});

app.get('/api/images/:filename', (req, res) => {
  const entry = imageCache.get(req.params.filename);
  if (!entry) {
    res.status(404).json({ error: '画像が見つかりません' });
    return;
  }
  res.setHeader('Content-Type', entry.contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.end(entry.buffer);
});

// 本番ビルドの静的ファイル配信（dist/が存在するとき）
if (existsSync(distPath)) {
  // 日本語ファイル名対応: デコード済みパスでファイルを探す
  app.use(express.static(distPath, { fallthrough: true }));
  // APIや静的ファイルにマッチしないリクエストのみ index.html を返す（SPA用）
  app.use((req, res, next) => {
    // 静的ファイル拡張子の場合は404（index.htmlを返さない）
    if (/\.\w+$/.test(req.path)) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 3210;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Bodoge TestPlay Server running on http://0.0.0.0:${PORT}`);
  if (existsSync(distPath)) {
    console.log(`  → フロントエンドも配信中: http://localhost:${PORT}`);
  } else {
    console.log(`  → フロントエンド開発: http://localhost:5173`);
  }
});
