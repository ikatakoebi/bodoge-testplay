import { create } from 'zustand';
import type { CardDefinition, CardInstance, CardStack, Area, Counter, ImageObject, CardTemplate, LogEntry, Memo, DiceResult, Token, Player, BoardImage } from '../types';
import type { CounterDef } from '../utils/counterCsv';
import { DEFAULT_TEMPLATE, getCardSize, resolveTemplate, createImageCardTemplate } from '../utils/cardTemplate';
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
  boardImages: BoardImage[];
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
    boardImages: [...state.boardImages],
  };
}

function saveUndo(state: GameState) {
  undoStack.push(takeSnapshot(state));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
}

// セーブデータのメタ情報
export interface SaveMeta {
  name: string;
  timestamp: number;
  playerCount: number;
}

// localStorage キー
const SAVES_INDEX_KEY = 'bodoge_saves';
const SAVE_DATA_PREFIX = 'bodoge_save_';

interface GameState {
  // マスターデータ
  cardDefinitions: CardDefinition[];
  cardDefinitionMap: Map<string, CardDefinition>; // cardDefinitions のキャッシュ（id → definition）
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
  boardImages: BoardImage[];
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
  duplicateCards: (instanceIds: string[]) => void;
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
  collectToStack: (stackId: string) => void;

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
  importImageAsCard: (url: string, x: number, y: number, width: number, height: number) => void;
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

  // ボード画像（フィールド背景）
  addBoardImage: (url: string, x: number, y: number, width: number, height: number) => void;
  updateBoardImage: (boardImageId: string, updates: Partial<Omit<BoardImage, 'boardImageId'>>) => void;
  removeBoardImage: (boardImageId: string) => void;

  // エリア内カード整列
  arrangeCardsInArea: (areaId: string) => void;

  // 山札N枚公開
  revealFromStack: (stackId: string, count: number) => string[];
  takeRevealedCard: (instanceId: string, x: number, y: number) => void;
  returnRevealedCards: (cardIds: string[], stackId: string) => void;

  // リセット
  clearField: () => void;

  // セーブ/ロード
  saveGame: (name: string) => void;
  loadGame: (name: string) => boolean;
  deleteSave: (name: string) => void;
  listSaves: () => SaveMeta[];
}

