import type { CardDefinition, CardInstance, CardTemplate, CardStack, Area, Counter, Player } from '../types';
import type { CounterDef } from './counterCsv';
import { shuffle } from './shuffle';
import { getCardSize, DEFAULT_TEMPLATE } from './cardTemplate';
import { computePerPlayerBaseYs } from './areaCsv';
import { useUIStore } from '../store/uiStore';

export interface SetupAction {
  action: 'shuffle' | 'deal' | 'remove' | 'give';
  target?: string;        // エリアID (shuffle対象)
  from?: string;          // エリアID (deal元)
  to?: string;            // エリアID (deal先)
  component?: string;     // カウンター定義ID (give用)
  count?: number | Record<string, number>; // 枚数 or 人数別枚数
  perPlayer?: boolean;
  faceUp?: boolean;
  filter?: { tag?: string; minPlayers?: number };
  when?: string;          // "players < 5" 等の条件
}

export interface SetupConfig {
  playerCount: number;
  actions: SetupAction[];
  counterDefs?: CounterDef[];
}

const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

interface SetupResult {
  cardInstances: Record<string, CardInstance>;
  cardStacks: Record<string, CardStack>;
  counters: Record<string, Counter>;
  players: Player[];
  logs: string[];
}

let instanceCounter = 0;

function generateInstanceId(): string {
  return `setup_card_${++instanceCounter}_${Date.now()}`;
}

function resolveCount(count: number | Record<string, number> | undefined, playerCount: number): number {
  if (count === undefined) return 1;
  if (typeof count === 'number') return count;
  const key = `${playerCount}p`;
  return count[key] ?? count['default'] ?? 1;
}

function evaluateCondition(when: string | undefined, playerCount: number): boolean {
  if (!when) return true;
  const ltMatch = when.match(/players\s*<\s*(\d+)/);
  if (ltMatch) return playerCount < Number(ltMatch[1]);
  const gtMatch = when.match(/players\s*>\s*(\d+)/);
  if (gtMatch) return playerCount > Number(gtMatch[1]);
  const eqMatch = when.match(/players\s*===?\s*(\d+)/);
  if (eqMatch) return playerCount === Number(eqMatch[1]);
  return true;
}

