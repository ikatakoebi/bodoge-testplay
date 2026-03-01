import { useRef, useCallback } from 'react';
import type { ImageObject } from '../types';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './ImageOverlay.css';

interface Props {
  image: ImageObject;
}

type DragMode = 'move' | 'resize-se';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
}

export function ImageOverlay({ image }: Props) {
  const moveImage = useGameStore((s) => s.moveImage);
  const resizeImage = useGameStore((s) => s.resizeImage);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const showContextMenu = useUIStore((s) => s.showContextMenu);

  const dragRef = useRef<DragState | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    e.preventDefault();
    e.stopPropagation();
    if (image.locked) return;
    saveSnapshot();

    const target = e.target as HTMLElement;
    const isResize = target.classList.contains('image-resize-handle');
    const mode: DragMode = isResize ? 'resize-se' : 'move';

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: image.x,
      origY: image.y,
      origWidth: image.width,
      origHeight: image.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [image.x, image.y, image.width, image.height, image.locked, saveSnapshot]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { zoom } = useUIStore.getState();
    const d = dragRef.current;
    const dx = (e.clientX - d.startX) / zoom;
    const dy = (e.clientY - d.startY) / zoom;

    if (d.mode === 'move') {
      moveImage(image.imageId, d.origX + dx, d.origY + dy);
    } else {
      resizeImage(image.imageId, Math.max(30, d.origWidth + dx), Math.max(30, d.origHeight + dy));
    }
  }, [image.imageId, moveImage, resizeImage]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, image.x, image.y, 'image', image.imageId);
  }, [showContextMenu, image.imageId, image.x, image.y]);

  return (
    <div
      className={`image-overlay ${image.locked ? 'image-locked' : ''}`}
      style={{
        left: image.x + FIELD_OFFSET,
        top: image.y + FIELD_OFFSET,
        width: image.width,
        height: image.height,
        zIndex: image.zIndex,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      <img src={image.url} alt="" draggable={false} className="image-content" />
      {!image.locked && <div className="image-resize-handle" />}
    </div>
  );
}
