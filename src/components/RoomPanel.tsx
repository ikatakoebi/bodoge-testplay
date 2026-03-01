import { useState, useCallback } from 'react';
import { useSyncStore } from '../store/syncStore';
import { useGameStore } from '../store/gameStore';
import './RoomPanel.css';

export function RoomPanel() {
  const roomId = useSyncStore((s) => s.roomId);
  const isHost = useSyncStore((s) => s.isHost);
  const players = useSyncStore((s) => s.players);
  const myPlayerId = useSyncStore((s) => s.myPlayerId);
  const playerName = useSyncStore((s) => s.playerName);
  const playerColor = useSyncStore((s) => s.playerColor);
  const setPlayerInfo = useSyncStore((s) => s.setPlayerInfo);
  const connect = useSyncStore((s) => s.connect);
  const disconnect = useSyncStore((s) => s.disconnect);
  const createRoom = useSyncStore((s) => s.createRoom);
  const joinRoom = useSyncStore((s) => s.joinRoom);

  const [showPanel, setShowPanel] = useState(false);
  const [joinId, setJoinId] = useState('');
  const [editName, setEditName] = useState(playerName);
  const [editColor, setEditColor] = useState(playerColor);

  const PLAYER_COLORS = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#ff922b', '#20c997', '#ff8787'];

  const handleCreate = useCallback(async () => {
    setPlayerInfo(editName, editColor);
    connect();
    await new Promise((r) => setTimeout(r, 500));
    const result = await createRoom();
    if (result) {
      useGameStore.getState().setCurrentPlayer(result.playerId);
      navigator.clipboard.writeText(result.roomId).catch(() => {});
    }
  }, [editName, editColor, setPlayerInfo, connect, createRoom]);

  const handleJoin = useCallback(async () => {
    if (!joinId.trim()) return;
    setPlayerInfo(editName, editColor);
    connect();
    await new Promise((r) => setTimeout(r, 500));
    const result = await joinRoom(joinId.trim().toUpperCase());
    if (result) {
      useGameStore.getState().setCurrentPlayer(result.playerId);
    }
  }, [joinId, editName, editColor, setPlayerInfo, connect, joinRoom]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setShowPanel(false);
  }, [disconnect]);

  if (roomId) {
    return (
      <div className="room-info">
        <button className="room-badge" onClick={() => setShowPanel(!showPanel)}>
          Room: {roomId} ({players.length}人)
        </button>
        {showPanel && (
          <div className="room-dropdown">
            <div className="room-dropdown-header">
              ルーム: {roomId} {isHost && '(ホスト)'}
            </div>
            <div className="room-player-list">
              {players.map((p) => (
                <div key={p.id} className={`room-player ${p.playerId === myPlayerId ? 'room-player-me' : ''}`} style={{ borderLeftColor: p.color }}>
                  {p.name} ({p.playerId}) {p.isHost && '(H)'} {p.playerId === myPlayerId && '← 自分'}
                </div>
              ))}
            </div>
            <button className="room-btn room-btn-danger" onClick={handleDisconnect}>
              退出
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="room-info">
      <button className="header-btn" onClick={() => setShowPanel(!showPanel)}>
        オンライン
      </button>
      {showPanel && (
        <div className="room-dropdown">
          <div className="room-field">
            <label>名前</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="プレイヤー名"
            />
          </div>
          <div className="room-field">
            <label>カラー</label>
            <div className="room-color-palette">
              {PLAYER_COLORS.map((c) => (
                <button
                  key={c}
                  className={`room-color-swatch ${editColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setEditColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="room-actions">
            <button className="room-btn room-btn-primary" onClick={handleCreate}>
              ルーム作成
            </button>
            <div className="room-join-row">
              <input
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="ルームID"
                maxLength={6}
              />
              <button className="room-btn" onClick={handleJoin} disabled={!joinId.trim()}>
                参加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
