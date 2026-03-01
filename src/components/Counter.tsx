import { useRef, useCallback, useState } from 'react';
import type { Counter as CounterType } from '../types';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './Counter.css';

interface Props {
  counter: CounterType;
}

export function CounterComponent({ counter }: Props) {
  const updateCounter = useGameStore((s) => s.updateCounter);
  const renameCounter = useGameStore((s) => s.renameCounter);
  const moveCounter = useGameStore((s) => s.moveCounter);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const gridEnabled = useUIStore((s) => s.gridEnabled);
  const cellSize = useUIStore((s) => s.cellSize);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(counter.name);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState(String(counter.value));
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.stopPropagation(); // 常にviewportへの伝播を止める
    if ((e.target as HTMLElement).closest('.counter-btn, .counter-name-input')) return;
    e.preventDefault();
    if (counter.locked) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: counter.x,
      origY: counter.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [counter.x, counter.y, counter.locked]);

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
    moveCounter(counter.counterId, newX, newY);
  }, [counter.counterId, moveCounter, gridEnabled, cellSize]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, counter.x, counter.y, 'counter', counter.counterId);
  }, [counter.counterId, counter.x, counter.y, showContextMenu]);

  return (
    <div
      className={`counter-component ${counter.locked ? 'locked' : ''}`}
      style={{ left: counter.x + FIELD_OFFSET, top: counter.y + FIELD_OFFSET, zIndex: counter.zIndex }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {isEditingName ? (
        <input
          className="counter-name-input"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => { renameCounter(counter.counterId, editName); setIsEditingName(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { renameCounter(counter.counterId, editName); setIsEditingName(false); } }}
          autoFocus
        />
      ) : (
        <div className="counter-name" onDoubleClick={() => setIsEditingName(true)}>
          {counter.name || 'Counter'}
        </div>
      )}
      <div className="counter-controls">
        <button className="counter-btn counter-btn-small" onClick={() => updateCounter(counter.counterId, counter.value - 10)}>−10</button>
        <button className="counter-btn" onClick={() => updateCounter(counter.counterId, counter.value - counter.step)}>−</button>
        {isEditingValue ? (
          <input
            className="counter-value-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => {
              const v = parseInt(editValue, 10);
              if (!isNaN(v)) updateCounter(counter.counterId, Math.max(counter.min, Math.min(counter.max, v)));
              setIsEditingValue(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = parseInt(editValue, 10);
                if (!isNaN(v)) updateCounter(counter.counterId, Math.max(counter.min, Math.min(counter.max, v)));
                setIsEditingValue(false);
              }
            }}
            autoFocus
          />
        ) : (
          <span className="counter-value" onDoubleClick={() => { setEditValue(String(counter.value)); setIsEditingValue(true); }}>{counter.value}</span>
        )}
        <button className="counter-btn" onClick={() => updateCounter(counter.counterId, counter.value + counter.step)}>+</button>
        <button className="counter-btn counter-btn-small" onClick={() => updateCounter(counter.counterId, counter.value + 10)}>+10</button>
      </div>
    </div>
  );
}
