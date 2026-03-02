import { useCallback, useRef } from 'react';
import type { Area } from '../types';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './AreaOverlay.css';

type DragMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origWidth: number;
  origHeight: number;
}

interface Props {
  area: Area;
}

export function AreaOverlay({ area }: Props) {
  const cellSize = useUIStore((s) => s.cellSize);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const updateArea = useGameStore((s) => s.updateArea);

  const dragRef = useRef<DragState | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 2) return;
    if (area.locked !== false) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const handle = target.closest('.area-resize-handle');
    const mode: DragMode = handle
      ? (handle.getAttribute('data-corner') as DragMode)
      : 'move';

    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: area.x,
      origY: area.y,
      origWidth: area.width,
      origHeight: area.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [area.x, area.y, area.width, area.height, area.locked]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { zoom, cellSize: cs } = useUIStore.getState();
    const d = dragRef.current;

    const dxGrid = Math.round((e.clientX - d.startX) / zoom / cs);
    const dyGrid = Math.round((e.clientY - d.startY) / zoom / cs);

    if (d.mode === 'move') {
      updateArea(area.areaId, {
        x: d.origX + dxGrid,
        y: d.origY + dyGrid,
      });
    } else if (d.mode === 'resize-se') {
      updateArea(area.areaId, {
        width: Math.max(1, d.origWidth + dxGrid),
        height: Math.max(1, d.origHeight + dyGrid),
      });
    } else if (d.mode === 'resize-nw') {
      const newW = Math.max(1, d.origWidth - dxGrid);
      const newH = Math.max(1, d.origHeight - dyGrid);
      updateArea(area.areaId, {
        x: d.origX + d.origWidth - newW,
        y: d.origY + d.origHeight - newH,
        width: newW,
        height: newH,
      });
    } else if (d.mode === 'resize-ne') {
      const newW = Math.max(1, d.origWidth + dxGrid);
      const newH = Math.max(1, d.origHeight - dyGrid);
      updateArea(area.areaId, {
        x: d.origX,
        y: d.origY + d.origHeight - newH,
        width: newW,
        height: newH,
      });
    } else if (d.mode === 'resize-sw') {
      const newW = Math.max(1, d.origWidth - dxGrid);
      const newH = Math.max(1, d.origHeight + dyGrid);
      updateArea(area.areaId, {
        x: d.origX + d.origWidth - newW,
        y: d.origY,
        width: newW,
        height: newH,
      });
    }
  }, [area.areaId, updateArea]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, area.x, area.y, 'area', area.areaId);
  }, [showContextMenu, area.areaId, area.x, area.y]);

  return (
    <div
      className={`area-overlay area-${area.visibility} ${area.locked !== false ? 'area-locked' : ''}`}
      style={{
        left: area.x * cellSize + FIELD_OFFSET,
        top: area.y * cellSize + FIELD_OFFSET,
        width: area.width * cellSize,
        height: area.height * cellSize,
        backgroundColor: area.bgColor || undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      <span className="area-label">{area.name}</span>
      <div className="area-resize-handle" data-corner="resize-nw" style={{ top: -4, left: -4 }} />
      <div className="area-resize-handle" data-corner="resize-ne" style={{ top: -4, right: -4 }} />
      <div className="area-resize-handle" data-corner="resize-sw" style={{ bottom: -4, left: -4 }} />
      <div className="area-resize-handle" data-corner="resize-se" style={{ bottom: -4, right: -4 }} />
    </div>
  );
}
