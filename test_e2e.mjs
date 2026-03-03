/**
 * E2Eテスト: マルチプレイ (デルタ同期 + 画像アップロード)
 * Usage: node test_e2e.mjs
 */
import { io } from 'socket.io-client';
import http from 'http';
import fs from 'fs';

const SERVER = 'http://localhost:3210';
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ ${msg}`);
    failed++;
  }
}

function connectSocket() {
  return new Promise((resolve) => {
    const s = io(SERVER, { transports: ['websocket'] });
    s.on('connect', () => resolve(s));
  });
}

function waitForEvent(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// --- Test 1: ルーム作成＆参加 ---
async function testRoomCreateJoin() {
  console.log('\n=== Test 1: ルーム作成＆参加 ===');
  const host = await connectSocket();

  const createResult = await new Promise((resolve) => {
    host.emit('room:create', { playerName: 'HostPlayer', playerColor: '#ff0000' }, resolve);
  });
  assert(createResult.ok, 'ルーム作成成功');
  assert(createResult.playerId === 'p0', 'ホストはp0');
  assert(createResult.isHost === true, 'ホストフラグ');

  const roomId = createResult.roomId;
  console.log(`  roomId: ${roomId}`);

  const guest = await connectSocket();
  const joinResult = await new Promise((resolve) => {
    guest.emit('room:join', { roomId, playerName: 'GuestPlayer', playerColor: '#0000ff' }, resolve);
  });
  assert(joinResult.ok, 'ルーム参加成功');
  assert(joinResult.playerId === 'p1', 'ゲストはp1');
  assert(joinResult.isHost === false, 'ゲストはホストではない');

  return { host, guest, roomId };
}

// --- Test 2: フル状態同期 ---
async function testFullStateSync(host, guest) {
  console.log('\n=== Test 2: フル状態同期 ===');

  const fullState = {
    cardInstances: { card1: { id: 'card1', x: 100, y: 200, faceUp: true } },
    cardStacks: {},
    areas: [{ id: 'area1', label: 'テストエリア', x: 0, y: 0, width: 300, height: 200, color: '#ccc' }],
    counters: { c1: { id: 'c1', label: 'スコア', value: 0, x: 50, y: 50 } },
    images: {},
    memos: {},
    tokens: {},
    cardDefinitions: [],
    cardTemplates: {},
    counterDefs: [],
    setupText: '',
    playerCount: 2,
    players: [{ name: 'HostPlayer', color: '#ff0000' }, { name: 'GuestPlayer', color: '#0000ff' }],
    currentPlayerId: 'p0',
  };

  const guestReceive = waitForEvent(guest, 'sync:fullState');
  host.emit('sync:fullState', fullState);
  const received = await guestReceive;

  assert(received.cardInstances?.card1?.id === 'card1', 'カードインスタンスが同期された');
  assert(received.areas?.length === 1, 'エリアが同期された');
  assert(received.counters?.c1?.label === 'スコア', 'カウンターが同期された');
  assert(received.playerCount === 2, 'プレイヤー数が同期された');

  return fullState;
}

// --- Test 3: デルタ同期 (sync:patch) ---
async function testDeltaSync(host, guest) {
  console.log('\n=== Test 3: デルタ同期 (sync:patch) ===');

  // JSON Patchフォーマットで差分を送信
  const patch = [
    { op: 'replace', path: '/cardInstances/card1/x', value: 500 },
    { op: 'replace', path: '/cardInstances/card1/y', value: 600 },
    { op: 'replace', path: '/counters/c1/value', value: 42 },
  ];

  const guestReceive = waitForEvent(guest, 'sync:patch');
  host.emit('sync:patch', patch);
  const received = await guestReceive;

  assert(Array.isArray(received), 'パッチが配列で受信された');
  assert(received.length === 3, 'パッチ操作が3つ');
  assert(received[0].op === 'replace', 'replace操作');
  assert(received[0].path === '/cardInstances/card1/x', 'パスが正しい');
  assert(received[0].value === 500, '値が正しい');
  assert(received[2].value === 42, 'カウンター値が正しい');
}

// --- Test 4: サーバー側のgameState更新確認 ---
async function testServerStateUpdate(roomId) {
  console.log('\n=== Test 4: サーバー側gameState更新確認 ===');

  const adminRooms = await fetch(`${SERVER}/api/admin/rooms`).then(r => r.json());
  const room = adminRooms.find(r => r.roomId === roomId);
  assert(room !== undefined, 'ルームがadmin APIに存在');
  assert(room.playerCount === 2, 'プレイヤー数2');
  assert(room.stateSize > 0, 'ゲーム状態が保存されている');
}

// --- Test 5: 画像アップロード ---
async function testImageUpload() {
  console.log('\n=== Test 5: 画像アップロード ===');

  // テスト用の小さなPNG画像を生成 (1x1 pixel red PNG)
  const pngData = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );

  // multipart/form-data でアップロード
  const boundary = '----TestBoundary' + Date.now();
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
    pngData,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch(`${SERVER}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  const uploadJson = await uploadRes.json();

  assert(uploadRes.status === 200, 'アップロード成功 (200)');
  assert(uploadJson.url?.startsWith('/api/images/'), 'URLが返された');

  // アップロードした画像を取得
  const imageRes = await fetch(`${SERVER}${uploadJson.url}`);
  assert(imageRes.status === 200, '画像取得成功 (200)');
  assert(imageRes.headers.get('content-type') === 'image/png', 'Content-Typeがimage/png');

  const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
  assert(imageBuffer.length === pngData.length, '画像サイズが一致');

  // 存在しない画像
  const notFound = await fetch(`${SERVER}/api/images/nonexistent.png`);
  assert(notFound.status === 404, '存在しない画像は404');
}

