import { create } from 'zustand';
import type { CardDefinition, CardInstance, CardStack, Area, Counter, ImageObject, CardTemplate, LogEntry, Memo, DiceResult, Token, Player } from '../types';
import type { CounterDef } from '../utils/counterCsv';
import { DEFAULT_TEMPLATE, getCardSize, resolveTemplate } from '../utils/cardTemplate';
import { useUIStore } from './uiStore';

let nextZIndex = 1;
export function getNextZIndex(): number {
  return nextZIndex++;
}

let instanceCounter = 0;
function generateInstanceId(): string {
  return `card_${++instanceCounter}_${Date.now()}`;
}

let stackCounter = 0;
function generateStackId(): string {
  return `stack_${++stackCounter}_${Date.now()}`;
}

interface Snapshot {
  cardInstances: Record<string, CardInstance>;
  cardStacks: Record<string, CardStack>;
  counters: Record<string, Counter>;
  memos: Record<string, Memo>;
  images: Record<string, ImageObject>;
  tokens: Record<string, Token>;
}

const MAX_UNDO = 50;
let undoStack: Snapshot[] = [];
let redoStack: Snapshot[] = [];

function takeSnapshot(state: GameState): Snapshot {
  return {
    cardInstances: { ...state.cardInstances },
    cardStacks: { ...state.cardStacks },
    counters: { ...state.counters },
    memos: { ...state.memos },
    images: { ...state.images },
    tokens: { ...state.tokens },
  };
}

function saveUndo(state: GameState) {
  undoStack.push(takeSnapshot(state));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
}

interface GameState {
  // マスターデータ
  cardDefinitions: CardDefinition[];
  cardTemplates: Record<string, CardTemplate>;
  counterDefs: CounterDef[];

  // プレイヤー
  players: Player[];
  currentPlayerId: string;

  // フィールド上のインスタンス
  cardInstances: Record<string, CardInstance>;
  cardStacks: Record<string, CardStack>;
  areas: Area[];
  counters: Record<string, Counter>;
  images: Record<string, ImageObject>;
  memos: Record<string, Memo>;
  tokens: Record<string, Token>;
  diceResults: DiceResult[];
  rulesText: string;

  // ログ
  logs: LogEntry[];

  // アクション
  setPlayers: (players: Player[]) => void;
  setCurrentPlayer: (playerId: string) => void;
  setCardDefinitions: (defs: CardDefinition[]) => void;
  setCardTemplates: (templates: Record<string, CardTemplate>) => void;
  setCardTemplate: (name: string, template: CardTemplate) => void;
  addCardInstances: (defs: CardDefinition[]) => void;
  moveCard: (instanceId: string, x: number, y: number) => void;
  moveCardsTo: (positions: Array<{ id: string; x: number; y: number }>) => void;
  bringToFront: (instanceId: string) => void;
  flipCard: (instanceId: string, visibility: CardInstance['visibility'], ownerId: string | null) => void;
  flipCards: (ids: string[], visibility: CardInstance['visibility'], ownerId: string | null) => void;
  toggleLockCard: (instanceId: string) => void;
  rotateCard: (instanceId: string, delta: number) => void;
  rotateCards: (ids: string[], delta: number) => void;
  removeCards: (ids: string[]) => void;
  setAreas: (areas: Area[]) => void;
  addArea: (area: Area) => void;
  removeArea: (areaId: string) => void;
  updateArea: (areaId: string, updates: Partial<Pick<Area, 'x' | 'y' | 'width' | 'height'>>) => void;
  updateAreaProps: (areaId: string, props: Partial<Pick<Area, 'name' | 'visibility' | 'bgColor' | 'perPlayer'>>) => void;
  toggleLockArea: (areaId: string) => void;

  // スタック
  createStack: (cardIds: string[], x: number, y: number) => string;
  addToStack: (stackId: string, cardInstanceId: string) => void;
  drawFromStack: (stackId: string, count: number) => CardInstance[];
  shuffleStack: (stackId: string) => void;
  unstackAll: (stackId: string) => void;
  unstackAllOpen: (stackId: string) => void;
  peekStack: (stackId: string) => void;
  unpeekStack: (stackId: string) => void;
  moveStack: (stackId: string, x: number, y: number) => void;
  bringStackToFront: (stackId: string) => void;

