import Papa from 'papaparse';
import type { Area } from '../types';

/**
 * perPlayer エリアのベースY座標(プレイヤー0のY)を計算する。
 * エリアが縦に重ならないよう、上から順に必要なスペースを確保してずらす。
 */
export function computePerPlayerBaseYs(areas: Area[], numPlayers: number): Map<string, number> {
  const ppAreas = areas
    .filter((a) => a.perPlayer)
    .sort((a, b) => a.y - b.y);

  const result = new Map<string, number>();
  let runningBottom = -Infinity;

  for (const area of ppAreas) {
    const startY = Math.max(area.y, runningBottom);
    result.set(area.areaId, startY);
    runningBottom = startY + numPlayers * area.height;
  }

  return result;
}

export function parseCsvToAreas(csvText: string): Area[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return result.data.map((row) => ({
    areaId: (row.area_id || row.areaId || '').trim(),
    name: (row.name || '').trim(),
    x: Number(row.x) || 0,
    y: Number(row.y) || 0,
    width: Number(row.width) || 2,
    height: Number(row.height) || 2,
    visibility: (['public', 'owner', 'hidden'].includes((row.visibility || '').trim())
      ? (row.visibility || '').trim()
      : 'public') as Area['visibility'],
    perPlayer: (row.per_player || row.perPlayer || '').trim().toLowerCase() === 'true',
    bgColor: (row.bg_color || row.bgColor || '').trim() || undefined,
  }));
}

export function areasToCSV(areas: Area[]): string {
  const headers = ['area_id', 'name', 'x', 'y', 'width', 'height', 'visibility', 'per_player'];
  const rows = areas.map((a) =>
    [a.areaId, a.name, a.x, a.y, a.width, a.height, a.visibility, a.perPlayer].join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}
