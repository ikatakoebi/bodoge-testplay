import { useRef, useCallback, useEffect } from 'react';
import type { CardStack as CardStackType, CardTemplate, CardTemplateField } from '../types';
import { getCardSize } from '../utils/cardTemplate';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './CardStack.css';

interface Props {
  stack: CardStackType;
  template: CardTemplate;
  onDragEnd?: (stackId: string) => void;
}

export function CardStackComponent({ stack, template, onDragEnd }: Props) {
  const moveStack = useGameStore((s) => s.moveStack);
  const bringStackToFront = useGameStore((s) => s.bringStackToFront);
  const drawFromStack = useGameStore((s) => s.drawFromStack);
  const flipCard = useGameStore((s) => s.flipCard);
  const moveCard = useGameStore((s) => s.moveCard);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const gridEnabled = useUIStore((s) => s.gridEnabled);
  const cellSize = useUIStore((s) => s.cellSize);

  const size = getCardSize(template);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const drawOffsetRef = useRef(0);
  const prevCountRef = useRef(stack.cardInstanceIds.length);

  // カードが戻ってきたらオフセットリセット
  useEffect(() => {
    if (stack.cardInstanceIds.length > prevCountRef.current) {
      drawOffsetRef.current = 0;
    }
    prevCountRef.current = stack.cardInstanceIds.length;
  }, [stack.cardInstanceIds.length]);

  // 一番上のカードがpeek済みかチェック（ownerの場合は自分のみ表示）
  const topCardId = stack.cardInstanceIds[0];
  const topCard = topCardId ? cardInstances[topCardId] : null;
  const isPeeked = topCard && topCard.face === 'up' && (
    topCard.visibility === 'public' ||
    (topCard.visibility === 'owner' && topCard.ownerId === currentPlayerId)
  );
  const topDef = isPeeked ? cardDefinitions.find((d) => d.id === topCard.definitionId) : null;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    bringStackToFront(stack.stackId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: stack.x,
      origY: stack.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [stack.stackId, stack.x, stack.y, bringStackToFront]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { zoom } = useUIStore.getState();
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
    let newX = dragRef.current.origX + dx;
    let newY = dragRef.current.origY + dy;

    if (gridEnabled) {
      newX = Math.round(newX / cellSize) * cellSize;
      newY = Math.round(newY / cellSize) * cellSize;
    }

    moveStack(stack.stackId, newX, newY);
  }, [stack.stackId, moveStack, gridEnabled, cellSize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY } = dragRef.current;
    dragRef.current = null;

    const isClick = Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5;
    if (isClick && stack.cardInstanceIds.length > 0) {
      saveSnapshot();
      const drawn = drawFromStack(stack.stackId, 1);
      if (drawn.length > 0) {
        const offset = drawOffsetRef.current++;
        moveCard(drawn[0].instanceId, stack.x + size.width + 10 + offset * 28, stack.y);
        if (e.ctrlKey && e.shiftKey) {
          // Ctrl+Shift+クリック: オープンで引く（全員に見える）
          flipCard(drawn[0].instanceId, 'public', null);
        } else if (e.ctrlKey) {
          // Ctrl+クリック: 裏向きで引く
          flipCard(drawn[0].instanceId, 'hidden', null);
        } else {
          // 単クリック: 押した人のカードとしてめくる（自分だけ見える）
          flipCard(drawn[0].instanceId, 'owner', currentPlayerId);
        }
      }
    } else {
      onDragEnd?.(stack.stackId);
    }
  }, [stack.stackId, stack.x, stack.y, stack.cardInstanceIds.length, size.width,
      drawFromStack, flipCard, moveCard, saveSnapshot, onDragEnd, currentPlayerId]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, stack.x, stack.y, 'stack', stack.stackId);
  }, [stack.stackId, stack.x, stack.y, showContextMenu]);

  const isEmpty = stack.cardInstanceIds.length === 0;

  return (
    <div
      className={`card-stack ${isPeeked ? 'card-stack-peeked' : ''} ${isEmpty ? 'card-stack-empty' : ''}`}
      style={{
        left: stack.x + FIELD_OFFSET,
        top: stack.y + FIELD_OFFSET,
        width: size.width,
        height: size.height,
        zIndex: stack.zIndex,
        borderRadius: template.border.radius,
        backgroundColor: isEmpty ? 'transparent' : isPeeked ? '#fff' : template.back.bgColor,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {isEmpty ? (
        <div className="stack-empty-label">空</div>
      ) : isPeeked && topDef ? (
        <div className="stack-peek-face">
          {template.layout.map((field, i) => {
            const value = topDef[field.field];
            if (value === undefined || value === '') return null;
            return (
              <StackCardField key={i} field={field} value={String(value)} />
            );
          })}
        </div>
      ) : (
        <>
          <div className="stack-back-text">{template.back.text || ''}</div>
        </>
      )}
      {!isEmpty && <div className="stack-count">{stack.cardInstanceIds.length}</div>}
    </div>
  );
}

function StackCardField({ field, value }: { field: CardTemplateField; value: string }) {
  return (
    <div
      className={`card-field card-field-${field.position}`}
      style={{
        fontSize: field.fontSize || 12,
        fontWeight: field.bold ? 'bold' : 'normal',
        fontStyle: field.italic ? 'italic' : 'normal',
      }}
    >
      {field.shape === 'circle' ? (
        <span className="card-field-badge" style={{ backgroundColor: field.bgColor || '#ccc' }}>
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  );
}
