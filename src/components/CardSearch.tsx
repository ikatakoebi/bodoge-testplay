import { useState, useMemo } from 'react';
import { useGameStore } from '../store/gameStore';
import { getCardSize, resolveTemplate } from '../utils/cardTemplate';
import { FIELD_OFFSET } from '../utils/viewport';
import { useUIStore } from '../store/uiStore';
import './CardSearch.css';

export function CardSearch() {
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardTemplates = useGameStore((s) => s.cardTemplates);
  const addCardInstances = useGameStore((s) => s.addCardInstances);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const addLog = useGameStore((s) => s.addLog);

  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim() || cardDefinitions.length === 0) return [];
    const q = query.toLowerCase();
    return cardDefinitions.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      Object.values(d).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [query, cardDefinitions]);

  // カードIDごとの現在枚数
  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inst of Object.values(cardInstances)) {
      map[inst.definitionId] = (map[inst.definitionId] || 0) + 1;
    }
    return map;
  }, [cardInstances]);

  const handleAddCard = (defId: string) => {
    const def = cardDefinitions.find((d) => d.id === defId);
    if (!def) return;
    saveSnapshot();
    addCardInstances([def]);
    addLog(`カード「${def.name}」を追加した`);
  };

  const handleFocusCard = (defId: string) => {
    const inst = Object.values(cardInstances).find((c) => c.definitionId === defId);
    if (!inst) return;
    const def = cardDefinitions.find((d) => d.id === defId);
    const tmpl = resolveTemplate(cardTemplates, def?.template as string | undefined);
    const size = getCardSize(tmpl);
    const { viewportSize, zoom } = useUIStore.getState();
    const newPanX = inst.x + FIELD_OFFSET + size.width / 2 - viewportSize.width / (2 * zoom);
    const newPanY = inst.y + FIELD_OFFSET + size.height / 2 - viewportSize.height / (2 * zoom);
    useUIStore.getState().setPan(newPanX, newPanY);
  };

  if (cardDefinitions.length === 0) {
    return <div className="card-search-empty">CSVを読み込むとカード検索できます</div>;
  }

  return (
    <div className="card-search">
      <input
        className="card-search-input"
        type="text"
        placeholder="カード名で検索..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.length > 0 && (
        <div className="card-search-results">
          {results.map((d) => (
            <div key={d.id} className="card-search-item">
              <div className="card-search-info">
                <span className="card-search-name">{d.name}</span>
                <span className="card-search-count">x{countMap[d.id] || 0}</span>
              </div>
              <div className="card-search-actions">
                {(countMap[d.id] || 0) > 0 && (
                  <button className="card-search-btn" onClick={() => handleFocusCard(d.id)} title="カードにフォーカス">
                    👁
                  </button>
                )}
                <button className="card-search-btn" onClick={() => handleAddCard(d.id)} title="フィールドに追加">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
