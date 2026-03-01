import Papa from 'papaparse';
import type { CardDefinition } from '../types';

export function parseCsvToCards(csvText: string): CardDefinition[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (result.errors.length > 0) {
    console.warn('CSV parse warnings:', result.errors);
  }

  return result.data.map((row) => {
    const card: CardDefinition = {
      id: '',
      name: '',
    };
    for (const [key, value] of Object.entries(row)) {
      const trimmedKey = key.trim();
      const trimmedValue = typeof value === 'string' ? value.trim() : value;
      // 数値っぽい値は数値に変換
      if (trimmedValue !== '' && !isNaN(Number(trimmedValue))) {
        card[trimmedKey] = Number(trimmedValue);
      } else {
        card[trimmedKey] = trimmedValue;
      }
    }
    return card;
  });
}

// count列に基づいてカード定義を展開
export function expandCardDefinitions(definitions: CardDefinition[]): CardDefinition[] {
  const expanded: CardDefinition[] = [];
  for (const def of definitions) {
    const count = typeof def.count === 'number' ? def.count : 1;
    for (let i = 0; i < count; i++) {
      expanded.push({ ...def });
    }
  }
  return expanded;
}