  // スタック結合
  mergeStacks: (targetStackId: string, sourceStackId: string) => void;

  // カウンター
  addCounter: (name: string, x: number, y: number) => void;
  updateCounter: (counterId: string, value: number) => void;
  renameCounter: (counterId: string, name: string) => void;
  moveCounter: (counterId: string, x: number, y: number) => void;
  removeCounter: (counterId: string) => void;
  duplicateCounter: (counterId: string) => void;
  toggleLockCounter: (counterId: string) => void;

  // 画像
  addImage: (url: string, x: number, y: number, width: number, height: number) => void;
  moveImage: (imageId: string, x: number, y: number) => void;
  resizeImage: (imageId: string, width: number, height: number) => void;
  removeImage: (imageId: string) => void;
  toggleLockImage: (imageId: string) => void;

  // メモ
  addMemo: (x: number, y: number) => void;
  moveMemo: (memoId: string, x: number, y: number) => void;
  resizeMemo: (memoId: string, width: number, height: number) => void;
  updateMemoText: (memoId: string, text: string) => void;
  updateMemoColor: (memoId: string, color: string) => void;
  removeMemo: (memoId: string) => void;
  toggleLockMemo: (memoId: string) => void;

  // トークン
  addToken: (label: string, shape: Token['shape'], color: string, x: number, y: number) => void;
  moveToken: (tokenId: string, x: number, y: number) => void;
  removeToken: (tokenId: string) => void;
  toggleLockToken: (tokenId: string) => void;
  duplicateToken: (tokenId: string) => void;

  // カウンター定義
  setCounterDefs: (defs: CounterDef[]) => void;

  // ルール
  setRulesText: (text: string) => void;

  // セットアップテキスト
  setupText: string;
  setSetupText: (text: string) => void;

  // 所有権譲渡
  transferOwnership: (instanceId: string, newOwnerId: string) => void;

  // ダイス
  rollDice: (count: number, faces: number) => DiceResult;

  // CSVホットリロード用
  removeCardsByDefinitionIds: (defIds: string[]) => void;
  removeExcessCards: (definitionId: string, count: number) => void;

  // ログ
  addLog: (message: string) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  saveSnapshot: () => void;

  // リセット
  clearField: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  cardDefinitions: [],
  cardTemplates: { default: DEFAULT_TEMPLATE },
  counterDefs: [],
  players: [{ playerId: 'p0', name: 'P1', color: '#e74c3c' }],
  currentPlayerId: 'p0',
  cardInstances: {},
  cardStacks: {},
  areas: [],
  counters: {},
  images: {},
  memos: {},
  tokens: {},
  diceResults: [],
  rulesText: '',
  logs: [],

  setPlayers: (players) => set({ players }),
  setCurrentPlayer: (playerId) => set({ currentPlayerId: playerId }),
  setCardDefinitions: (defs) => set({ cardDefinitions: defs }),
  setCardTemplates: (templates) => set({ cardTemplates: templates }),
  setCardTemplate: (name, template) => set((state) => ({
    cardTemplates: { ...state.cardTemplates, [name]: template },
  })),

  addCardInstances: (defs) => {
    const templates = get().cardTemplates;
    const instances: Record<string, CardInstance> = {};
    const cellSize = useUIStore.getState().cellSize;

    // テンプレートごとにグループ化してレイアウト
    const groups = new Map<string, CardDefinition[]>();
    for (const def of defs) {
      const tName = (def.template as string) || 'default';
      if (!groups.has(tName)) groups.set(tName, []);
      groups.get(tName)!.push(def);
    }

    let globalIdx = 0;
    for (const [tName, groupDefs] of groups) {
      const template = resolveTemplate(templates, tName);
      const size = getCardSize(template);
      const colStep = Math.ceil((size.width + 8) / cellSize) * cellSize;
      const rowStep = Math.ceil((size.height + 8) / cellSize) * cellSize;
      const startX = cellSize;
      const startY = cellSize;

      groupDefs.forEach((def) => {
        const id = generateInstanceId();
        instances[id] = {
          instanceId: id,
          definitionId: def.id,
          x: startX + (globalIdx % 10) * colStep,
          y: startY + Math.floor(globalIdx / 10) * rowStep,
          zIndex: getNextZIndex(),
          face: 'down',
          visibility: 'hidden',
          ownerId: null,
          stackId: null,
          locked: false,
          rotation: 0,
        };
        globalIdx++;
      });
    }

    set((state) => ({
      cardInstances: { ...state.cardInstances, ...instances },
    }));
  },

