import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { DEFAULT_TEMPLATE } from '../utils/cardTemplate';
import type { CardSizePreset, CardTemplateField, CardTemplate } from '../types';
import './TemplateEditor.css';

const POSITIONS = [
  { value: 'top', label: '上' },
  { value: 'top-left', label: '左上' },
  { value: 'top-right', label: '右上' },
  { value: 'center', label: '中央' },
  { value: 'center-left', label: '中左' },
  { value: 'center-right', label: '中右' },
  { value: 'bottom', label: '下' },
  { value: 'bottom-left', label: '左下' },
  { value: 'bottom-right', label: '右下' },
] as const;

export function TemplateEditor() {
  const cardTemplates = useGameStore((s) => s.cardTemplates);
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const setCardTemplate = useGameStore((s) => s.setCardTemplate);
  const setCardTemplates = useGameStore((s) => s.setCardTemplates);
  const addToast = useUIStore((s) => s.addToast);

  const [expanded, setExpanded] = useState(false);
  const [selectedName, setSelectedName] = useState('default');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  const templateNames = Object.keys(cardTemplates);
  const template = cardTemplates[selectedName] || cardTemplates['default'] || DEFAULT_TEMPLATE;

  // CSVの列名一覧
  const csvColumns = cardDefinitions.length > 0
    ? Object.keys(cardDefinitions[0]).filter((k) => k !== 'id' && k !== 'count' && k !== 'template')
    : [];

  if (!expanded) {
    return (
      <div className="te-collapsed">
        <div className="te-collapsed-info">
          <span className="te-collapsed-size">{templateNames.length}個</span>
          <span className="te-collapsed-fields">
            {templateNames.slice(0, 3).join(', ')}{templateNames.length > 3 ? '...' : ''}
          </span>
        </div>
        <button className="te-expand-btn" onClick={() => setExpanded(true)}>
          編集する
        </button>
      </div>
    );
  }

  const save = (updated: CardTemplate) => {
    setCardTemplate(selectedName, updated);
  };

  const updateSize = (preset: CardSizePreset) => {
    save({ ...template, size: { ...template.size, preset } });
    addToast(`カードサイズ: ${preset}`);
  };

  const updateCustomSize = (key: 'width' | 'height', val: number) => {
    save({
      ...template,
      size: { preset: 'custom', width: template.size.width || 126, height: template.size.height || 176, [key]: val },
    });
  };

  const updateBackColor = (bgColor: string) => save({ ...template, back: { ...template.back, bgColor } });
  const updateBackText = (text: string) => save({ ...template, back: { ...template.back, text } });
  const updateBackImage = (imageUrl: string) => save({ ...template, back: { ...template.back, imageUrl: imageUrl || undefined } });
  const updateBorderColor = (color: string) => save({ ...template, border: { ...template.border, color } });
  const updateBorderColorField = (colorField: string) => save({ ...template, border: { ...template.border, colorField: colorField || undefined } });
  const updateBorderRadius = (radius: number) => save({ ...template, border: { ...template.border, radius } });

  const updateField = (index: number, updates: Partial<CardTemplateField>) => {
    const newLayout = [...template.layout];
    newLayout[index] = { ...newLayout[index], ...updates };
    save({ ...template, layout: newLayout });
  };

  const addField = () => {
    const usedFields = template.layout.map((f) => f.field);
    const nextField = csvColumns.find((c) => !usedFields.includes(c)) || 'name';
    const usedPositions = template.layout.map((f) => f.position);
    const nextPos = POSITIONS.find((p) => !usedPositions.includes(p.value))?.value || 'center';
    save({
      ...template,
      layout: [...template.layout, { field: nextField, position: nextPos as CardTemplateField['position'], fontSize: 11 }],
    });
  };

  const removeField = (index: number) => {
    save({ ...template, layout: template.layout.filter((_, i) => i !== index) });
  };

  const moveField = (index: number, dir: -1 | 1) => {
    const newLayout = [...template.layout];
    const target = index + dir;
    if (target < 0 || target >= newLayout.length) return;
    [newLayout[index], newLayout[target]] = [newLayout[target], newLayout[index]];
    save({ ...template, layout: newLayout });
  };

  const handleNewTemplate = () => {
    let name = 'template_' + (templateNames.length + 1);
    let i = 1;
    while (cardTemplates[name]) { name = `template_${templateNames.length + (++i)}`; }
    setCardTemplate(name, { ...DEFAULT_TEMPLATE, layout: [...DEFAULT_TEMPLATE.layout] });
    setSelectedName(name);
    addToast(`テンプレート「${name}」を作成`);
  };

  const handleDuplicate = () => {
    const name = selectedName + '_copy';
    const unique = cardTemplates[name] ? name + '_' + Date.now() : name;
    setCardTemplate(unique, JSON.parse(JSON.stringify(template)));
    setSelectedName(unique);
    addToast(`テンプレート「${unique}」を複製`);
  };

  const handleDelete = () => {
    if (selectedName === 'default') { addToast('defaultは削除できません', 'warning'); return; }
    if (templateNames.length <= 1) { addToast('最後のテンプレートは削除できません', 'warning'); return; }
    const updated = { ...cardTemplates };
    delete updated[selectedName];
    setCardTemplates(updated);
    setSelectedName('default');
    addToast(`テンプレート「${selectedName}」を削除`);
  };

  const handleRenameStart = () => {
    if (selectedName === 'default') { addToast('defaultはリネームできません', 'warning'); return; }
    setRenameValue(selectedName);
    setIsRenaming(true);
  };

  const handleRenameConfirm = () => {
    const newName = renameValue.trim();
    if (!newName || newName === selectedName) { setIsRenaming(false); return; }
    if (cardTemplates[newName]) { addToast('同名のテンプレートが存在します', 'warning'); return; }
    const updated = { ...cardTemplates };
    updated[newName] = updated[selectedName];
    delete updated[selectedName];
    setCardTemplates(updated);
    setSelectedName(newName);
    setIsRenaming(false);
    addToast(`リネーム: ${selectedName} → ${newName}`);
  };

  return (
    <div className="template-editor">
      {/* --- テンプレート選択 --- */}
      <div className="te-template-selector">
        {isRenaming ? (
          <div className="te-rename-row">
            <input type="text" className="te-rename-input" value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setIsRenaming(false); }}
              autoFocus />
            <button className="te-field-btn" onClick={handleRenameConfirm}>✓</button>
            <button className="te-field-btn" onClick={() => setIsRenaming(false)}>✕</button>
          </div>
        ) : (
          <>
            <select className="te-template-select" value={selectedName}
              onChange={(e) => setSelectedName(e.target.value)}>
              {templateNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="te-field-btn" onClick={handleNewTemplate} title="新規">+</button>
            <button className="te-field-btn" onClick={handleDuplicate} title="複製">⧉</button>
            <button className="te-field-btn" onClick={handleRenameStart} title="リネーム">✎</button>
            <button className="te-field-btn te-field-btn-del" onClick={handleDelete} title="削除">🗑</button>
          </>
        )}
      </div>

      {/* --- サイズ --- */}
      <div className="te-section-title">サイズ</div>
      <div className="te-row">
        <label>プリセット</label>
        <select value={template.size.preset} onChange={(e) => updateSize(e.target.value as CardSizePreset)}>
          <option value="standard">Standard (126×176)</option>
          <option value="mini">Mini (88×126)</option>
          <option value="tarot">Tarot (140×240)</option>
          <option value="custom">カスタム</option>
        </select>
      </div>
      {template.size.preset === 'custom' && (
        <div className="te-row">
          <label>W×H</label>
          <input type="number" className="te-num" value={template.size.width || 126} min={40} max={400}
            onChange={(e) => updateCustomSize('width', Number(e.target.value))} />
          <span className="te-x">×</span>
          <input type="number" className="te-num" value={template.size.height || 176} min={40} max={600}
            onChange={(e) => updateCustomSize('height', Number(e.target.value))} />
        </div>
      )}

      {/* --- 裏面 --- */}
      <div className="te-section-title">裏面</div>
      <div className="te-row">
        <label>背景色</label>
        <input type="color" value={template.back.bgColor} onChange={(e) => updateBackColor(e.target.value)} />
      </div>
      <div className="te-row">
        <label>テキスト</label>
        <input type="text" value={template.back.text || ''} onChange={(e) => updateBackText(e.target.value)} maxLength={4} placeholder="例: ★" />
      </div>
      <div className="te-row">
        <label>画像URL</label>
        <input type="text" value={template.back.imageUrl || ''} onChange={(e) => updateBackImage(e.target.value)} placeholder="https://..." />
      </div>

      {/* --- 枠線 --- */}
      <div className="te-section-title">枠線</div>
      <div className="te-row">
        <label>枠色</label>
        <input type="color" value={template.border.color || '#666666'} onChange={(e) => updateBorderColor(e.target.value)} />
      </div>
      <div className="te-row">
        <label>色列</label>
        <select value={template.border.colorField || ''} onChange={(e) => updateBorderColorField(e.target.value)}>
          <option value="">固定色を使用</option>
          {csvColumns.map((col) => (
            <option key={col} value={col}>{col}</option>
          ))}
        </select>
      </div>
      <div className="te-row">
        <label>角丸 {template.border.radius}px</label>
        <input type="range" min={0} max={20} value={template.border.radius} onChange={(e) => updateBorderRadius(Number(e.target.value))} />
      </div>

      {/* --- レイアウト --- */}
      <div className="te-section-title">
        レイアウト
        <button className="te-add-btn" onClick={addField} title="フィールド追加">+</button>
      </div>
      {template.layout.map((field, i) => (
        <div key={i} className="te-field-row">
          <div className="te-field-header">
            <select className="te-field-name" value={field.field}
              onChange={(e) => updateField(i, { field: e.target.value })}>
              {csvColumns.length > 0 ? (
                csvColumns.map((col) => <option key={col} value={col}>{col}</option>)
              ) : (
                <option value={field.field}>{field.field}</option>
              )}
            </select>
            <select className="te-field-pos" value={field.position}
              onChange={(e) => updateField(i, { position: e.target.value as CardTemplateField['position'] })}>
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <button className="te-field-btn" onClick={() => moveField(i, -1)} title="上へ">↑</button>
            <button className="te-field-btn" onClick={() => moveField(i, 1)} title="下へ">↓</button>
            <button className="te-field-btn te-field-btn-del" onClick={() => removeField(i)} title="削除">×</button>
          </div>
          <div className="te-field-options">
            <label className="te-opt">
              <span>サイズ</span>
              <input type="number" className="te-num-sm" value={field.fontSize || 12} min={6} max={40}
                onChange={(e) => updateField(i, { fontSize: Number(e.target.value) })} />
            </label>
            <label className="te-opt te-opt-check">
              <input type="checkbox" checked={!!field.bold}
                onChange={(e) => updateField(i, { bold: e.target.checked })} />
              <span>B</span>
            </label>
            <label className="te-opt te-opt-check">
              <input type="checkbox" checked={!!field.italic}
                onChange={(e) => updateField(i, { italic: e.target.checked })} />
              <span style={{ fontStyle: 'italic' }}>I</span>
            </label>
            <label className="te-opt">
              <span>形状</span>
              <select className="te-sel-sm" value={field.shape || ''}
                onChange={(e) => updateField(i, { shape: (e.target.value || undefined) as CardTemplateField['shape'] })}>
                <option value="">なし</option>
                <option value="circle">丸</option>
                <option value="square">四角</option>
              </select>
            </label>
            {field.shape && (
              <label className="te-opt">
                <span>色</span>
                <input type="color" className="te-color-sm" value={field.bgColor || '#cccccc'}
                  onChange={(e) => updateField(i, { bgColor: e.target.value })} />
              </label>
            )}
            <label className="te-opt">
              <span>高さ</span>
              <input type="text" className="te-num-sm" value={field.height || ''} placeholder="auto"
                style={{ width: 44 }}
                onChange={(e) => updateField(i, { height: e.target.value || undefined })} />
            </label>
          </div>
        </div>
      ))}

      <button className="sidebar-btn" onClick={() => setExpanded(false)} style={{ marginTop: 8 }}>閉じる</button>
    </div>
  );
}
