import { useRef, useCallback, useEffect, memo } from 'react';
import cardImageMapping from '../data/cardImageMapping.json';
import type { CardInstance, CardDefinition, CardTemplate, CardTemplateField } from '../types';
import { getCardSize, resolveTemplate } from '../utils/cardTemplate';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './CardComponent.css';

interface Props {
  instance: CardInstance;
  definition: CardDefinition;
  template: CardTemplate;
  onDragEnd?: (instanceId: string) => void;
}

// React.memo の比較関数: 再レンダリングが必要なプロパティのみ比較
function arePropsEqual(prev: Props, next: Props): boolean {
  const pi = prev.instance;
  const ni = next.instance;
  return (
    pi.x === ni.x &&
    pi.y === ni.y &&
    pi.zIndex === ni.zIndex &&
    pi.face === ni.face &&
    pi.visibility === ni.visibility &&
    pi.rotation === ni.rotation &&
    pi.ownerId === ni.ownerId &&
    pi.stackId === ni.stackId &&
    pi.locked === ni.locked &&
    prev.definition === next.definition &&
    prev.template === next.template &&
    prev.onDragEnd === next.onDragEnd
  );
}

export const CardComponent = memo(function CardComponent({ instance, definition, template, onDragEnd }: Props) {
  const moveCard = useGameStore((s) => s.moveCard);
  const moveCardsTo = useGameStore((s) => s.moveCardsTo);
  const bringToFront = useGameStore((s) => s.bringToFront);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const selectedCardIds = useUIStore((s) => s.selectedCardIds);
  const isSelected = selectedCardIds.includes(instance.instanceId);

  const size = getCardSize(template);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const multiDragRef = useRef<Record<string, { origX: number; origY: number }> | null>(null);
  const rafIdRef = useRef<number | null>(null); // rAF スロットリング用

  // コンポーネントアンマウント時に保留中の rAF をキャンセル
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    if (instance.locked) return;
    saveSnapshot();
    bringToFront(instance.instanceId);

    // 複数選択中のカードをドラッグ → 全選択カードを一緒に動かす
    const { selectedCardIds: selIds } = useUIStore.getState();
    const isMulti = selIds.includes(instance.instanceId) && selIds.length > 1;

    if (isMulti) {
      const state = useGameStore.getState();
      const origPositions: Record<string, { origX: number; origY: number }> = {};
      for (const id of selIds) {
        const c = state.cardInstances[id];
        if (c) origPositions[id] = { origX: c.x, origY: c.y };
      }
      multiDragRef.current = origPositions;
    } else {
      multiDragRef.current = null;
    }

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: instance.x,
      origY: instance.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [instance.instanceId, instance.x, instance.y, instance.locked, bringToFront, saveSnapshot]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;

    // rAF スロットリング: 毎フレーム1回のみ状態更新
    if (rafIdRef.current !== null) return;

    // PointerEvent のプロパティを先に取得（SyntheticEvent は再利用されるため）
    const clientX = e.clientX;
    const clientY = e.clientY;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!dragRef.current) return;

      const { zoom, gridEnabled: ge, cellSize: cs, setSnapGuides } = useUIStore.getState();
      const dx = (clientX - dragRef.current.startX) / zoom;
      const dy = (clientY - dragRef.current.startY) / zoom;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;

      if (ge) {
        newX = Math.round(newX / cs) * cs;
        newY = Math.round(newY / cs) * cs;
      }

      // スナップガイド検出（単体ドラッグ時のみ）
      if (!multiDragRef.current) {
        const SNAP_THRESHOLD = 6;
        const guides: { type: 'h' | 'v'; pos: number }[] = [];
        const state = useGameStore.getState();
        const myEdges = { l: newX, r: newX + size.width, cx: newX + size.width / 2, t: newY, b: newY + size.height, cy: newY + size.height / 2 };
        // cardDefinitionMap キャッシュを使用
        const dMap = state.cardDefinitionMap;

        for (const other of Object.values(state.cardInstances)) {
          if (other.instanceId === instance.instanceId || other.stackId) continue;
          const oDef = dMap.get(other.definitionId);
          const oTmpl = resolveTemplate(state.cardTemplates, oDef?.template as string | undefined);
          const cardSize = getCardSize(oTmpl);
          const oEdges = { l: other.x, r: other.x + cardSize.width, cx: other.x + cardSize.width / 2, t: other.y, b: other.y + cardSize.height, cy: other.y + cardSize.height / 2 };

          // vertical snap (x-axis alignment)
          for (const [mKey, oKey] of [['l','l'],['r','r'],['cx','cx'],['l','r'],['r','l']] as const) {
            const mVal = myEdges[mKey as keyof typeof myEdges];
            const oVal = oEdges[oKey as keyof typeof oEdges];
            if (Math.abs(mVal - oVal) < SNAP_THRESHOLD) {
              const offset = oVal - myEdges[mKey as keyof typeof myEdges];
              newX += offset;
              myEdges.l = newX; myEdges.r = newX + size.width; myEdges.cx = newX + size.width / 2;
              guides.push({ type: 'v', pos: oVal });
              break;
            }
          }

          // horizontal snap (y-axis alignment)
          for (const [mKey, oKey] of [['t','t'],['b','b'],['cy','cy'],['t','b'],['b','t']] as const) {
            const mVal = myEdges[mKey as keyof typeof myEdges];
            const oVal = oEdges[oKey as keyof typeof oEdges];
            if (Math.abs(mVal - oVal) < SNAP_THRESHOLD) {
              const offset = oVal - myEdges[mKey as keyof typeof myEdges];
              newY += offset;
              myEdges.t = newY; myEdges.b = newY + size.height; myEdges.cy = newY + size.height / 2;
              guides.push({ type: 'h', pos: oVal });
              break;
            }
          }
        }
        setSnapGuides(guides);
      }

      if (multiDragRef.current) {
        const snappedDx = newX - dragRef.current.origX;
        const snappedDy = newY - dragRef.current.origY;
        const positions = Object.entries(multiDragRef.current).map(([id, orig]) => ({
          id,
          x: orig.origX + snappedDx,
          y: orig.origY + snappedDy,
        }));
        moveCardsTo(positions);
      } else {
        moveCard(instance.instanceId, newX, newY);
      }
    });
  }, [instance.instanceId, size.width, size.height, moveCard, moveCardsTo]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // 保留中の rAF をキャンセル
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (dragRef.current) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const moved = Math.abs(dx) + Math.abs(dy) > 4;
      dragRef.current = null;
      useUIStore.getState().setSnapGuides([]);
      if (multiDragRef.current) {
        multiDragRef.current = null;
      } else if (!moved) {
        // 単クリック: Shift押下で追加/解除、それ以外は排他選択
        const { selectedCardIds: sel, setSelectedCards } = useUIStore.getState();
        if (e.shiftKey) {
          if (sel.includes(instance.instanceId)) {
            setSelectedCards(sel.filter((id) => id !== instance.instanceId));
          } else {
            setSelectedCards([...sel, instance.instanceId]);
          }
        } else {
          setSelectedCards([instance.instanceId]);
        }
      } else {
        // エリア内にドロップされたらグリッドスナップ
        const gameState = useGameStore.getState();
        const uiState = useUIStore.getState();
        const cs = uiState.cellSize;
        const card = gameState.cardInstances[instance.instanceId];
        if (card) {
          // cardDefinitionMap キャッシュを使用
          const dMap = gameState.cardDefinitionMap;
          const cDef = dMap.get(card.definitionId);
          const cTmpl = resolveTemplate(gameState.cardTemplates, cDef?.template as string | undefined);
          const cardSize = getCardSize(cTmpl);

          for (const area of gameState.areas) {
            const ax = area.x * cs;
            const ay = area.y * cs;
            const aw = area.width * cs;
            const ah = area.height * cs;

            // カードがエリア範囲内か判定
            if (card.x >= ax && card.x < ax + aw && card.y >= ay && card.y < ay + ah) {
              // グリッドステップ計算
              const colStep = Math.ceil((cardSize.width + 8) / cs) * cs;
              const rowStep = Math.ceil((cardSize.height + 8) / cs) * cs;
              const maxCols = Math.max(1, Math.floor(aw / colStep));

              // エリア内の他のカードが占有しているスロットを収集
              const occupied = new Set<string>();
              for (const other of Object.values(gameState.cardInstances)) {
                if (other.instanceId === card.instanceId || other.stackId) continue;
                if (other.x >= ax && other.x < ax + aw && other.y >= ay && other.y < ay + ah) {
                  const slotKey = `${other.x},${other.y}`;
                  occupied.add(slotKey);
                }
              }

              // 空きスロットを探す
              const maxSlots = maxCols * Math.max(1, Math.ceil(ah / rowStep));
              for (let i = 0; i < maxSlots; i++) {
                const sx = ax + (i % maxCols) * colStep;
                const sy = ay + Math.floor(i / maxCols) * rowStep;
                if (!occupied.has(`${sx},${sy}`)) {
                  moveCard(instance.instanceId, sx, sy);
                  break;
                }
              }
              break;
            }
          }
        }
        onDragEnd?.(instance.instanceId);
      }
    }
  }, [instance.instanceId, onDragEnd, moveCard]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, instance.x, instance.y, 'card', instance.instanceId);
  }, [instance.instanceId, instance.x, instance.y, showContextMenu]);

  const borderColor = template.border.colorField
    ? (definition[template.border.colorField] as string) || template.border.color || '#666'
    : template.border.color || '#666';

  // 神視点モード: 山札内でないカードは全て表向き表示
  const godView = useUIStore((s) => s.godView);
  const isFaceUp = (godView && !instance.stackId) || (
    instance.face === 'up' && (
      instance.visibility === 'public' ||
      (instance.visibility === 'owner' && instance.ownerId === currentPlayerId)
    )
  );
  const isOwnerOnly = isFaceUp && instance.visibility === 'owner';

  return (
    <div
      className={`card-component ${isFaceUp ? 'face-up' : 'face-down'} ${instance.locked ? 'locked' : ''} ${isSelected ? 'selected' : ''} ${isOwnerOnly ? 'owner-only' : ''}`}
      style={{
        left: instance.x + FIELD_OFFSET,
        top: instance.y + FIELD_OFFSET,
        width: size.width,
        height: size.height,
        zIndex: instance.zIndex,
        borderColor,
        borderRadius: template.border.radius,
        transform: instance.rotation ? `rotate(${instance.rotation}deg)` : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {isFaceUp ? (
        <div className="card-front" style={{ backgroundColor: definition.color as string || '#fff' }}>
          {template.layout.map((field, i) => (
            <CardField key={i} field={field} definition={definition} />
          ))}
          {/* カード名に対応するイラストが存在すれば表示 */}
          {!template.layout.some((f) => f.field === 'illustration') && (
            <CardAutoIllust name={String(definition.name || '')} />
          )}
          {isOwnerOnly && <span className="card-owner-badge">自</span>}
        </div>
      ) : (
        <div className="card-back" style={{ backgroundColor: template.back.bgColor }}>
          {template.back.imageUrl ? (
            <img src={template.back.imageUrl} alt="" draggable={false} className="card-back-image" />
          ) : (
            <span className="card-back-text">{template.back.text || ''}</span>
          )}
        </div>
      )}
    </div>
  );
}, arePropsEqual);

