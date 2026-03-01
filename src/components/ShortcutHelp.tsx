import './ShortcutHelp.css';

interface Props {
  onClose: () => void;
}

const shortcuts = [
  { keys: 'Shift + ドラッグ', desc: '範囲選択' },
  { keys: 'Q / ←', desc: '選択カードを左に回転' },
  { keys: 'E / →', desc: '選択カードを右に回転' },
  { keys: 'Delete / Backspace', desc: '選択カードを削除' },
  { keys: 'Escape', desc: '選択解除' },
  { keys: 'Ctrl+Z', desc: '元に戻す (Undo)' },
  { keys: 'Ctrl+Y / Ctrl+Shift+Z', desc: 'やり直し (Redo)' },
  { keys: 'Space + ドラッグ', desc: 'パン（画面移動）' },
  { keys: 'ホイール', desc: 'ズーム' },
  { keys: '右クリック', desc: 'コンテキストメニュー' },
  { keys: '?', desc: 'このヘルプを表示' },
];

export function ShortcutHelp({ onClose }: Props) {
  return (
    <div className="shortcut-overlay" onClick={onClose}>
      <div className="shortcut-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-header">
          <h3>キーボードショートカット</h3>
          <button className="shortcut-close" onClick={onClose}>×</button>
        </div>
        <table className="shortcut-table">
          <tbody>
            {shortcuts.map((s, i) => (
              <tr key={i}>
                <td className="shortcut-keys">{s.keys}</td>
                <td className="shortcut-desc">{s.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
