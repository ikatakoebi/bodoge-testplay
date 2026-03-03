import { useGameStore } from './gameStore';
import { useUIStore } from './uiStore';
import { useSyncStore, registerSyncHandlers } from './syncStore';
import type { CardDefinition } from '../types';

// フル状態のスナップショット（同期対象）
function getGameSnapshot() {
  const s = useGameStore.getState();
  return {
    cardInstances: s.cardInstances,
    cardStacks: s.cardStacks,
    areas: s.areas,
    counters: s.counters,
    images: s.images,
    memos: s.memos,
    tokens: s.tokens,
    cardDefinitions: s.cardDefinitions,
    cardTemplates: s.cardTemplates,
    counterDefs: s.counterDefs,
    setupText: s.setupText,
    playerCount: s.playerCount,
    players: s.players,
    currentPlayerId: s.currentPlayerId,
  };
}

// 差分検出用の前回状態
let prevSnapshot = '';

// 同期ブリッジの初期化（アプリ起動時に1回呼ぶ）
export function initSyncBridge() {
  // リモートからのアクション/フル状態のハンドラを登録
  registerSyncHandlers(
    // アクションハンドラ: リモートからフル状態を受信して適用
    () => {
      // アクションベース同期は使わず、フル状態同期のみ使用
    },
    // フル状態ハンドラ
    (state) => {
      const gs = state as ReturnType<typeof getGameSnapshot>;
      useGameStore.setState({
        cardInstances: gs.cardInstances || {},
        cardStacks: gs.cardStacks || {},
        areas: gs.areas || [],
        counters: gs.counters || {},
        images: gs.images || {},
        memos: gs.memos || {},
        tokens: gs.tokens || {},
        ...(gs.cardDefinitions?.length ? {
          cardDefinitions: gs.cardDefinitions,
          cardDefinitionMap: new Map(gs.cardDefinitions.map((d: CardDefinition) => [d.id, d])),
        } : {}),
        ...(gs.cardTemplates && Object.keys(gs.cardTemplates).length ? { cardTemplates: gs.cardTemplates } : {}),
        ...(gs.counterDefs?.length ? { counterDefs: gs.counterDefs } : {}),
        ...(gs.setupText ? { setupText: gs.setupText } : {}),
        ...(gs.playerCount ? { playerCount: gs.playerCount } : {}),
        ...(gs.players?.length ? { players: gs.players } : {}),
        ...(gs.currentPlayerId ? { currentPlayerId: gs.currentPlayerId } : {}),
      });
    }
  );

  // ローカル変更をリモートにブロードキャスト＆localStorageに保存（debounce付き）
  let syncTimer: ReturnType<typeof setTimeout> | null = null;

  useGameStore.subscribe(() => {
    const { isRemoteAction, roomId, isSpectator } = useSyncStore.getState();
    if (isRemoteAction || isSpectator) return;

    // debounce: 高頻度な更新（ドラッグ等）をまとめる
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const snapshot = JSON.stringify(getGameSnapshot());
      if (snapshot !== prevSnapshot) {
        prevSnapshot = snapshot;
        if (roomId) {
          // オンライン: サーバーにブロードキャスト
          useSyncStore.getState().sendFullState(JSON.parse(snapshot));
        } else {
          // ソロ: localStorageに保存
          localStorage.setItem('bodogeGameState', snapshot);
        }
      }
    }, 100);
  });

  // ビューポート（zoom/pan）をlocalStorageに保存（debounce付き、リモート同期不要）
  let viewTimer: ReturnType<typeof setTimeout> | null = null;
  useUIStore.subscribe((s) => {
    if (viewTimer) clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
      localStorage.setItem(VIEWPORT_KEY, JSON.stringify({ zoom: s.zoom, panX: s.panX, panY: s.panY }));
    }, 300);
  });
}

const SOLO_STATE_KEY = 'bodogeGameState';
const VIEWPORT_KEY = 'bodogeViewport';

/** ソロモードの保存済み状態を復元 */
export function restoreSoloState() {
  try {
    const raw = localStorage.getItem(SOLO_STATE_KEY);
    if (!raw) return false;
    const gs = JSON.parse(raw) as ReturnType<typeof getGameSnapshot>;
    // 空の状態なら復元しない
    const hasContent = Object.keys(gs.cardInstances || {}).length > 0
      || gs.areas?.length > 0
      || Object.keys(gs.counters || {}).length > 0
      || (gs.cardDefinitions?.length ?? 0) > 0;
    if (!hasContent) return false;
    useGameStore.setState({
      cardInstances: gs.cardInstances || {},
      cardStacks: gs.cardStacks || {},
      areas: gs.areas || [],
      counters: gs.counters || {},
      images: gs.images || {},
      memos: gs.memos || {},
      tokens: gs.tokens || {},
      ...(gs.cardDefinitions?.length ? {
        cardDefinitions: gs.cardDefinitions,
        cardDefinitionMap: new Map(gs.cardDefinitions.map((d: CardDefinition) => [d.id, d])),
      } : {}),
      ...(gs.cardTemplates && Object.keys(gs.cardTemplates).length ? { cardTemplates: gs.cardTemplates } : {}),
      ...(gs.counterDefs?.length ? { counterDefs: gs.counterDefs } : {}),
      ...(gs.setupText ? { setupText: gs.setupText } : {}),
      ...(gs.playerCount ? { playerCount: gs.playerCount } : {}),
      ...(gs.players?.length ? { players: gs.players } : {}),
      ...(gs.currentPlayerId ? { currentPlayerId: gs.currentPlayerId } : {}),
    });
    // ビューポート復元
    try {
      const vp = localStorage.getItem(VIEWPORT_KEY);
      if (vp) {
        const { zoom, panX, panY } = JSON.parse(vp);
        if (typeof zoom === 'number') useUIStore.setState({ zoom, panX, panY });
      }
    } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

/** ソロモードの保存済み状態をクリア */
export function clearSoloState() {
  localStorage.removeItem(SOLO_STATE_KEY);
  localStorage.removeItem(VIEWPORT_KEY);
}
