import { useRef, useCallback } from 'react';
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

export function CardComponent({ instance, definition, template, onDragEnd }: Props) {
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
    const { zoom, gridEnabled: ge, cellSize: cs, setSnapGuides } = useUIStore.getState();
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
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
      const dMap = new Map(state.cardDefinitions.map((d) => [d.id, d]));

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
  }, [instance.instanceId, size.width, size.height, moveCard, moveCardsTo]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
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
        onDragEnd?.(instance.instanceId);
      }
    }
  }, [instance.instanceId, onDragEnd]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, instance.x, instance.y, 'card', instance.instanceId);
  }, [instance.instanceId, instance.x, instance.y, showContextMenu]);

  const borderColor = template.border.colorField
    ? (definition[template.border.colorField] as string) || template.border.color || '#666'
    : template.border.color || '#666';

  const isFaceUp = instance.face === 'up' && (
    instance.visibility === 'public' ||
    (instance.visibility === 'owner' && instance.ownerId === currentPlayerId)
  );

  return (
    <div
      className={`card-component ${isFaceUp ? 'face-up' : 'face-down'} ${instance.locked ? 'locked' : ''} ${isSelected ? 'selected' : ''}`}
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
        <div className="card-front">
          {template.layout.map((field, i) => (
            <CardField key={i} field={field} definition={definition} />
          ))}
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

  return (
    <div
      className={`card-field card-field-${field.position}`}
      style={{
        fontSize: field.fontSize || 12,
        fontWeight: field.bold ? 'bold' : 'normal',
        fontStyle: field.italic ? 'italic' : 'normal',
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