export function executeSetup(
  cardDefinitions: CardDefinition[],
  areas: Area[],
  config: SetupConfig,
  templates?: Record<string, CardTemplate>,
): SetupResult {
  const logs: string[] = [];
  // プレイヤー自動生成
  const players: Player[] = [];
  for (let i = 0; i < config.playerCount; i++) {
    players.push({ playerId: `p${i}`, name: `P${i + 1}`, color: PLAYER_COLORS[i % PLAYER_COLORS.length] });
  }
  logs.push(`${config.playerCount}人のプレイヤーを生成`);

  const tmplMap = templates || { default: DEFAULT_TEMPLATE };
  // defaultテンプレのサイズでグリッド計算（混在時は近似）
  const cardSize = getCardSize(tmplMap['default'] || DEFAULT_TEMPLATE);
  const cellSize = useUIStore.getState().cellSize;
  const colStep = Math.ceil((cardSize.width + 8) / cellSize) * cellSize;
  const rowStep = Math.ceil((cardSize.height + 8) / cellSize) * cellSize;
  const setupCounters: Record<string, Counter> = {};
  let counterIdx = 0;

  // 全カードをインスタンス化（展開済み）
  const allCards: { def: CardDefinition; instanceId: string }[] = [];
  for (const def of cardDefinitions) {
    const count = typeof def.count === 'number' ? def.count : 1;
    for (let i = 0; i < count; i++) {
      allCards.push({ def, instanceId: generateInstanceId() });
    }
  }

  const areaMap = new Map(areas.map((a) => [a.areaId, a]));
  const areaCards: Record<string, { def: CardDefinition; instanceId: string; faceUp?: boolean; ownerId?: string }[]> = {};
  let pool = [...allCards];

  for (const action of config.actions) {
    if (!evaluateCondition(action.when, config.playerCount)) continue;

    switch (action.action) {
      case 'remove': {
        const before = pool.length;
        pool = pool.filter((c) => {
          if (action.filter?.tag && c.def.tag === action.filter.tag) return false;
          if (action.filter?.minPlayers && typeof c.def.min_players === 'number') {
            return config.playerCount >= (c.def.min_players as number);
          }
          return true;
        });
        const removed = before - pool.length;
        if (removed > 0) logs.push(`${removed}枚のカードを除外した`);
        break;
      }

      case 'shuffle': {
        pool = shuffle(pool);
        logs.push('カードをシャッフルした');
        break;
      }

      case 'deal': {
        const count = resolveCount(action.count, config.playerCount);
        const toKey = action.to || '_field';

        // filter.tag が指定された場合、タグ一致カードをpoolから抽出して使う
        let dealPool = pool;
        if (action.filter?.tag) {
          const tagVal = action.filter.tag;
          dealPool = pool.filter((c) => (c.def as Record<string, unknown>).tag === tagVal);
          pool = pool.filter((c) => (c.def as Record<string, unknown>).tag !== tagVal);
        }

        if (action.perPlayer) {
          for (let p = 0; p < config.playerCount; p++) {
            const playerId = players[p]?.playerId || null;
            const dealt = dealPool.splice(0, count).map((c) => ({ ...c, faceUp: action.faceUp, ownerId: playerId ?? undefined }));
            const key = `${toKey}_p${p}`;
            areaCards[key] = [...(areaCards[key] || []), ...dealt];
          }
          logs.push(`各プレイヤーに${count}枚ずつ配った`);
        } else {
          const dealt = dealPool.splice(0, count).map((c) => ({ ...c, faceUp: action.faceUp }));
          areaCards[toKey] = [...(areaCards[toKey] || []), ...dealt];
          const areaName = areaMap.get(toKey)?.name || toKey;
          logs.push(`${dealt.length}枚を${areaName}に配った`);
        }

        // 未配布のフィルタ済みカードをpoolに戻す
        if (action.filter?.tag) {
          pool = [...pool, ...dealPool];
        }
        break;
      }

      case 'give': {
        const count = resolveCount(action.count, config.playerCount);
        const compId = action.component;
        const counterDef = config.counterDefs?.find((d) => d.id === compId);
        const counterName = counterDef?.name || compId || 'Counter';
        const defaultVal = counterDef?.default ?? count;

        if (action.perPlayer) {
          const toArea = action.to ? areaMap.get(action.to) : null;
          for (let p = 0; p < config.playerCount; p++) {
            const cid = `setup_counter_${++counterIdx}_${Date.now()}`;
            const baseX = toArea ? toArea.x * cellSize + p * toArea.width * cellSize : cellSize + p * 150;
            const baseY = toArea ? (toArea.y + toArea.height) * cellSize - 40 : cellSize;
            setupCounters[cid] = {
              counterId: cid, name: `P${p + 1} ${counterName}`,
              value: defaultVal, min: counterDef?.min ?? -999, max: counterDef?.max ?? 999,
              step: counterDef?.step ?? 1, x: baseX, y: baseY, zIndex: 0, locked: false,
            };
          }
          logs.push(`各プレイヤーに${counterName}を配布`);
        } else {
          const cid = `setup_counter_${++counterIdx}_${Date.now()}`;
          setupCounters[cid] = {
            counterId: cid, name: counterName,
            value: defaultVal, min: counterDef?.min ?? -999, max: counterDef?.max ?? 999,
            step: counterDef?.step ?? 1, x: cellSize, y: cellSize, zIndex: 0, locked: false,
          };
          logs.push(`${counterName}を配置`);
        }
        break;
      }
    }
  }

  // 残りのカードもフィールドに配置（消えないようにする）
  if (pool.length > 0) {
    const deckArea = areas.find((a) => a.visibility === 'hidden');
    const key = deckArea ? deckArea.areaId : '_remaining';
    areaCards[key] = [...(areaCards[key] || []), ...pool];
    logs.push(`残り${pool.length}枚をフィールドに配置`);
  }

  // perPlayerエリアの重なり防止: プレイヤー数に応じてベースYを調整
  const perPlayerBaseYs = computePerPlayerBaseYs(areas, config.playerCount);

  // CardInstanceに変換
  const instances: Record<string, CardInstance> = {};
  const stacks: Record<string, CardStack> = {};
  let zIndex = 1;
  let fallbackRow = 0; // エリアがない場合のフォールバック配置用

  for (const [areaKey, cards] of Object.entries(areaCards)) {
    const playerMatch = areaKey.match(/^(.+)_p(\d+)$/);
    const actualAreaId = playerMatch ? playerMatch[1] : areaKey;
    const playerIndex = playerMatch ? Number(playerMatch[2]) : -1;

    // プレイヤー固有エリア（p_witch_p0 等）が明示定義されていればそれを優先
    const area = areaMap.get(areaKey) || areaMap.get(actualAreaId);

    // hiddenエリアのカードはスタック（山札）にまとめる
    if (area && area.visibility === 'hidden' && cards.length > 1) {
      const stackId = `setup_stack_${actualAreaId}_${Date.now()}`;
      const baseX = area.x * cellSize;
      const baseY = area.y * cellSize;

      cards.forEach((card) => {
        instances[card.instanceId] = {
          instanceId: card.instanceId,
          definitionId: card.def.id,
          x: baseX,
          y: baseY,
          zIndex: zIndex++,
          face: 'down',
          visibility: 'hidden',
          ownerId: null,
          stackId,
          homeStackId: stackId,
          locked: false,
          rotation: 0,
        };
      });

      stacks[stackId] = {
        stackId,
        x: baseX,
        y: baseY,
        zIndex: zIndex++,
        cardInstanceIds: cards.map((c) => c.instanceId),
      };
      logs.push(`${cards.length}枚の山札を作成`);
      continue;
    }

    let baseX: number;
    let baseY: number;
    let maxCols: number;

    if (area) {
      baseX = area.x * cellSize;
      // プレイヤー固有エリア（p_witch_p0 等）が直接定義されている場合はそのY座標をそのまま使う
      // 汎用エリア（per_player: true）のみ自動オフセットを適用
      const isExplicit = areaMap.has(areaKey);
      const areaBaseY = (!isExplicit && playerIndex >= 0 && area.perPlayer)
        ? (perPlayerBaseYs.get(area.areaId) ?? area.y)
        : area.y;
      baseY = areaBaseY * cellSize + (!isExplicit && playerIndex >= 0 ? playerIndex * area.height * cellSize : 0);
      maxCols = Math.max(1, Math.floor((area.width * cellSize) / colStep));
    } else {
      // エリアがない場合、フィールド上に順番に配置
      baseX = cellSize;
      baseY = cellSize + fallbackRow * rowStep;
      maxCols = 10;
      fallbackRow += Math.ceil(cards.length / maxCols);
    }

    cards.forEach((card, i) => {
      const isFaceUp = card.faceUp === true;
      const hasOwner = !!card.ownerId;
      instances[card.instanceId] = {
        instanceId: card.instanceId,
        definitionId: card.def.id,
        x: baseX + (i % maxCols) * colStep,
        y: baseY + Math.floor(i / maxCols) * rowStep,
        zIndex: zIndex++,
        face: hasOwner ? 'up' : (isFaceUp ? 'up' : 'down'),
        visibility: hasOwner ? 'owner' : (isFaceUp ? 'public' : 'hidden'),
        ownerId: card.ownerId || null,
        stackId: null,
        homeStackId: null,
        locked: false,
        rotation: 0,
      };
    });

    if (area) {
      fallbackRow = Math.max(fallbackRow,
        Math.ceil((baseY + Math.ceil(cards.length / maxCols) * rowStep) / rowStep));
    }
  }

  // per_playerカウンター定義から自動生成
  if (config.counterDefs) {
    for (const def of config.counterDefs) {
      if (!def.perPlayer) continue;
      for (let p = 0; p < config.playerCount; p++) {
        const cid = `setup_counter_${++counterIdx}_${Date.now()}_${p}`;
        if (setupCounters[cid]) continue; // giveアクションで既に生成済み
        setupCounters[cid] = {
          counterId: cid, name: `P${p + 1} ${def.name}`,
          value: def.default, min: def.min, max: def.max,
          step: def.step, x: cellSize + p * 150, y: cellSize * 2, zIndex: 0, locked: false,
        };
      }
      logs.push(`各プレイヤーに${def.name}を自動生成`);
    }
  }

  return { cardInstances: instances, cardStacks: stacks, counters: setupCounters, players, logs };
}
