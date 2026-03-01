import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  playerId: string; // ゲーム内ID (p0, p1, ...)
  isHost: boolean;
}

// リモートアクション/フル状態のハンドラ（外部から登録）
type ActionHandler = (action: { type: string; payload: unknown }) => void;
type FullStateHandler = (state: Record<string, unknown>) => void;

let onRemoteAction: ActionHandler | null = null;
let onRemoteFullState: FullStateHandler | null = null;

export function registerSyncHandlers(actionHandler: ActionHandler, fullStateHandler: FullStateHandler) {
  onRemoteAction = actionHandler;
  onRemoteFullState = fullStateHandler;
}

interface SyncState {
  socket: Socket | null;
  connected: boolean;
  roomId: string | null;
  isHost: boolean;
  myPlayerId: string | null; // サーバーから割り当てられたゲーム内ID
  playerName: string;
  playerColor: string;
  players: PlayerInfo[];
  isRemoteAction: boolean;

  setPlayerInfo: (name: string, color: string) => void;
  connect: () => void;
  disconnect: () => void;
  createRoom: () => Promise<{ roomId: string; playerId: string } | null>;
  joinRoom: (roomId: string) => Promise<{ playerId: string } | null>;
  sendAction: (type: string, payload: unknown) => void;
  sendFullState: (state: unknown) => void;
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

export const useSyncStore = create<SyncState>((set, get) => ({
  socket: null,
  connected: false,
  roomId: null,
  isHost: false,
  myPlayerId: null,
  playerName: `Player${Math.floor(Math.random() * 900) + 100}`,
  playerColor: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
  players: [],
  isRemoteAction: false,

  setPlayerInfo: (name, color) => set({ playerName: name, playerColor: color }),

  connect: () => {
    const existing = get().socket;
    if (existing?.connected) return;

    // 開発時はlocalhost:3210、本番(Expressから配信)は同一オリジン
    const serverUrl = import.meta.env.VITE_SERVER_URL as string
      || (import.meta.env.DEV ? 'http://localhost:3210' : window.location.origin);

    const socket = io(serverUrl, {
      transports: ['websocket'],
    });

    socket.on('connect', () => set({ connected: true }));
    socket.on('disconnect', () => set({ connected: false }));

    socket.on('room:players', (data: { players: PlayerInfo[] }) => {
      set({ players: data.players });
    });

    socket.on('sync:action', (action: { type: string; payload: unknown }) => {
      set({ isRemoteAction: true });
      onRemoteAction?.(action);
      set({ isRemoteAction: false });
    });

    socket.on('sync:fullState', (state: Record<string, unknown>) => {
      set({ isRemoteAction: true });
      onRemoteFullState?.(state);
      set({ isRemoteAction: false });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, roomId: null, isHost: false, myPlayerId: null, players: [] });
    }
  },

  createRoom: () => {
    return new Promise((resolve) => {
      const { socket, playerName, playerColor } = get();
      if (!socket) { resolve(null); return; }
      socket.emit('room:create', { playerName, playerColor }, (res: { ok: boolean; roomId?: string; isHost?: boolean; playerId?: string }) => {
        if (res.ok && res.roomId && res.playerId) {
          set({ roomId: res.roomId, isHost: res.isHost ?? true, myPlayerId: res.playerId });
          resolve({ roomId: res.roomId, playerId: res.playerId });
        } else {
          resolve(null);
        }
      });
    });
  },

  joinRoom: (roomId) => {
    return new Promise((resolve) => {
      const { socket, playerName, playerColor } = get();
      if (!socket) { resolve(null); return; }
      socket.emit('room:join', { roomId, playerName, playerColor }, (res: { ok: boolean; error?: string; playerId?: string }) => {
        if (res.ok && res.playerId) {
          set({ roomId, isHost: false, myPlayerId: res.playerId });
          resolve({ playerId: res.playerId });
        } else {
          alert(res.error || '参加に失敗しました');
          resolve(null);
        }
      });
    });
  },

  sendAction: (type, payload) => {
    const { socket, roomId, isRemoteAction } = get();
    if (!socket || !roomId || isRemoteAction) return;
    socket.emit('sync:action', { type, payload });
  },

  sendFullState: (state) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit('sync:fullState', state);
  },
}));