// --- Test 6: 観戦モード ---
async function testSpectatorMode(roomId) {
  console.log('\n=== Test 6: 観戦モード ===');

  const spectator = await connectSocket();

  const spectateResult = await new Promise((resolve) => {
    spectator.emit('room:spectate', { roomId }, resolve);
  });
  assert(spectateResult.ok, '観戦参加成功');

  // 観戦者にはフル状態が送信される
  // (gameStateがあるので sync:fullState が来るはず)
  const fullState = await waitForEvent(spectator, 'sync:fullState', 3000).catch(() => null);
  assert(fullState !== null, '観戦者にフル状態が送信された');

  // 観戦者はプレイヤー一覧に含まれない
  const adminRooms = await fetch(`${SERVER}/api/admin/rooms`).then(r => r.json());
  const room = adminRooms.find(r => r.roomId === roomId);
  assert(room.playerCount === 2, '観戦者はプレイヤー数に含まれない (2のまま)');

  spectator.disconnect();
}

// --- Test 7: 切断＆ホスト移譲 ---
async function testDisconnectAndHostTransfer(host, guest, roomId) {
  console.log('\n=== Test 7: 切断＆ホスト移譲 ===');

  const playersUpdate = waitForEvent(guest, 'room:players');
  host.disconnect();
  const players = await playersUpdate;

  assert(players.players.length === 1, 'プレイヤーが1人になった');
  assert(players.players[0].name === 'GuestPlayer', '残りはGuestPlayer');
  assert(players.players[0].isHost === true, 'GuestPlayerがホストに昇格');

  guest.disconnect();
}

// --- Test 8: ヘルスチェック & Admin API ---
async function testHealthAndAdmin() {
  console.log('\n=== Test 8: ヘルスチェック & Admin API ===');

  const health = await fetch(`${SERVER}/health`).then(r => r.json());
  assert(health.ok === true, 'ヘルスチェックOK');

  const stats = await fetch(`${SERVER}/api/admin/stats`).then(r => r.json());
  assert(typeof stats.uptime === 'number', 'アップタイムが数値');
  assert(typeof stats.memory?.heapUsed === 'number', 'ヒープ使用量が存在');
  assert(typeof stats.connections === 'number', '接続数が存在');

  const events = await fetch(`${SERVER}/api/admin/events`).then(r => r.json());
  assert(Array.isArray(events), 'イベントログが配列');
  assert(events.length > 0, 'イベントが記録されている');
}

// --- メイン ---
async function main() {
  console.log('=== Bodoge TestPlay E2E テスト ===');
  console.log(`Server: ${SERVER}`);

  try {
    // ヘルスチェック
    const health = await fetch(`${SERVER}/health`).then(r => r.json());
    if (!health.ok) throw new Error('Server not ready');
  } catch {
    console.error('サーバーに接続できません。起動してから実行してください。');
    process.exit(1);
  }

  try {
    const { host, guest, roomId } = await testRoomCreateJoin();
    await testFullStateSync(host, guest);
    await testDeltaSync(host, guest);
    await testServerStateUpdate(roomId);
    await testImageUpload();
    await testSpectatorMode(roomId);
    await testDisconnectAndHostTransfer(host, guest, roomId);
    await testHealthAndAdmin();
  } catch (err) {
    console.error('\n致命的エラー:', err);
    failed++;
  }

  console.log(`\n=== 結果: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
