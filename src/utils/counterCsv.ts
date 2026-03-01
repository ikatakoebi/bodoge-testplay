export interface CounterDef {
  id: string;
  name: string;
  min: number;
  max: number;
  default: number;
  step: number;
  perPlayer: boolean;
}

export function parseCounterCsv(text: string): CounterDef[] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(/[,\t]/).map((h) => h.trim().toLowerCase());
  const results: CounterDef[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,\t]/).map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = cols[j] || ''; });

    results.push({
      id: row.id || `counter_${i}`,
      name: row.name || row.id || `Counter ${i}`,
      min: Number(row.min) || -999,
      max: Number(row.max) || 999,
      default: Number(row.default) || 0,
      step: Number(row.step) || 1,
      perPlayer: row.per_player === 'true',
    });
  }
  return results;
}
