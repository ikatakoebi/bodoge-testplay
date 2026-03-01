import { useRef, useCallback } from 'react';
import type { Token } from '../types';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './TokenComponent.css';

interface Props {
  token: Token;
}

export function TokenComponent({ token }: Props) {
  const moveToken = useGameStore((s) => s.moveToken);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    if (token.locked) return;
    saveSnapshot();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: token.x, origY: token.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [token.x, token.y, token.locked, saveSnapshot]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { zoom } = useUIStore.getState();
    const dx = (e.clientX - dragRef.current.startX) / zoom;
    const dy = (e.clientY - dragRef.current.startY) / zoom;
    moveToken(token.tokenId, dragRef.current.origX + dx, dragRef.current.origY + dy);
  }, [token.tokenId, moveToken]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, token.x, token.y, 'token', token.tokenId);
  }, [showContextMenu, token.tokenId, token.x, token.y]);

  return (
    <div
      className={`token-component token-${token.shape} ${token.locked ? 'token-locked' : ''}`}
      style={{
        left: token.x + FIELD_OFFSET - token.size / 2,
        top: token.y + FIELD_OFFSET - token.size / 2,
        width: token.size,
        height: token.size,
        backgroundColor: token.color,
        zIndex: token.zIndex,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
      title={token.label}
    >
      {token.label && <span className="token-label">{token.label}</span>}
    </div>
  );
}
