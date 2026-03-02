import Papa from 'papaparse';
import type { CardTemplate, CardTemplateField, CardSizePreset } from '../types';
import { DEFAULT_TEMPLATE } from './cardTemplate';

/**
 * テンプレートCSVパーサー
 * フォーマット: 1行1レイアウトフィールド。テンプレ設定は最初の行に記載。
 * template列が空なら直前のテンプレ名を継承。
 */
export function parseCsvToTemplates(csvText: string): Record<string, CardTemplate> {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const templates: Record<string, CardTemplate> = {};
  let lastTemplateName = 'default';

  for (const row of result.data) {
    const tName = (row.template || '').trim() || lastTemplateName;
    lastTemplateName = tName;

    // テンプレートが未作成なら設定行から初期化
    if (!templates[tName]) {
      const sizePreset = (row.size || 'standard').trim() as CardSizePreset;
      const sizeWidth = row.size_width ? Number(row.size_width) : undefined;
      const sizeHeight = row.size_height ? Number(row.size_height) : undefined;

      templates[tName] = {
        size: {
          preset: sizePreset,
          ...(sizePreset === 'custom' && sizeWidth ? { width: sizeWidth } : {}),
          ...(sizePreset === 'custom' && sizeHeight ? { height: sizeHeight } : {}),
        },
        layout: [],
        back: {
          bgColor: (row.back_color || '#2a2a5a').trim(),
          text: row.back_text !== undefined ? row.back_text.trim() : undefined,
          imageUrl: row.back_image ? row.back_image.trim() : undefined,
        },
        border: {
          color: (row.border_color || '#666').trim(),
          colorField: row.border_color_field ? row.border_color_field.trim() : undefined,
          radius: row.border_radius ? Number(row.border_radius) : 8,
        },
      };
    }

    // フィールド行
    const fieldName = (row.field || '').trim();
    if (fieldName) {
      // position: 明示指定があればそれを使う。なければ y+align から導出（スプレッドシート形式対応）
      let position: CardTemplateField['position'];
      const posVal = (row.position || '').trim();
      if (posVal) {
        position = posVal as CardTemplateField['position'];
      } else {
        const y = Number(row.y) || 0;
        const align = (row.align || '').trim().toLowerCase();
        if (y < 30) {
          position = align === 'right' ? 'top-right' : align === 'left' ? 'top-left' : 'top';
        } else if (y >= 35) {
          position = align === 'right' ? 'bottom-right' : 'bottom';
        } else {
          position = 'center';
        }
      }

      // fontSize: camelCase優先、なければ小文字fontsize（スプレッドシート形式）
      const fontSize = row.fontSize ? Number(row.fontSize) : (row.fontsize ? Number(row.fontsize) : undefined);
      // bold: 大文字TRUE対応
      const boldStr = (row.bold || '').toLowerCase();
      const bold = boldStr === 'true' || boldStr === '1' ? true : undefined;
      const italic = (row.italic || '').toLowerCase() === 'true' || row.italic === '1' ? true : undefined;
      // textColor: textColor列 or color列（スプレッドシート形式）
      const textColor = row.textColor?.trim() || row.color?.trim() || undefined;

      const field: CardTemplateField = {
        field: fieldName,
        position,
        fontSize,
        bold,
        italic,
        shape: (row.shape || undefined) as CardTemplateField['shape'],
        bgColor: row.bgColor ? row.bgColor.trim() : undefined,
        height: row.height ? row.height.trim() : undefined,
        textColor,
      };
      templates[tName].layout.push(field);
    }
  }

  // 最低限defaultが存在するようにする
  if (!templates['default']) {
    templates['default'] = { ...DEFAULT_TEMPLATE, layout: [...DEFAULT_TEMPLATE.layout] };
  }

  return templates;
}

/** テンプレート群をCSV文字列にエクスポート */
export function templatesToCSV(templates: Record<string, CardTemplate>): string {
  const headers = [
    'template', 'size', 'size_width', 'size_height',
    'back_color', 'back_text', 'back_image',
    'border_color', 'border_radius', 'border_color_field',
    'field', 'position', 'fontSize', 'bold', 'italic', 'shape', 'bgColor', 'height',
  ];

  const rows: string[] = [headers.join(',')];

  for (const [name, tmpl] of Object.entries(templates)) {
    const settingCols = [
      name,
      tmpl.size.preset,
      tmpl.size.preset === 'custom' ? String(tmpl.size.width || '') : '',
      tmpl.size.preset === 'custom' ? String(tmpl.size.height || '') : '',
      tmpl.back.bgColor,
      tmpl.back.text || '',
      tmpl.back.imageUrl || '',
      tmpl.border.color || '',
      String(tmpl.border.radius),
      tmpl.border.colorField || '',
    ];

    if (tmpl.layout.length === 0) {
      // レイアウトなしのテンプレ（設定行のみ）
      rows.push([...settingCols, '', '', '', '', '', '', '', ''].join(','));
    } else {
      tmpl.layout.forEach((f, i) => {
        const prefix = i === 0 ? settingCols : [name, '', '', '', '', '', '', '', '', ''];
        const fieldCols = [
          f.field,
          f.position,
          f.fontSize ? String(f.fontSize) : '',
          f.bold ? 'true' : '',
          f.italic ? 'true' : '',
          f.shape || '',
          f.bgColor || '',
          f.height || '',
        ];
        rows.push([...prefix, ...fieldCols].join(','));
      });
    }
  }

  return rows.join('\n');
}
