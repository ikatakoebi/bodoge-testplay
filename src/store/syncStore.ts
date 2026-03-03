import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useUIStore } from './uiStore';

const SESSION_KEY = 'bodogeSession';

function saveSession(roomId: string, playerName: string, playerColor: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, playerName, playerColor }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function loadSession(): { roomId: string; playerName: string; playerColor: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  playerId: string; // ゲーム内ID (p0, p1, ...)
  isHost: boolean;
}

// リモートアクション/フル状態/パッチのハンドラ（外部から登録）
type ActionHandler = (action: { type: string; payload: unknown }) => void;
type FullStateHandler = (state: Record<string, unknown>) => void;
type PatchHandler = (patch: unknown[]) => void;

let onRemoteAction: ActionHandler | null = null;
let onRemoteFullState: FullStateHandler | null = null;
let onRemotePatch: PatchHandler | null = null;

export function registerSyncHandlers(
  actionHandler: ActionHandler,
  fullStateHandler: FullStateHandler,
  patchHandler?: PatchHandler
) {
  onRemoteAction = actionHandler;
  onRemoteFullState = fullStateHandler;
  onRemotePatch = patchHandler || null;
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
  isSpectator: boolean; // 観戦モード（プレイヤー一覧に表示されない）

  setPlayerInfo: (name: string, color: string) => void;
  connect: () => void;
  disconnect: () => void;
  createRoom: () => Promise<{ roomId: string; playerId: string } | null>;
  joinRoom: (roomId: string, silent?: boolean) => Promise<{ playerId: string } | null>;
  spectateRoom: (roomId: string) => Promise<boolean>;
  sendAction: (type: string, payload: unknown) => void;
  sendFullState: (state: unknown) => void;
  sendPatch: (patch: unknown[]) => void;
  autoRejoin: () => Promise<{ playerId: string } | null>;
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
  isSpectator: false,

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

    socket.on('sync:patch', (patch: unknown[]) => {
      set({ isRemoteAction: true });
      onRemotePatch?.(patch);
      set({ isRemoteAction: false });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, roomId: null, isHost: false, myPlayerId: null, players: [], isSpectator: false });
      clearSession();
    }
  },

  createRoom: () => {
    return new Promise((resolve) => {
      const { socket, playerName, playerColor } = get();
      if (!socket) { resolve(null); return; }
      socket.emit('room:create', { playerName, playerColor }, (res: { ok: boolean; roomId?: string; isHost?: boolean; playerId?: string }) => {
        if (res.ok && res.roomId && res.playerId) {
          set({ roomId: res.roomId, isHost: res.isHost ?? true, myPlayerId: res.playerId });
          saveSession(res.roomId, playerName, playerColor);
          resolve({ roomId: res.roomId, playerId: res.playerId });
        } else {
          resolve(null);
        }
      });
    });
  },

  joinRoom: (roomId, silent = false) => {
    return new Promise((resolve) => {
      const { socket, playerName, playerColor } = get();
      if (!socket) { resolve(null); return; }
      socket.emit('room:join', { roomId, playerName, playerColor }, (res: { ok: boolean; error?: string; playerId?: string }) => {
        if (res.ok && res.playerId) {
          set({ roomId, isHost: false, myPlayerId: res.playerId });
          saveSession(roomId, playerName, playerColor);
          resolve({ playerId: res.playerId });
        } else {
          clearSession();
          if (!silent) useUIStore.getState().addToast(res.error || '参加に失敗しました', 'error');
          resolve(null);
        }
      });
    });
  },

  spectateRoom: (roomId) => {
    return new Promise((resolve) => {
      const { socket } = get();
      if (!socket) { resolve(false); return; }
      socket.emit('room:spectate', { roomId }, (res: { ok: boolean; error?: string }) => {
        if (res.ok) {
          set({ roomId, isHost: false, isSpectator: true, myPlayerId: null });
          resolve(true);
        } else {
          useUIStore.getState().addToast(res.error || '観戦に失敗しました', 'error');
          resolve(false);
        }
      });
    });
  },

  sendAction: (type, payload) => {
    const { socket, roomId, isRemoteAction, isSpectator } = get();
    if (!socket || !roomId || isRemoteAction || isSpectator) return;
    socket.emit('sync:action', { type, payload });
  },

  sendFullState: (state) => {
    const { socket, roomId, isSpectator } = get();
    if (!socket || !roomId || isSpectator) return;
    socket.emit('sync:fullState', state);
  },

  sendPatch: (patch) => {
    const { socket, roomId, isRemoteAction, isSpectator } = get();
    if (!socket || !roomId || isRemoteAction || isSpectator) return;
    socket.emit('sync:patch', patch);
  },

  autoRejoin: async () => {
    const session = loadSession();
    if (!session) return null;
    const { roomId, playerName, playerColor } = session;
    get().setPlayerInfo(playerName, playerColor);
    get().connect();
    // ソケット接続を待つ
    await new Promise((r) => setTimeout(r, 600));
    const result = await get().joinRoom(roomId, true); // silent=true でalertなし
    if (!result) {
      clearSession();
    }
    return result;
  },
}));
