import { compare, applyPatch, deepClone } from 'fast-json-patch';
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

// 差分検出用の前回状態（オブジェクト形式）
let prevSnapshotObj: ReturnType<typeof getGameSnapshot> | null = null;

// 同期ブリッジの初期化（アプリ起動時に1回呼ぶ）
export function initSyncBridge() {
  // リモートからのアクション/フル状態/パッチのハンドラを登録
  registerSyncHandlers(
    // アクションハンドラ: リモートからフル状態を受信して適用
    () => {
      // アクションベース同期は使わず、フル状態同期のみ使用
    },
    // フル状態ハンドラ
    (state) => {
      const gs = state as ReturnType<typeof getGameSnapshot>;
      prevSnapshotObj = deepClone(gs) as typeof gs;
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
    },
    // パッチハンドラ
    (patch) => {
      if (prevSnapshotObj) {
        // パッチのパスを解析して変更された個別アイテムを特定
        // 例: "/cardInstances/card1/x" → key="cardInstances", itemId="card1"
        const ops = patch as { path: string }[];
        const changedItems = new Map<string, Set<string>>(); // key → Set<itemId>
        const changedTopOnly = new Set<string>(); // アイテムIDなしのトップレベル変更
        for (const op of ops) {
          const parts = op.path.split('/').filter(Boolean); // ["cardInstances", "card1", "x"]
          const key = parts[0];
          if (parts.length >= 2) {
            if (!changedItems.has(key)) changedItems.set(key, new Set());
            changedItems.get(key)!.add(parts[1]);
          } else {
            changedTopOnly.add(key);
          }
        }

        applyPatch(prevSnapshotObj, patch as any);
        const gs = prevSnapshotObj as ReturnType<typeof getGameSnapshot>;
        const update: Record<string, unknown> = {};

        // 個別アイテムが変更されたフィールド → 変更されたアイテムだけ新しい参照を作る
        for (const [key, itemIds] of changedItems) {
          const val = (gs as any)[key];
          if (Array.isArray(val)) {
            // 配列: 変更されたインデックスの要素をコピー
            const newArr = [...val];
            for (const idx of itemIds) {
              const i = Number(idx);
              if (!isNaN(i) && newArr[i] && typeof newArr[i] === 'object') {
                newArr[i] = { ...newArr[i] };
              }
            }
            update[key] = newArr;
          } else if (val && typeof val === 'object') {
            // Record: 変更されたキーの値をコピー
            const newObj = { ...val };
            for (const itemId of itemIds) {
              if (newObj[itemId] && typeof newObj[itemId] === 'object') {
                newObj[itemId] = { ...newObj[itemId] };
              }
            }
            update[key] = newObj;
          } else {
            update[key] = val;
          }
        }

        // トップレベルのみ変更されたフィールド
        for (const key of changedTopOnly) {
          const val = (gs as any)[key];
          if (Array.isArray(val)) {
            update[key] = [...val];
          } else if (val && typeof val === 'object') {
            update[key] = { ...val };
          } else {
            update[key] = val;
          }
        }

        if ((changedItems.has('cardDefinitions') || changedTopOnly.has('cardDefinitions'))
            && gs.cardDefinitions?.length) {
          update.cardDefinitionMap = new Map(gs.cardDefinitions.map((d: CardDefinition) => [d.id, d]));
        }
        useGameStore.setState(update);
      }
    }
  );

  // ローカル変更をリモートにブロードキャスト＆localStorageに保存（throttle式）
  const SYNC_INTERVAL = 50; // 50ms間隔 = 20fps
  let lastSyncTime = 0;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;

  function flushSync() {
    const { roomId } = useSyncStore.getState();
    const current = getGameSnapshot();
    if (prevSnapshotObj === null) {
      prevSnapshotObj = deepClone(current) as typeof current;
      if (roomId) {
        useSyncStore.getState().sendFullState(current);
      } else {
        localStorage.setItem('bodogeGameState', JSON.stringify(current));
      }
      return;
    }

    const patch = compare(prevSnapshotObj, current);
    if (patch.length > 0) {
      prevSnapshotObj = deepClone(current) as typeof current;
      if (roomId) {
        const patchStr = JSON.stringify(patch);
        const fullStr = JSON.stringify(current);
        if (patchStr.length > fullStr.length * 0.8) {
          useSyncStore.getState().sendFullState(current);
        } else {
          useSyncStore.getState().sendPatch(patch);
        }
      } else {
        localStorage.setItem('bodogeGameState', JSON.stringify(current));
      }
    }
  }

  useGameStore.subscribe(() => {
    const { isRemoteAction, isSpectator } = useSyncStore.getState();
    if (isRemoteAction || isSpectator) return;

    const now = Date.now();
    // throttle: 前回送信からINTERVAL経過していれば即送信
    if (now - lastSyncTime >= SYNC_INTERVAL) {
      lastSyncTime = now;
      if (trailingTimer) { clearTimeout(trailingTimer); trailingTimer = null; }
      flushSync();
    } else {
      // 最後の変更を漏らさないためのtrailing送信
      if (trailingTimer) clearTimeout(trailingTimer);
      trailingTimer = setTimeout(() => {
        lastSyncTime = Date.now();
        trailingTimer = null;
        flushSync();
      }, SYNC_INTERVAL);
    }
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