function CardAutoIllust({ name }: { name: string }) {
  if (!name) return null;
  const file = (cardImageMapping as Record<string, string>)[name];
  if (!file) return null;
  const src = `/card-images/${file}`;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className="card-auto-illust"
      onError={(e) => { e.currentTarget.style.display = 'none'; }}
    />
  );
}

function isImageUrl(value: string): boolean {
  if (/^(https?:\/\/|data:image\/)/.test(value)) return true;
  if (/\.(png|jpe?g|gif|svg|webp|bmp)(\?.*)?$/i.test(value)) return true;
  return false;
}

function CardField({ field, definition }: { field: CardTemplateField; definition: CardDefinition }) {
  const value = definition[field.field];
  if (value === undefined || value === '') return null;

  const strVal = String(value);
  const isImg = isImageUrl(strVal);

  // fontSizeField指定があればカードCSVの値を優先
  const baseFontSize = field.fontSizeField && definition[field.fontSizeField] != null
    ? Number(definition[field.fontSizeField]) || (field.fontSize ?? 12)
    : (field.fontSize ?? 12);
  const fontSize = field.position === 'bottom'
    ? Math.max(baseFontSize, 13)
    : baseFontSize;

  return (
    <div
      className={`card-field card-field-${field.position}`}
      style={{
        fontSize,
        fontWeight: field.bold ? 'bold' : 'normal',
        fontStyle: field.italic ? 'italic' : 'normal',
        color: field.textColor || undefined,
        ...(isImg && field.height ? { height: field.height, minHeight: 0 } : {}),
      }}
    >
      {isImg ? (
        <img src={strVal} alt="" draggable={false} className="card-field-image" />
      ) : field.shape === 'circle' ? (
        <span className="card-field-badge" style={{ backgroundColor: field.bgColor || '#ccc' }}>
          {strVal}
        </span>
      ) : (
        strVal
      )}
    </div>
  );
}
