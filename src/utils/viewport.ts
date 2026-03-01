import { useUIStore } from '../store/uiStore';

// グリッドの中心をフィールド座標(0,0)にするためのオフセット
// canvasは20000x20000pxなので中心は10000
export const FIELD_OFFSET = 10000;

export function screenToField(
  clientX: number,
  clientY: number,
  viewportEl: HTMLElement,
): { x: number; y: number } {
  const { zoom, panX, panY } = useUIStore.getState();
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / zoom + panX - FIELD_OFFSET,
    y: (clientY - rect.top) / zoom + panY - FIELD_OFFSET,
  };
}