  moveCard: (instanceId, x, y) =>
    set((state) => ({
      cardInstances: {
        ...state.cardInstances,
        [instanceId]: { ...state.cardInstances[instanceId], x, y },
      },
    })),

  moveCardsTo: (positions) =>
    set((state) => {
      const updatedCards = { ...state.cardInstances };
      for (const { id, x, y } of positions) {
        if (updatedCards[id]) {
          updatedCards[id] = { ...updatedCards[id], x, y };
        }
      }
      return { cardInstances: updatedCards };
    }),

  bringToFront: (instanceId) =>
    set((state) => ({
      cardInstances: {
        ...state.cardInstances,
        [instanceId]: { ...state.cardInstances[instanceId], zIndex: getNextZIndex() },
      },
    })),

  flipCard: (instanceId, visibility, ownerId) =>
    set((state) => {
      const card = state.cardInstances[instanceId];
      if (!card) return state;
      const newFace = visibility === 'hidden' ? 'down' : 'up';
      return {
        cardInstances: {
          ...state.cardInstances,
          [instanceId]: { ...card, face: newFace, visibility, ownerId },
        },
      };
    }),

  flipCards: (ids, visibility, ownerId) =>
    set((state) => {
      const newFace = visibility === 'hidden' ? 'down' : 'up';
      const updated = { ...state.cardInstances };
      for (const id of ids) {
        const card = updated[id];
        if (card) updated[id] = { ...card, face: newFace, visibility, ownerId };
      }
      return { cardInstances: updated };
    }),

