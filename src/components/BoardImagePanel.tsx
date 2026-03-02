import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import './BoardImagePanel.css';

/** サイドバー用ボード画像（フィールド背景）管理パネル */
export function BoardImagePanel() {
  const [url, setUrl] = useState('');
  const boardImages = useGameStore((s) => s.boardImages);
  const addBoardImage = useGameStore((s) => s.addBoardImage);
  const updateBoardImage = useGameStore((s) => s.updateBoardImage);
  const removeBoardImage = useGameStore((s) => s.removeBoardImage);
  const addLog = useGameStore((s) => s.addLog);

  // 画像追加
  const handleAdd = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    // デフォルトサイズ 400x300、中央 (0,0) 付近に配置
    addBoardImage(trimmed, 0, 0, 400, 300);
    addLog('ボード画像を追加した');
    setUrl('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="board-image-panel">
      {/* URL入力 + 追加ボタン */}
      <div className="board-image-add-row">
        <input
          type="text"
          placeholder="画像URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button onClick={handleAdd}>追加</button>
      </div>

      {/* 画像一覧 */}
      {boardImages.length === 0 ? (
        <div className="board-image-empty">ボード画像なし</div>
      ) : (
        <div className="board-image-list">
          {boardImages.map((bi) => (
            <div key={bi.boardImageId} className="board-image-item">
              {/* ヘッダー: サムネ + URL + 操作ボタン */}
              <div className="board-image-item-header">
                <img src={bi.url} alt="" className="board-image-thumb" />
                <span className="board-image-url-text" title={bi.url}>
                  {bi.url}
                </span>
                <div className="board-image-actions">
                  <button
                    className={bi.locked ? 'active' : ''}
                    onClick={() => updateBoardImage(bi.boardImageId, { locked: !bi.locked })}
                    title={bi.locked ? 'ロック解除' : 'ロック'}
                  >
                    {bi.locked ? '🔒' : '🔓'}
                  </button>
                  <button
                    className="danger"
                    onClick={() => { removeBoardImage(bi.boardImageId); addLog('ボード画像を削除した'); }}
                    title="削除"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* 位置 X */}
              <div className="board-image-slider-row">
                <label>X</label>
                <input
                  type="range"
                  min={-2000}
                  max={2000}
                  value={bi.x}
                  onChange={(e) => updateBoardImage(bi.boardImageId, { x: Number(e.target.value) })}
                />
                <span className="slider-value">{bi.x}</span>
              </div>

              {/* 位置 Y */}
              <div className="board-image-slider-row">
                <label>Y</label>
                <input
                  type="range"
                  min={-2000}
                  max={2000}
                  value={bi.y}
                  onChange={(e) => updateBoardImage(bi.boardImageId, { y: Number(e.target.value) })}
                />
                <span className="slider-value">{bi.y}</span>
              </div>

              {/* 幅 */}
              <div className="board-image-slider-row">
                <label>W</label>
                <input
                  type="range"
                  min={50}
                  max={3000}
                  value={bi.width}
                  onChange={(e) => updateBoardImage(bi.boardImageId, { width: Number(e.target.value) })}
                />
                <span className="slider-value">{bi.width}</span>
              </div>

              {/* 高さ */}
              <div className="board-image-slider-row">
                <label>H</label>
                <input
                  type="range"
                  min={50}
                  max={3000}
                  value={bi.height}
                  onChange={(e) => updateBoardImage(bi.boardImageId, { height: Number(e.target.value) })}
                />
                <span className="slider-value">{bi.height}</span>
              </div>

              {/* 透明度 */}
              <div className="board-image-slider-row">
                <label>透</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(bi.opacity * 100)}
                  onChange={(e) => updateBoardImage(bi.boardImageId, { opacity: Number(e.target.value) / 100 })}
                />
                <span className="slider-value">{Math.round(bi.opacity * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
