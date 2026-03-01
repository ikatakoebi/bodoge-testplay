import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Field } from './components/Field';
import { Sidebar } from './components/Sidebar';
import { ContextMenu } from './components/ContextMenu';
import { ShortcutHelp } from './components/ShortcutHelp';
import { DiceFloat } from './components/DiceFloat';
import { ToastContainer } from './components/Toast';
import { ModalDialog } from './components/ModalDialog';
import { useGameStore } from './store/gameStore';
import { useUIStore } from './store/uiStore';
import { useSync } from './hooks/useSync';
import { initSyncBridge } from './store/syncBridge';
import './App.css';

// 同期ブリッジ初期化（1回のみ）
initSyncBridge();

function App() {
  useSync();
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const rotateCards = useGameStore((s) => s.rotateCards);
  const removeCards = useGameStore((s) => s.removeCards);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const addLog = useGameStore((s) => s.addLog);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();

      // ショートカットヘルプ
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      // Escape で選択解除・ヘルプ閉じ
      if (key === 'escape') {
        setShowShortcuts(false);
        useUIStore.getState().clearSelection();
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      const { selectedCardIds } = useUIStore.getState();
      if (selectedCardIds.length > 0) {
        // カード回転 Q=左90° E=右90° ←=左90° →=右90°
        let delta = 0;
        if (key === 'q' || key === 'arrowleft') delta = -90;
        if (key === 'e' || key === 'arrowright') delta = 90;
        if (delta !== 0) {
          e.preventDefault();
          saveSnapshot();
          rotateCards(selectedCardIds, delta);
          addLog(`${selectedCardIds.length}枚のカードを${delta > 0 ? '右' : '左'}に回転`);
          return;
        }

        // Delete/Backspace で選択カード削除
        if (key === 'delete' || key === 'backspace') {
          e.preventDefault();
          saveSnapshot();
          removeCards(selectedCardIds);
          addLog(`${selectedCardIds.length}枚のカードを削除した`);
          useUIStore.getState().clearSelection();
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, rotateCards, removeCards, saveSnapshot, addLog]);

  return (
    <div className="app">
      <Header />
      <div className="app-body">
        <Field />
        <Sidebar />
      </div>
      <ContextMenu />
      <DiceFloat />
      <ToastContainer />
      <ModalDialog />
      {showShortcuts && <ShortcutHelp onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

export default App;
