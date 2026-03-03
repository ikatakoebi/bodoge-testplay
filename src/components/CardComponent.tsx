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
    pi.width === ni.width &&
    pi.height === ni.height &&
    prev.definition === next.definition &&
    prev.template === next.template &&
    prev.onDragEnd === next.onDragEnd
  );
}

export const CardComponent = memo(function CardComponent({ instance, definition, template, onDragEnd }: Props) {
  const moveCard = useGameStore((s) => s.moveCard);
  const moveCardsTo = useGameStore((s) => s.moveCardsTo);
  const bringToFront = useGameStore((s) => s.bringToFront);
  const resizeCard = useGameStore((s) => s.resizeCard);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const selectedCardIds = useUIStore((s) => s.selectedCardIds);
  const isSelected = selectedCardIds.includes(instance.instanceId);

  const templateSize = getCardSize(template);
  const size = { width: instance.width ?? templateSize.width, height: instance.height ?? templateSize.height };
  const hasCoverImage = template.layout.some((f) => f.position === 'cover' && f.field === 'image');
  const isImageCard = !!definition.__img || hasCoverImage;
  const canResize = isImageCard && instance.stackId === null && !instance.homeStackId;
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const multiDragRef = useRef<Record<string, { origX: number; origY: number }> | null>(null);
  const rafIdRef = useRef<number | null>(null); // rAF スロットリング用
  const resizeRef = useRef<{
    dir: string; startX: number; startY: number;
    origW: number; origH: number; origCardX: number; origCardY: number;
  } | null>(null);

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
    if (!e.shiftKey) bringToFront(instance.instanceId);

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

      const { zoom, gridEnabled: ge, cellSize: cs } = useUIStore.getState();
      const dx = (clientX - dragRef.current.startX) / zoom;
      const dy = (clientY - dragRef.current.startY) / zoom;
      let newX = dragRef.current.origX + dx;
      let newY = dragRef.current.origY + dy;

      if (ge) {
        newX = Math.round(newX / cs) * cs;
        newY = Math.round(newY / cs) * cs;
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
      if (multiDragRef.current && !(e.shiftKey && !moved)) {
        multiDragRef.current = null;
      } else if (!moved) {
        multiDragRef.current = null;
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
        // エリア内にドロップされたら最寄りの空きスロットにスナップ
        const gameState = useGameStore.getState();
        const uiState = useUIStore.getState();
        if (uiState.areaSnap) {
          const cs = uiState.cellSize;
          const card = gameState.cardInstances[instance.instanceId];
          if (card) {
            const dMap = gameState.cardDefinitionMap;
            const cDef = dMap.get(card.definitionId);
            const cTmpl = resolveTemplate(gameState.cardTemplates, cDef?.template as string | undefined);
            const cardSize = getCardSize(cTmpl);

            for (const area of gameState.areas) {
              const ax = area.x * cs;
              const ay = area.y * cs;
              const aw = area.width * cs;
              const ah = area.height * cs;

              if (card.x >= ax && card.x < ax + aw && card.y >= ay && card.y < ay + ah) {
                const colStep = Math.ceil((cardSize.width + 8) / cs) * cs;
                const rowStep = Math.ceil((cardSize.height + 8) / cs) * cs;
                const maxCols = Math.max(1, Math.floor(aw / colStep));

                const occupied = new Set<string>();
                for (const other of Object.values(gameState.cardInstances)) {
                  if (other.instanceId === card.instanceId || other.stackId) continue;
                  if (other.x >= ax && other.x < ax + aw && other.y >= ay && other.y < ay + ah) {
                    occupied.add(`${other.x},${other.y}`);
                  }
                }

                // ドロップ位置に最も近い空きスロットを探す
                const maxSlots = maxCols * Math.max(1, Math.ceil(ah / rowStep));
                let bestDist = Infinity;
                let bestX = card.x;
                let bestY = card.y;
                for (let i = 0; i < maxSlots; i++) {
                  const sx = ax + (i % maxCols) * colStep;
                  const sy = ay + Math.floor(i / maxCols) * rowStep;
                  if (!occupied.has(`${sx},${sy}`)) {
                    const dist = (card.x - sx) ** 2 + (card.y - sy) ** 2;
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestX = sx;
                      bestY = sy;
                    }
                  }
                }
                if (bestDist < Infinity) {
                  moveCard(instance.instanceId, bestX, bestY);
                }
                break;
              }
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

  const handleResizeDown = useCallback((dir: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    saveSnapshot();
    resizeRef.current = {
      dir, startX: e.clientX, startY: e.clientY,
      origW: size.width, origH: size.height,
      origCardX: instance.x, origCardY: instance.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [size.width, size.height, instance.x, instance.y, saveSnapshot]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const { dir, startX, startY, origW, origH, origCardX, origCardY } = resizeRef.current;
    const zoom = useUIStore.getState().zoom;
    const dx = (e.clientX - startX) / zoom;
    const dy = (e.clientY - startY) / zoom;
    let w = origW, h = origH, cx = origCardX, cy = origCardY;
    if (dir.includes('e')) w = origW + dx;
    if (dir.includes('w')) { w = origW - dx; cx = origCardX + dx; }
    if (dir.includes('s')) h = origH + dy;
    if (dir.includes('n')) { h = origH - dy; cy = origCardY + dy; }
    w = Math.max(20, w);
    h = Math.max(20, h);
    if (dir.includes('w') && w === 20) cx = origCardX + origW - 20;
    if (dir.includes('n') && h === 20) cy = origCardY + origH - 20;
    resizeCard(instance.instanceId, w, h, cx, cy);
  }, [instance.instanceId, resizeCard]);

  const handleResizeUp = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current) {
      resizeRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, []);

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
      className={`card-component ${isFaceUp ? 'face-up' : 'face-down'} ${instance.locked ? 'locked' : ''} ${isSelected ? 'selected' : ''} ${isOwnerOnly ? 'owner-only' : ''} ${isImageCard ? 'image-card' : ''}`}
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
      {canResize && ['n','s','e','w','ne','nw','se','sw'].map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-${dir}`}
          onPointerDown={(e) => handleResizeDown(dir, e)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
        />
      ))}
      {isFaceUp ? (
        <div className="card-front" style={{ backgroundColor: isImageCard ? 'transparent' : (definition.color as string || '#fff') }}>
          {template.layout.map((field, i) => (
            <CardField key={i} field={field} definition={definition} />
          ))}
          {/* カード名に対応するイラストが存在すれば表示 */}
          {!template.layout.some((f) => f.field === 'illustration' || f.field === '__img' || f.position === 'cover') && (
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
  if (/^(https?:\/\/|data:image\/|blob:)/.test(value)) return true;
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

  const isCover = field.position === 'cover';

  return (
    <div
      className={`card-field card-field-${field.position}`}
      style={{
        fontSize,
        fontWeight: field.bold ? 'bold' : 'normal',
        fontStyle: field.italic ? 'italic' : 'normal',
        color: field.textColor || undefined,
        ...(isImg && field.height && !isCover ? { height: field.height, minHeight: 0 } : {}),
        ...(isCover ? {
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          padding: 0, display: 'flex',
        } : {}),
      }}
    >
      {isImg ? (
        <img
          src={strVal}
          alt=""
          draggable={false}
          className={isCover ? undefined : 'card-field-image'}
          style={isCover ? { width: '100%', height: '100%', objectFit: 'cover' } : undefined}
        />
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
