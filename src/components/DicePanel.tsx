import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import './DicePanel.css';

export function DicePanel() {
  const rollDice = useGameStore((s) => s.rollDice);
  const addLog = useGameStore((s) => s.addLog);
  const diceResults = useGameStore((s) => s.diceResults);

  const [count, setCount] = useState(2);
  const [faces, setFaces] = useState(6);

  const handleRoll = () => {
    const result = rollDice(count, faces);
    const total = result.values.reduce((a, b) => a + b, 0);
    addLog(`${count}D${faces} = [${result.values.join(', ')}] 合計${total}`);
  };

  const latestResults = diceResults.slice(-5).reverse();

  return (
    <div className="dice-panel">
      <div className="dice-controls">
        <select className="dice-select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="dice-d">D</span>
        <select className="dice-select" value={faces} onChange={(e) => setFaces(Number(e.target.value))}>
          {[4, 6, 8, 10, 12, 20, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button className="dice-roll-btn" onClick={handleRoll}>
          振る
        </button>
      </div>
      {latestResults.length > 0 && (
        <div className="dice-results">
          {latestResults.map((r, i) => (
            <div key={r.id} className={`dice-result ${i === 0 ? 'dice-result-latest' : ''}`}>
              <span className="dice-label">{r.values.length}D{r.faces}</span>
              <span className="dice-values">[{r.values.join(', ')}]</span>
              <span className="dice-total">= {r.values.reduce((a, b) => a + b, 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