export const useGameStore = create<GameState>((set, get) => ({
  cardDefinitions: [],
  cardDefinitionMap: new Map(),
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
  boardImages: [],
  diceResults: [],
  rulesText: '',
  logs: [],

  setPlayers: (players) => set({ players }),
  setCurrentPlayer: (playerId) => set({ currentPlayerId: playerId }),
  setCardDefinitions: (defs) => set({
    cardDefinitions: defs,
    cardDefinitionMap: new Map(defs.map((d) => [d.id, d])),
  }),
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
          homeStackId: null,
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

  duplicateCards: (instanceIds) => {
    const state = get();
    const newInstances: Record<string, CardInstance> = {};
    for (const instanceId of instanceIds) {
      const card = state.cardInstances[instanceId];
      if (!card) continue;
      const newId = crypto.randomUUID();
      newInstances[newId] = {
        instanceId: newId,
        definitionId: card.definitionId,
        face: card.face,
        visibility: card.visibility,
        rotation: card.rotation,
        locked: card.locked,
        x: card.x + 12,
        y: card.y + 12,
        zIndex: getNextZIndex(),
        stackId: null,
        homeStackId: null,
        ownerId: null,
      };
    }
    set((s) => ({
      cardInstances: { ...s.cardInstances, ...newInstances },
    }));
  },

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
          updatedCards[id] = {
            ...updatedCards[id],
            stackId,
            homeStackId: updatedCards[id].homeStackId || stackId,
            face: 'down',
            visibility: 'hidden',
            ownerId: null,
          };
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
      const card = state.cardInstances[cardInstanceId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [cardInstanceId]: {
            ...card,
            stackId,
            homeStackId: card.homeStackId || stackId,
            face: 'down',
            visibility: 'hidden',
            ownerId: null,
          },
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

    // 残り0枚でも山札を残す（返却先プレースホルダーとして機能）
    const updatedStacks = { ...state.cardStacks };
    updatedStacks[stackId] = { ...stack, cardInstanceIds: remainingIds };

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

  collectToStack: (stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      const updatedCards = { ...state.cardInstances };
      const newIds: string[] = [];
      Object.values(state.cardInstances).forEach((card) => {
        // homeStackIdが一致するフィールド上のカードのみ回収
        if (!card.stackId && card.homeStackId === stackId) {
          updatedCards[card.instanceId] = {
            ...card,
            stackId,
            face: 'down',
            visibility: 'hidden',
            ownerId: null,
          };
          newIds.push(card.instanceId);
        }
      });
      if (newIds.length === 0) return state;
      return {
        cardInstances: updatedCards,
        cardStacks: {
          ...state.cardStacks,
          [stackId]: { ...stack, cardInstanceIds: [...stack.cardInstanceIds, ...newIds] },
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

  importImageAsCard: (url, x, y, width, height) => {
    const id = crypto.randomUUID();
    const template = createImageCardTemplate(width, height);
    const templateKey = `__img_${id}`;
    const defId = `__img_${id}`;
    const definition = { id: defId, name: '', __img: url, template: templateKey };
    const instanceId = crypto.randomUUID();
    set((state) => {
      const newDefs = [...state.cardDefinitions, definition];
      return {
        cardTemplates: { ...state.cardTemplates, [templateKey]: template },
        cardDefinitions: newDefs,
        cardDefinitionMap: new Map(newDefs.map((d) => [d.id, d])),
        cardInstances: {
          ...state.cardInstances,
          [instanceId]: {
            instanceId,
            definitionId: defId,
            x,
            y,
            zIndex: Date.now(),
            face: 'up',
            visibility: 'public',
            ownerId: null,
            stackId: null,
            homeStackId: null,
            locked: false,
            rotation: 0,
          },
        },
      };
    });
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
      boardImages: snapshot.boardImages,
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
      boardImages: snapshot.boardImages,
    });
    get().addLog('Redo');
  },

  // === エリア内カード自動整列 ===
  arrangeCardsInArea: (areaId) => {
    const state = get();
    const cellSize = useUIStore.getState().cellSize;
    const area = state.areas.find((a) => a.areaId === areaId);
    if (!area) return;

    // エリアのpx座標
    const baseX = area.x * cellSize;
    const baseY = area.y * cellSize;
    const areaW = area.width * cellSize;
    const areaH = area.height * cellSize;

    // エリア範囲内にあるフィールド上のカード（スタックに属さない）を収集
    const cardsInArea = Object.values(state.cardInstances).filter((card) => {
      if (card.stackId) return false;
      return card.x >= baseX && card.x < baseX + areaW &&
             card.y >= baseY && card.y < baseY + areaH;
    });

    if (cardsInArea.length === 0) return;

    // 先頭カードのテンプレートでグリッドステップを算出（キャッシュ済みMapを使用）
    const firstDef = state.cardDefinitionMap.get(cardsInArea[0].definitionId);
    const tmpl = resolveTemplate(state.cardTemplates, firstDef?.template as string | undefined);
    const cardSize = getCardSize(tmpl);

    const colStep = Math.ceil((cardSize.width + 8) / cellSize) * cellSize;
    const rowStep = Math.ceil((cardSize.height + 8) / cellSize) * cellSize;
    const maxCols = Math.max(1, Math.floor(areaW / colStep));

    // カードをグリッド状に再配置
    const updated = { ...state.cardInstances };
    cardsInArea.forEach((card, i) => {
      updated[card.instanceId] = {
        ...updated[card.instanceId],
        x: baseX + (i % maxCols) * colStep,
        y: baseY + Math.floor(i / maxCols) * rowStep,
      };
    });
    set({ cardInstances: updated });
  },

  // === 山札N枚公開 ===
  revealFromStack: (stackId, count) => {
    const state = get();
    const stack = state.cardStacks[stackId];
    if (!stack || stack.cardInstanceIds.length === 0) return [];
    const n = Math.min(count, stack.cardInstanceIds.length);
    const revealedIds = stack.cardInstanceIds.slice(0, n);
    const remainingIds = stack.cardInstanceIds.slice(n);
    // スタックから一時的に取り出す（カード自体のstackIdはnullに）
    const updatedCards = { ...state.cardInstances };
    revealedIds.forEach((id) => {
      if (updatedCards[id]) {
        updatedCards[id] = { ...updatedCards[id], stackId: null };
      }
    });
    const updatedStacks = { ...state.cardStacks };
    updatedStacks[stackId] = { ...stack, cardInstanceIds: remainingIds };
    set({ cardInstances: updatedCards, cardStacks: updatedStacks });
    return revealedIds;
  },

  takeRevealedCard: (instanceId, x, y) =>
    set((state) => {
      const card = state.cardInstances[instanceId];
      if (!card) return state;
      return {
        cardInstances: {
          ...state.cardInstances,
          [instanceId]: {
            ...card,
            x,
            y,
            face: 'up',
            visibility: 'public',
            ownerId: null,
            zIndex: getNextZIndex(),
          },
        },
      };
    }),

  returnRevealedCards: (cardIds, stackId) =>
    set((state) => {
      const stack = state.cardStacks[stackId];
      if (!stack) return state;
      const updatedCards = { ...state.cardInstances };
      cardIds.forEach((id) => {
        if (updatedCards[id]) {
          updatedCards[id] = {
            ...updatedCards[id],
            stackId,
            face: 'down',
            visibility: 'hidden',
            ownerId: null,
          };
        }
      });
      return {
        cardInstances: updatedCards,
        cardStacks: {
          ...state.cardStacks,
          [stackId]: {
            ...stack,
            cardInstanceIds: [...cardIds, ...stack.cardInstanceIds],
          },
        },
      };
    }),

  clearField: () => {
    instanceCounter = 0;
    stackCounter = 0;
    nextZIndex = 1;
    undoStack = [];
    redoStack = [];
    set({
      cardInstances: {},
      cardStacks: {},
      areas: [],
      counters: {},
      images: {},
      memos: {},
      tokens: {},
      boardImages: [],
      diceResults: [],
      logs: [],
    });
  },

  // === ボード画像（フィールド背景） ===
  addBoardImage: (url, x, y, width, height) => {
    const boardImageId = `bimg_${Date.now()}`;
    set((state) => ({
      boardImages: [...state.boardImages, { boardImageId, url, x, y, width, height, opacity: 1, locked: false }],
    }));
  },

  updateBoardImage: (boardImageId, updates) =>
    set((state) => ({
      boardImages: state.boardImages.map((bi) =>
        bi.boardImageId === boardImageId ? { ...bi, ...updates } : bi
      ),
    })),

  removeBoardImage: (boardImageId) =>
    set((state) => ({
      boardImages: state.boardImages.filter((bi) => bi.boardImageId !== boardImageId),
    })),

  // === セーブ/ロード ===
  saveGame: (name) => {
    const state = get();
    // 保存するゲーム状態データ
    const saveData = {
      cardInstances: state.cardInstances,
      cardStacks: state.cardStacks,
      counters: state.counters,
      players: state.players,
      currentPlayerId: state.currentPlayerId,
      areas: state.areas,
      cardDefinitions: state.cardDefinitions,
      cardTemplates: state.cardTemplates,
      memos: state.memos,
      images: state.images,
      tokens: state.tokens,
      boardImages: state.boardImages,
    };
    // データ本体を保存
    localStorage.setItem(SAVE_DATA_PREFIX + name, JSON.stringify(saveData));
    // メタ情報一覧を更新
    const meta: SaveMeta = {
      name,
      timestamp: Date.now(),
      playerCount: state.players.length,
    };
    const existingIndex = JSON.parse(localStorage.getItem(SAVES_INDEX_KEY) || '[]') as SaveMeta[];
    const filtered = existingIndex.filter((m: SaveMeta) => m.name !== name);
    filtered.unshift(meta);
    localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(filtered));
    state.addLog(`ゲーム状態を保存: ${name}`);
  },

  loadGame: (name) => {
    const raw = localStorage.getItem(SAVE_DATA_PREFIX + name);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      const defs: CardDefinition[] = data.cardDefinitions || [];
      set({
        cardInstances: data.cardInstances || {},
        cardStacks: data.cardStacks || {},
        counters: data.counters || {},
        players: data.players || [],
        currentPlayerId: data.currentPlayerId || 'p0',
        areas: data.areas || [],
        cardDefinitions: defs,
        cardDefinitionMap: new Map(defs.map((d) => [d.id, d])),
        cardTemplates: data.cardTemplates || { default: DEFAULT_TEMPLATE },
        memos: data.memos || {},
        images: data.images || {},
        tokens: data.tokens || {},
        boardImages: data.boardImages || [],
      });
      // カウンターをリセットしてID衝突を防ぐ
      instanceCounter = Date.now();
      stackCounter = Date.now();
      undoStack = [];
      redoStack = [];
      get().addLog(`ゲーム状態を復元: ${name}`);
      return true;
    } catch {
      return false;
    }
  },

  deleteSave: (name) => {
    localStorage.removeItem(SAVE_DATA_PREFIX + name);
    const existingIndex = JSON.parse(localStorage.getItem(SAVES_INDEX_KEY) || '[]') as SaveMeta[];
    const filtered = existingIndex.filter((m: SaveMeta) => m.name !== name);
    localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(filtered));
  },

  listSaves: () => {
    try {
      return JSON.parse(localStorage.getItem(SAVES_INDEX_KEY) || '[]') as SaveMeta[];
    } catch {
      return [];
    }
  },
}));
