import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { useSyncStore } from '../store/syncStore';
import { useUIStore } from '../store/uiStore';
import './PlayerPanel.css';

export function PlayerPanel() {
  const players = useGameStore((s) => s.players);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const setCurrentPlayer = useGameStore((s) => s.setCurrentPlayer);
  const setPlayers = useGameStore((s) => s.setPlayers);
  const addLog = useGameStore((s) => s.addLog);
  const addToast = useUIStore((s) => s.addToast);

  // オンライン接続中かどうか
  const isOnline = useSyncStore((s) => !!s.roomId);
  const myPlayerId = useSyncStore((s) => s.myPlayerId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSwitch = (playerId: string) => {
    setCurrentPlayer(playerId);
    const p = players.find((pl) => pl.playerId === playerId);
    addLog(`視点を${p?.name || playerId}に切替`);
  };

  const handleEditStart = (playerId: string, name: string) => {
    setEditingId(playerId);
    setEditName(name);
  };

  const handleEditConfirm = () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }
    const updated = players.map((p) =>
      p.playerId === editingId ? { ...p, name: editName.trim() } : p
    );
    setPlayers(updated);
    addToast(`名前を「${editName.trim()}」に変更`);
    setEditingId(null);
  };

  const handleColorChange = (playerId: string, color: string) => {
    const updated = players.map((p) =>
      p.playerId === playerId ? { ...p, color } : p
    );
    setPlayers(updated);
  };

  return (
    <div className="player-panel">
      {players.map((p) => {
        const isMe = isOnline ? p.playerId === myPlayerId : p.playerId === currentPlayerId;
        return (
          <div
            key={p.playerId}
            className={`player-row ${p.playerId === currentPlayerId ? 'active' : ''}`}
          >
            <input
              type="color"
              className="player-color"
              value={p.color}
              onChange={(e) => handleColorChange(p.playerId, e.target.value)}
              title="プレイヤーカラー"
            />
            {editingId === p.playerId ? (
              <input
                type="text"
                className="player-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditConfirm();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={handleEditConfirm}
                autoFocus
              />
            ) : (
              <span
                className="player-name"
                onDoubleClick={() => handleEditStart(p.playerId, p.name)}
                title="ダブルクリックで編集"
              >
                {p.name}
              </span>
            )}
            {isMe ? (
              <span className="player-badge">自分</span>
            ) : isOnline ? (
              // オンライン時は他プレイヤーの視点に切り替え不可
              <span className="player-badge player-badge-other">他</span>
            ) : (
              <button
                className="player-switch-btn"
                onClick={() => handleSwitch(p.playerId)}
                title={`${p.name}の視点に切替`}
              >
                切替
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