  rotateCard: (instanceId, delta) =>
    set((state) => {
      const card = state.cardInstances[instanceId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [instanceId]: { ...card, rotation: ((card.rotation || 0) + delta + 360) % 360 },
        },
      };
    }),

  rotateCards: (ids, delta) =>
    set((state) => {
      const updated = { ...state.cardInstances };
      for (const id of ids) {
        const card = updated[id];
        if (card) updated[id] = { ...card, rotation: ((card.rotation || 0) + delta + 360) % 360 };
      }
      return { cardInstances: updated };
    }),

  removeCards: (ids) =>
    set((state) => {
      const removeSet = new Set(ids);
      const updatedCards: Record<string, CardInstance> = {};
      for (const [id, card] of Object.entries(state.cardInstances)) {
        if (!removeSet.has(id)) updatedCards[id] = card;
      }
      // スタックからも除去
      const updatedStacks: Record<string, CardStack> = {};
      for (const [sid, stack] of Object.entries(state.cardStacks)) {
        const remaining = stack.cardInstanceIds.filter((id) => !removeSet.has(id));
        if (remaining.length > 1) {
          updatedStacks[sid] = { ...stack, cardInstanceIds: remaining };
        } else if (remaining.length === 1) {
          const lastId = remaining[0];
          if (updatedCards[lastId]) {
            updatedCards[lastId] = { ...updatedCards[lastId], stackId: null, x: stack.x, y: stack.y };
          }
        }
      }
      return { cardInstances: updatedCards, cardStacks: updatedStacks };
    }),

  toggleLockCard: (instanceId) =>
    set((state) => {
      const card = state.cardInstances[instanceId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [instanceId]: { ...card, locked: !card.locked },
        },
      };
    }),

  setAreas: (areas) => set({ areas }),
  addArea: (area) => set((state) => ({ areas: [...state.areas, area] })),
  removeArea: (areaId) => set((state) => ({ areas: state.areas.filter((a) => a.areaId !== areaId) })),
  updateArea: (areaId, updates) => set((state) => ({
    areas: state.areas.map((a) => a.areaId === areaId ? { ...a, ...updates } : a),
  })),
  updateAreaProps: (areaId, props) => set((state) => ({
    areas: state.areas.map((a) => a.areaId === areaId ? { ...a, ...props } : a),
  })),
  toggleLockArea: (areaId) => set((state) => ({
    areas: state.areas.map((a) => a.areaId === areaId ? { ...a, locked: a.locked === false ? true : false } : a),
  })),

  // === スタック ===
  createStack: (cardIds, x, y) => {
    const stackId = generateStackId();
    set((state) => {
      const updatedCards = { ...state.cardInstances };
      cardIds.forEach((id) => {
        if (updatedCards[id]) {
          updatedCards[id] = { ...updatedCards[id], stackId };
        }
      });
      return {
        cardInstances: updatedCards,
        cardStacks: {
          ...state.cardStacks,
          [stackId]: { stackId, x, y, zIndex: getNextZIndex(), cardInstanceIds: cardIds },
        },
      };
    });
    return stackId;
  },

  addToStack: (stackId, cardInstanceId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [cardInstanceId]: { ...state.cardInstances[cardInstanceId], stackId },
        },
        cardStacks: {
          ...state.cardStacks,
          [stackId]: { ...stack, cardInstanceIds: [cardInstanceId, ...stack.cardInstanceIds] },
        },
      };
    }),

  drawFromStack: (stackId, count) => {
    const state = get();
    const stack = state.cardStacks[stackId];
    if (!stack || stack.cardInstanceIds.length === 0) return [];

    const drawCount = Math.min(count, stack.cardInstanceIds.length);
    const drawnIds = stack.cardInstanceIds.slice(0, drawCount);
    const remainingIds = stack.cardInstanceIds.slice(drawCount);

    const drawnCards: CardInstance[] = [];
    const updatedCards = { ...state.cardInstances };

    drawnIds.forEach((id, i) => {
      const card = updatedCards[id];
      if (card) {
        const updated = {
          ...card,
          stackId: null,
          x: stack.x + 30 + i * 20,
          y: stack.y + 30,
          zIndex: getNextZIndex(),
        };
        updatedCards[id] = updated;
        drawnCards.push(updated);
      }
    });

    const updatedStacks = { ...state.cardStacks };
    if (remainingIds.length === 0) {
      delete updatedStacks[stackId];
    } else if (remainingIds.length === 1) {
      // 残り1枚→単体カードに戻す
      const lastId = remainingIds[0];
      if (updatedCards[lastId]) {
        updatedCards[lastId] = {
          ...updatedCards[lastId],
          stackId: null,
          x: stack.x,
          y: stack.y,
          zIndex: getNextZIndex(),
        };
      }
      delete updatedStacks[stackId];
    } else {
      updatedStacks[stackId] = { ...stack, cardInstanceIds: remainingIds };
    }

    set({ cardInstances: updatedCards, cardStacks: updatedStacks });
    return drawnCards;
  },

  shuffleStack: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      const shuffled = [...stack.cardInstanceIds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return {
        cardStacks: {
          ...state.cardStacks,
          [stackId]: { ...stack, cardInstanceIds: shuffled },
        },
      };
    }),

  unstackAll: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      const updatedCards = { ...state.cardInstances };
      stack.cardInstanceIds.forEach((id, i) => {
        if (updatedCards[id]) {
          updatedCards[id] = {
            ...updatedCards[id],
            stackId: null,
            x: stack.x + (i % 5) * 140,
            y: stack.y + Math.floor(i / 5) * 190,
            zIndex: getNextZIndex(),
          };
        }
      });
      const updatedStacks = { ...state.cardStacks };
      delete updatedStacks[stackId];
      return { cardInstances: updatedCards, cardStacks: updatedStacks };
    }),

  unstackAllOpen: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      const updatedCards = { ...state.cardInstances };
      stack.cardInstanceIds.forEach((id, i) => {
        if (updatedCards[id]) {
          updatedCards[id] = {
            ...updatedCards[id],
            stackId: null,
            x: stack.x + (i % 5) * 140,
            y: stack.y + Math.floor(i / 5) * 190,
            zIndex: getNextZIndex(),
            face: 'up',
            visibility: 'public',
          };
        }
      });
      const updatedStacks = { ...state.cardStacks };
      delete updatedStacks[stackId];
      return { cardInstances: updatedCards, cardStacks: updatedStacks };
    }),

  peekStack: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack || stack.cardInstanceIds.length === 0) return state;
      const topId = stack.cardInstanceIds[0];
      const card = state.cardInstances[topId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [topId]: { ...card, face: 'up', visibility: 'owner', ownerId: get().currentPlayerId },
        },
      };
    }),

  unpeekStack: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack || stack.cardInstanceIds.length === 0) return state;
      const topId = stack.cardInstanceIds[0];
      const card = state.cardInstances[topId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [topId]: { ...card, face: 'down', visibility: 'hidden', ownerId: null },
        },
      };
    }),

  mergeStacks: (targetStackId, sourceStackId) =>
    set((state) => {
      const target = state.cardStacks[targetStackId];
      const source = state.cardStacks[sourceStackId];
      if (!target || !source || targetStackId === sourceStackId) return state;
      const updatedCards = { ...state.cardInstances };
      source.cardInstanceIds.forEach((id) => {
        if (updatedCards[id]) {
          updatedCards[id] = { ...updatedCards[id], stackId: targetStackId };
        }
      });
      const updatedStacks = { ...state.cardStacks };
      updatedStacks[targetStackId] = {
        ...target,
        cardInstanceIds: [...target.cardInstanceIds, ...source.cardInstanceIds],
      };
      delete updatedStacks[sourceStackId];
      return { cardInstances: updatedCards, cardStacks: updatedStacks };
    }),

  moveStack: (stackId, x, y) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      return {
        cardStacks: {
          ...state.cardStacks,
          [stackId]: { ...stack, x, y },
        },
      };
    }),

  bringStackToFront: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      return {
        cardStacks: {
          ...state.cardStacks,
          [stackId]: { ...stack, zIndex: getNextZIndex() },
        },
      };
    }),

  // === カウンター ===
  addCounter: (name, x, y) => {
    const counterId = `counter_${Date.now()}`;
    set((state) => ({
      counters: {
        ...state.counters,
        [counterId]: {
          counterId,
          name,
          value: 0,
          min: -999,
          max: 999,
          step: 1,
          x,
          y,
          zIndex: getNextZIndex(),
          locked: false,
        },
      },
    }));
  },

  updateCounter: (counterId, value) =>
    set((state) => {
      const counter = state.counters[counterId];
      if (!counter) return state;
      const clamped = Math.max(counter.min, Math.min(counter.max, value));
      return {
        counters: {
          ...state.counters,
          [counterId]: { ...counter, value: clamped },
        },
      };
    }),

  renameCounter: (counterId, name) =>
    set((state) => {
      const counter = state.counters[counterId];
      if (!counter) return state;
      return {
        counters: {
          ...state.counters,
          [counterId]: { ...counter, name },
        },
      };
    }),

  moveCounter: (counterId, x, y) =>
    set((state) => ({
      counters: {
        ...state.counters,
        [counterId]: { ...state.counters[counterId], x, y },
      },
    })),

  removeCounter: (counterId) =>
    set((state) => {
      const { [counterId]: _removed, ...rest } = state.counters;
      void _removed;
      return { counters: rest };
    }),

  duplicateCounter: (counterId) => {
    const state = get();
    const counter = state.counters[counterId];
    if (!counter) return;
    const newId = `counter_${Date.now()}`;
    set((s) => ({
      counters: {
        ...s.counters,
        [newId]: { ...counter, counterId: newId, x: counter.x + 30, y: counter.y + 30, zIndex: getNextZIndex() },
      },
    }));
  },

  toggleLockCounter: (counterId) =>
    set((state) => {
      const counter = state.counters[counterId];
      if (!counter) return state;
      return {
        counters: {
          ...state.counters,
          [counterId]: { ...counter, locked: !counter.locked },
        },
      };
    }),

  // === 画像 ===
  addImage: (url, x, y, width, height) => {
    const imageId = `img_${Date.now()}`;
    set((state) => ({
      images: {
        ...state.images,
        [imageId]: { imageId, url, x, y, width, height, zIndex: getNextZIndex(), locked: false },
      },
    }));
  },

  moveImage: (imageId, x, y) =>
    set((state) => ({
      images: {
        ...state.images,
        [imageId]: { ...state.images[imageId], x, y },
      },
    })),

  resizeImage: (imageId, width, height) =>
    set((state) => ({
      images: {
        ...state.images,
        [imageId]: { ...state.images[imageId], width, height },
      },
    })),

  removeImage: (imageId) =>
    set((state) => {
      const { [imageId]: _removed, ...rest } = state.images;
      void _removed;
      return { images: rest };
    }),

  toggleLockImage: (imageId) =>
    set((state) => {
      const img = state.images[imageId];
      if (!img) return state;
      return { images: { ...state.images, [imageId]: { ...img, locked: !img.locked } } };
    }),

  // === メモ ===
  addMemo: (x, y) => {
    const memoId = `memo_${Date.now()}`;
    // syncStore から著者名を取得（動的import回避のため lazy access）
    let author = '';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useSyncStore } = require('./syncStore');
      author = useSyncStore.getState().playerName || '';
    } catch { /* ignore */ }
    set((state) => ({
      memos: {
        ...state.memos,
        [memoId]: {
          memoId, text: '', x, y, width: 150, height: 100,
          color: '#fff9c4', zIndex: getNextZIndex(), locked: false, author,
        },
      },
    }));
  },

  moveMemo: (memoId, x, y) =>
    set((state) => ({
      memos: { ...state.memos, [memoId]: { ...state.memos[memoId], x, y } },
    })),

  resizeMemo: (memoId, width, height) =>
    set((state) => ({
      memos: { ...state.memos, [memoId]: { ...state.memos[memoId], width, height } },
    })),

  updateMemoText: (memoId, text) =>
    set((state) => ({
      memos: { ...state.memos, [memoId]: { ...state.memos[memoId], text } },
    })),

  updateMemoColor: (memoId, color) =>
    set((state) => ({
      memos: { ...state.memos, [memoId]: { ...state.memos[memoId], color } },
    })),

  removeMemo: (memoId) =>
    set((state) => {
      const { [memoId]: _removed, ...rest } = state.memos;
      void _removed;
      return { memos: rest };
    }),

  toggleLockMemo: (memoId) =>
    set((state) => {
      const m = state.memos[memoId];
      if (!m) return state;
      return { memos: { ...state.memos, [memoId]: { ...m, locked: !m.locked } } };
    }),

  // === トークン ===
  addToken: (label, shape, color, x, y) => {
    const tokenId = `token_${Date.now()}`;
    set((state) => ({
      tokens: {
        ...state.tokens,
        [tokenId]: { tokenId, label, shape, color, size: 32, x, y, zIndex: getNextZIndex(), locked: false },
      },
    }));
  },

  moveToken: (tokenId, x, y) =>
    set((state) => ({
      tokens: { ...state.tokens, [tokenId]: { ...state.tokens[tokenId], x, y } },
    })),

  removeToken: (tokenId) =>
    set((state) => {
      const { [tokenId]: _removed, ...rest } = state.tokens;
      void _removed;
      return { tokens: rest };
    }),

  toggleLockToken: (tokenId) =>
    set((state) => {
      const t = state.tokens[tokenId];
      if (!t) return state;
      return { tokens: { ...state.tokens, [tokenId]: { ...t, locked: !t.locked } } };
    }),

  duplicateToken: (tokenId) => {
    const state = get();
    const t = state.tokens[tokenId];
    if (!t) return;
    const newId = `token_${Date.now()}`;
    set((s) => ({
      tokens: {
        ...s.tokens,
        [newId]: { ...t, tokenId: newId, x: t.x + 20, y: t.y + 20, zIndex: getNextZIndex() },
      },
    }));
  },

  // === カウンター定義 ===
  setCounterDefs: (defs) => set({ counterDefs: defs }),

  // === ルール ===
  setRulesText: (text) => set({ rulesText: text }),

  // === セットアップテキスト ===
  setupText: '',
  setSetupText: (text) => set({ setupText: text }),

  // === 所有権譲渡 ===
  transferOwnership: (instanceId, newOwnerId) =>
    set((state) => {
      const card = state.cardInstances[instanceId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [instanceId]: { ...card, ownerId: newOwnerId, visibility: 'owner' },
        },
      };
    }),

  // === ダイス ===
  rollDice: (count, faces) => {
    const values: number[] = [];
    for (let i = 0; i < count; i++) values.push(Math.floor(Math.random() * faces) + 1);
    const result: DiceResult = { id: `dice_${Date.now()}`, values, faces, timestamp: Date.now() };
    set((state) => ({
      diceResults: [...state.diceResults.slice(-19), result],
    }));
    return result;
  },

  removeCardsByDefinitionIds: (defIds) =>
    set((state) => {
      const defIdSet = new Set(defIds);
      const updatedCards: Record<string, CardInstance> = {};
      const removedInstanceIds = new Set<string>();

      for (const [id, card] of Object.entries(state.cardInstances)) {
        if (defIdSet.has(card.definitionId)) {
          removedInstanceIds.add(id);
        } else {
          updatedCards[id] = card;
        }
      }

      // スタックから削除されたカードを除去
      const updatedStacks: Record<string, CardStack> = {};
      for (const [sid, stack] of Object.entries(state.cardStacks)) {
        const remaining = stack.cardInstanceIds.filter((id) => !removedInstanceIds.has(id));
        if (remaining.length > 1) {
          updatedStacks[sid] = { ...stack, cardInstanceIds: remaining };
        } else if (remaining.length === 1) {
          // 残り1枚 → 単体カードに戻す
          const lastId = remaining[0];
          if (updatedCards[lastId]) {
            updatedCards[lastId] = { ...updatedCards[lastId], stackId: null, x: stack.x, y: stack.y };
          }
        }
        // 0枚ならスタックごと削除
      }

      return { cardInstances: updatedCards, cardStacks: updatedStacks };
    }),

  removeExcessCards: (definitionId, count) =>
    set((state) => {
      const instances = Object.values(state.cardInstances).filter(
        (c) => c.definitionId === definitionId
      );
      // スタックに入ってないカードから優先的に除去
      const sorted = [...instances].sort((a, b) => (a.stackId ? 1 : 0) - (b.stackId ? 1 : 0));
      const toRemove = sorted.slice(0, count);
      const removeIds = new Set(toRemove.map((c) => c.instanceId));

      const updatedCards: Record<string, CardInstance> = {};
      for (const [id, card] of Object.entries(state.cardInstances)) {
        if (!removeIds.has(id)) {
          updatedCards[id] = card;
        }
      }

      // スタックから削除されたカードを除去
      const updatedStacks: Record<string, CardStack> = {};
      for (const [sid, stack] of Object.entries(state.cardStacks)) {
        const remaining = stack.cardInstanceIds.filter((id) => !removeIds.has(id));
        if (remaining.length > 1) {
          updatedStacks[sid] = { ...stack, cardInstanceIds: remaining };
        } else if (remaining.length === 1) {
          const lastId = remaining[0];
          if (updatedCards[lastId]) {
            updatedCards[lastId] = { ...updatedCards[lastId], stackId: null, x: stack.x, y: stack.y };
          }
        }
      }

      return { cardInstances: updatedCards, cardStacks: updatedStacks };
    }),

  addLog: (message) =>
    set((state) => ({
      logs: [...state.logs, { timestamp: Date.now(), playerId: get().currentPlayerId, message }],
    })),

  // === Undo/Redo ===
  saveSnapshot: () => {
    saveUndo(get());
  },

  undo: () => {
    const snapshot = undoStack.pop();
    if (!snapshot) return;
    redoStack.push(takeSnapshot(get()));
    set({
      cardInstances: snapshot.cardInstances,
      cardStacks: snapshot.cardStacks,
      counters: snapshot.counters,
      memos: snapshot.memos,
      images: snapshot.images,
      tokens: snapshot.tokens,
    });
    get().addLog('Undo');
  },

  redo: () => {
    const snapshot = redoStack.pop();
    if (!snapshot) return;
    undoStack.push(takeSnapshot(get()));
    set({
      cardInstances: snapshot.cardInstances,
      cardStacks: snapshot.cardStacks,
      counters: snapshot.counters,
      memos: snapshot.memos,
      images: snapshot.images,
      tokens: snapshot.tokens,
    });
    get().addLog('Redo');
  },

  clearField: () => {
    instanceCounter = 0;
    stackCounter = 0;
    nextZIndex = 1;
    undoStack = [];
    redoStack = [];
    set({
      cardInstances: {},
      cardStacks: {},
      counters: {},
      images: {},
      memos: {},
      tokens: {},
      diceResults: [],
      logs: [],
    });
  },
}));
