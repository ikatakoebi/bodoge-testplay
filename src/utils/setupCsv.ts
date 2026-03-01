import Papa from 'papaparse';
import type { SetupAction } from './setup';

// setup シート CSV → SetupAction[] 変換
// CSV列: action, to, from, filter_tag, count, perPlayer, faceUp, when, component
export function parseSetupCsv(csvText: string): SetupAction[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  return result.data.flatMap((row) => {
    const action = row['action']?.trim();
    if (!action) return [];

    const entry: SetupAction = { action: action as SetupAction['action'] };

    if (row['to']?.trim()) entry.to = row['to'].trim();
    if (row['from']?.trim()) entry.from = row['from'].trim();
    if (row['when']?.trim()) entry.when = row['when'].trim();
    if (row['component']?.trim()) entry.component = row['component'].trim();

    const filterTag = row['filter_tag']?.trim();
    if (filterTag) entry.filter = { tag: filterTag };

    const countRaw = row['count']?.trim();
    if (countRaw) entry.count = isNaN(Number(countRaw)) ? 1 : Number(countRaw);

    if (row['perPlayer']?.trim() === 'true') entry.perPlayer = true;
    if (row['faceUp']?.trim() === 'true') entry.faceUp = true;

    return [entry];
  });
}
