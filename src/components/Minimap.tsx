import { useMemo, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { FIELD_OFFSET } from '../utils/viewport';
import './Minimap.css';

const MAP_W = 160;
const MAP_H = 100;
const WORLD = 20000;

export function Minimap() {
  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardStacks = useGameStore((s) => s.cardStacks);
  const counters = useGameStore((s) => s.counters);
  const tokens = useGameStore((s) => s.tokens);
  const zoom = useUIStore((s) => s.zoom);
  const panX = useUIStore((s) => s.panX);
  const panY = useUIStore((s) => s.panY);
  const viewportSize = useUIStore((s) => s.viewportSize);
  const setPan = useUIStore((s) => s.setPan);

  const scale = MAP_W / WORLD;

  // ビューポート矩形
  const vpX = panX * scale;
  const vpY = panY * scale;
  const vpW = (viewportSize.width / zoom) * scale;
  const vpH = (viewportSize.height / zoom) * scale;

  // 描画するドット
  const dots = useMemo(() => {
    const items: { x: number; y: number; color: string }[] = [];
    for (const c of Object.values(cardInstances)) {
      if (c.stackId) continue;
      items.push({ x: (c.x + FIELD_OFFSET) * scale, y: (c.y + FIELD_OFFSET) * scale, color: '#6a8' });
    }
    for (const s of Object.values(cardStacks)) {
      items.push({ x: (s.x + FIELD_OFFSET) * scale, y: (s.y + FIELD_OFFSET) * scale, color: '#a86' });
    }
    for (const c of Object.values(counters)) {
      items.push({ x: (c.x + FIELD_OFFSET) * scale, y: (c.y + FIELD_OFFSET) * scale, color: '#88a' });
    }
    for (const t of Object.values(tokens)) {
      items.push({ x: (t.x + FIELD_OFFSET) * scale, y: (t.y + FIELD_OFFSET) * scale, color: t.color });
    }
    return items;
  }, [cardInstances, cardStacks, counters, tokens, scale]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newPanX = mx / scale - viewportSize.width / (2 * zoom);
    const newPanY = my / scale - viewportSize.height / (2 * zoom);
    setPan(newPanX, newPanY);
  }, [scale, zoom, viewportSize, setPan]);

  return (
    <div className="minimap" onClick={handleClick}>
      <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`}>
        {dots.map((d, i) => (
          <rect key={i} x={d.x - 1} y={d.y - 1} width={2} height={2} fill={d.color} />
        ))}
        <rect
          x={vpX} y={vpY} width={Math.max(4, vpW)} height={Math.max(3, vpH)}
          fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={0.5}
        />
      </svg>
    </div>
  );
}
