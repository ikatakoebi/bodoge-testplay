import { useRef, useCallback, useState } from 'react';
import type { Memo } from '../types';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './MemoComponent.css';

const MEMO_COLORS = ['#fff9c4', '#c8e6c9', '#bbdefb', '#f8bbd0', '#ffe0b2', '#e1bee7'];

interface Props {
  memo: Memo;
}

export function MemoComponent({ memo }: Props) {
  const moveMemo = useGameStore((s) => s.moveMemo);
  const resizeMemo = useGameStore((s) => s.resizeMemo);
  const updateMemoText = useGameStore((s) => s.updateMemoText);
  const updateMemoColor = useGameStore((s) => s.updateMemoColor);
  const removeMemo = useGameStore((s) => s.removeMemo);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const [isEditing, setIsEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.stopPropagation(); // 常にviewportへの伝播を止める（パン防止）
    const target = e.target as HTMLElement;
    if (target.closest('.memo-textarea, .memo-color-btn, .memo-color-picker, .memo-delete-btn, .memo-resize-handle')) return;
    e.preventDefault();
    if (memo.locked) return;
    saveSnapshot();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: memo.x,
      origY: memo.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [memo.x, memo.y, memo.locked, saveSnapshot]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { zoom } = useUIStore.getState();
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
    moveMemo(memo.memoId, dragRef.current.origX + dx, dragRef.current.origY + dy);
  }, [memo.memoId, moveMemo]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, memo.x, memo.y, 'memo', memo.memoId);
  }, [showContextMenu, memo.memoId, memo.x, memo.y]);

  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (memo.locked) return;
    saveSnapshot();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: memo.width, origH: memo.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [memo.width, memo.height, memo.locked, saveSnapshot]);

  const handleResizePointerMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const { zoom } = useUIStore.getState();
    const dx = (e.clientX - resizeRef.current.startX) / zoom;
    const dy = (e.clientY - resizeRef.current.startY) / zoom;
    const newW = Math.max(80, resizeRef.current.origW + dx);
    const newH = Math.max(40, resizeRef.current.origH + dy);
    resizeMemo(memo.memoId, newW, newH);
  }, [memo.memoId, resizeMemo]);

  const handleResizePointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const handleDoubleClick = useCallback(() => {
    if (!memo.locked) setIsEditing(true);
  }, [memo.locked]);

  return (
    <div
      className={`memo-component ${memo.locked ? 'memo-locked' : ''}`}
      style={{
        left: memo.x + FIELD_OFFSET,
        top: memo.y + FIELD_OFFSET,
        width: memo.width,
        minHeight: memo.height,
        backgroundColor: memo.color,
        zIndex: memo.zIndex,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      <div className="memo-header">
        {memo.author && <span className="memo-author">{memo.author}</span>}
        <button className="memo-color-btn" onClick={() => setShowColors(!showColors)} title="色変更">
          ●
        </button>
        <button className="memo-delete-btn" onClick={() => { saveSnapshot(); removeMemo(memo.memoId); }} title="削除">
          ×
        </button>
      </div>
      {showColors && (
        <div className="memo-color-picker">
          {MEMO_COLORS.map((c) => (
            <button
              key={c}
              className={`memo-color-option ${c === memo.color ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => { updateMemoColor(memo.memoId, c); setShowColors(false); }}
            />
          ))}
        </div>
      )}
      {isEditing ? (
        <textarea
          className="memo-textarea"
          value={memo.text}
          onChange={(e) => updateMemoText(memo.memoId, e.target.value)}
          onBlur={() => setIsEditing(false)}
          autoFocus
          placeholder="メモを入力..."
        />
      ) : (
        <div className="memo-text" onDoubleClick={handleDoubleClick}>
          {memo.text || 'ダブルクリックで編集...'}
        </div>
      )}
      {!memo.locked && (
        <div
          className="memo-resize-handle"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
        />
      )}
    </div>
  );
}
