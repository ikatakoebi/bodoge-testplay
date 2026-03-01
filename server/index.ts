import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

const app = express();
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
}

const rooms = new Map<string, RoomState>();

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
  let currentRoom: string | null = null;

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
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    currentRoom = roomId;

    console.log(`[room:create] ${roomId} by ${data.playerName} (${playerId})`);
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
    const playerId = assignPlayerId(room);
    room.players.set(socket.id, { name: data.playerName, color: data.playerColor, playerId });
    socket.join(data.roomId);
    currentRoom = data.roomId;

    console.log(`[room:join] ${data.playerName} (${playerId}) → ${data.roomId}`);
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

  // 切断
  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.players.delete(socket.id);
        if (room.players.size === 0) {
          rooms.delete(currentRoom);
          console.log(`[room:delete] ${currentRoom} (empty)`);
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

// Google Sheetsからゲームデータを取得するプロキシ
// シートを「リンクを知っている全員が閲覧可」にする必要あり
app.get('/api/sheets', async (req, res) => {
  const id = req.query.id as string;
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    res.status(400).json({ error: 'Invalid spreadsheet ID' });
    return;
  }

  const sheetNames = ['cards', 'areas', 'counters', 'templates'];
  const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&sheet=`;

  try {
    const results: Record<string, string | null> = {};
    await Promise.all(
      sheetNames.map(async (sheet) => {
        try {
          const r = await fetch(base + encodeURIComponent(sheet), {
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
    res.json(results);
  } catch (err) {
    console.error('[sheets] fetch error', err);
    res.status(500).json({ error: 'Failed to fetch sheets' });
  }
});

// 本番ビルドの静的ファイル配信（dist/が存在するとき）
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
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
