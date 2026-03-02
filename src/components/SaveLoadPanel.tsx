import { useState, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';
import type { SaveMeta } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import './SaveLoadPanel.css';

/**
 * ゲーム状態の保存/復元パネル
 * - 名前付きでlocalStorageに保存
 * - 一覧表示・復元・削除
 */
export function SaveLoadPanel() {
  const [saveName, setSaveName] = useState('');
  const [saves, setSaves] = useState<SaveMeta[]>(() => useGameStore.getState().listSaves());

  const saveGame = useGameStore((s) => s.saveGame);
  const loadGame = useGameStore((s) => s.loadGame);
  const deleteSave = useGameStore((s) => s.deleteSave);
  const listSaves = useGameStore((s) => s.listSaves);
  const addToast = useUIStore((s) => s.addToast);
  const showModal = useUIStore((s) => s.showModal);

  // 一覧を再取得
  const refreshSaves = useCallback(() => {
    setSaves(listSaves());
  }, [listSaves]);

  // 保存
  const handleSave = useCallback(() => {
    const name = saveName.trim();
    if (!name) {
      addToast('保存名を入力してください', 'warning');
      return;
    }
    // 同名が既にある場合は上書き確認
    const existing = saves.find((s) => s.name === name);
    if (existing) {
      showModal(
        `「${name}」を上書きしますか？`,
        '既存のセーブデータが上書きされます',
        'confirm',
        () => {
          saveGame(name);
          setSaveName('');
          refreshSaves();
          addToast(`「${name}」に保存しました`, 'success');
        }
      );
    } else {
      saveGame(name);
      setSaveName('');
      refreshSaves();
      addToast(`「${name}」に保存しました`, 'success');
    }
  }, [saveName, saves, saveGame, refreshSaves, addToast, showModal]);

  // 復元
  const handleLoad = useCallback((name: string) => {
    showModal(
      `「${name}」を復元しますか？`,
      '現在のゲーム状態は失われます',
      'confirm',
      () => {
        const ok = loadGame(name);
        if (ok) {
          addToast(`「${name}」を復元しました`, 'success');
        } else {
          addToast('復元に失敗しました', 'error');
        }
      }
    );
  }, [loadGame, addToast, showModal]);

  // 削除
  const handleDelete = useCallback((name: string) => {
    showModal(
      `「${name}」を削除しますか？`,
      'この操作は取り消せません',
      'confirm',
      () => {
        deleteSave(name);
        refreshSaves();
        addToast(`「${name}」を削除しました`, 'success');
      }
    );
  }, [deleteSave, refreshSaves, addToast, showModal]);

  // 日時フォーマット
  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="saveload-panel">
      {/* 保存入力 */}
      <div className="saveload-input-row">
        <input
          type="text"
          className="saveload-name-input"
          placeholder="セーブ名"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          maxLength={30}
        />
        <button className="saveload-save-btn" onClick={handleSave}>
          保存
        </button>
      </div>

      {/* セーブ一覧 */}
      {saves.length === 0 ? (
        <div className="saveload-empty">セーブデータなし</div>
      ) : (
        <div className="saveload-list">
          {saves.map((meta) => (
            <div key={meta.name} className="saveload-item">
              <div className="saveload-item-info">
                <span className="saveload-item-name">{meta.name}</span>
                <span className="saveload-item-meta">
                  {formatDate(meta.timestamp)} / {meta.playerCount}人
                </span>
              </div>
              <div className="saveload-item-actions">
                <button
                  className="saveload-load-btn"
                  onClick={() => handleLoad(meta.name)}
                  title="復元"
                >
                  復元
                </button>
                <button
                  className="saveload-delete-btn"
                  onClick={() => handleDelete(meta.name)}
                  title="削除"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
