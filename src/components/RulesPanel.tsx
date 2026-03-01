import { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import './RulesPanel.css';

export function RulesPanel() {
  const rulesText = useGameStore((s) => s.rulesText);
  const setRulesText = useGameStore((s) => s.setRulesText);
  const addLog = useGameStore((s) => s.addLog);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const handleEdit = useCallback(() => {
    setDraft(rulesText);
    setIsEditing(true);
  }, [rulesText]);

  const handleSave = useCallback(() => {
    setRulesText(draft);
    setIsEditing(false);
    addLog('ルールテキストを更新した');
  }, [draft, setRulesText, addLog]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        setRulesText(text);
        addLog(`ルール読み込み: ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setRulesText, addLog]);

  return (
    <div className="rules-panel">
      <div className="rules-header">
        {!isEditing && (
          <>
            <button className="sidebar-btn" onClick={handleEdit}>
              {rulesText ? '編集' : '作成'}
            </button>
            <label className="sidebar-btn">
              読込
              <input type="file" accept=".md,.txt" onChange={handleFile} hidden />
            </label>
          </>
        )}
      </div>
      {isEditing ? (
        <div className="rules-editor">
          <textarea
            className="rules-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ルールテキストを入力（Markdownも可）..."
            rows={10}
          />
          <div className="rules-editor-actions">
            <button className="sidebar-btn" onClick={handleSave}>保存</button>
            <button className="sidebar-btn" onClick={() => setIsEditing(false)}>キャンセル</button>
          </div>
        </div>
      ) : rulesText ? (
        <div className="rules-content">
          {rulesText.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h4 key={i} className="rules-h1">{line.slice(2)}</h4>;
            if (line.startsWith('## ')) return <h5 key={i} className="rules-h2">{line.slice(3)}</h5>;
            if (line.startsWith('- ')) return <div key={i} className="rules-li">{line}</div>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} className="rules-p">{line}</p>;
          })}
        </div>
      ) : (
        <div className="rules-empty">ルールテキストなし</div>
      )}
    </div>
  );
}
