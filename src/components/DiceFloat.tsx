import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import './DiceFloat.css';

export function DiceFloat() {
  const diceResults = useGameStore((s) => s.diceResults);
  const [visible, setVisible] = useState(false);

  const display = useMemo(() => {
    if (diceResults.length === 0) return null;
    const latest = diceResults[diceResults.length - 1];
    const total = latest.values.reduce((a, b) => a + b, 0);
    return { values: latest.values, faces: latest.faces, total };
  }, [diceResults]);

  useEffect(() => {
    if (diceResults.length === 0) return;
    const showTimer = setTimeout(() => setVisible(true), 0);
    const hideTimer = setTimeout(() => setVisible(false), 2500);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [diceResults]);

  if (!display || !visible) return null;

  return (
    <div className="dice-float">
      <div className="dice-float-dice">
        {display.values.map((v, i) => (
          <span key={i} className="dice-float-die">{v}</span>
        ))}
      </div>
      <div className="dice-float-total">= {display.total}</div>
    </div>
  );
}
