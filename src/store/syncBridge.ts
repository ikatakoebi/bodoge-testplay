import { useGameStore } from './gameStore';
import { useSyncStore, registerSyncHandlers } from './syncStore';

// フル状態のスナップショット（同期対象のみ）
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
      });
    }
  );

  // ローカル変更をリモートにブロードキャスト（debounce付き）
  let syncTimer: ReturnType<typeof setTimeout> | null = null;

  useGameStore.subscribe(() => {
    const { isRemoteAction, roomId } = useSyncStore.getState();
    if (isRemoteAction || !roomId) return;

    // debounce: 高頻度な更新（ドラッグ等）をまとめる
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const snapshot = JSON.stringify(getGameSnapshot());
      if (snapshot !== prevSnapshot) {
        prevSnapshot = snapshot;
        useSyncStore.getState().sendFullState(JSON.parse(snapshot));
      }
    }, 100);
  });
}
