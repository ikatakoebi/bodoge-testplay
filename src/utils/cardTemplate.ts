import type { CardTemplate } from '../types';

const CARD_SIZE_PRESETS: Record<string, { width: number; height: number }> = {
  standard: { width: 126, height: 176 },
  mini: { width: 88, height: 126 },
  tarot: { width: 140, height: 240 },
};

export const DEFAULT_TEMPLATE: CardTemplate = {
  size: { preset: 'standard' },
  layout: [
    { field: 'name', position: 'top', fontSize: 13, bold: true },
    { field: 'cost', position: 'top-right', fontSize: 12, shape: 'circle', bgColor: '#f0c040' },
    { field: 'image', position: 'center', height: '60' },
    { field: 'text', position: 'bottom', fontSize: 10 },
  ],
  back: {
    bgColor: '#2a2a5a',
    text: '★',
  },
  border: {
    colorField: 'color',
    color: '#666',
    radius: 8,
  },
};

export function getCardSize(template: CardTemplate): { width: number; height: number } {
  if (template.size.preset === 'custom' && template.size.width && template.size.height) {
    return { width: template.size.width, height: template.size.height };
  }
  return CARD_SIZE_PRESETS[template.size.preset] || CARD_SIZE_PRESETS.standard;
}

/** カード定義のtemplate名からテンプレートを解決。見つからなければdefault→DEFAULT_TEMPLATE */
export function resolveTemplate(
  templates: Record<string, CardTemplate>,
  templateName: string | undefined,
): CardTemplate {
  const name = templateName || 'default';
  return templates[name] || templates['default'] || DEFAULT_TEMPLATE;
}
