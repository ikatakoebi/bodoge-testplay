import { useState, useCallback } from 'react';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { useSyncStore } from '../store/syncStore';
import { executeSetup } from '../utils/setup';
import type { SetupAction } from '../utils/setup';
import './SetupPanel.css';

const DEFAULT_SETUP_ACTIONS: SetupAction[] = [
  { action: 'shuffle' },
  { action: 'deal', from: 'deck', to: 'p_hand', count: { '2p': 7, '3p': 6, '4p': 5, default: 5 }, perPlayer: true },
  { action: 'deal', from: 'deck', to: 'market', count: 4, faceUp: true },
];

type SetupFormat = 'yaml' | 'json';

function parseSetupText(text: string): SetupAction[] | null {
  // まずJSONとして試す
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  // YAMLとして試す
  try {
    const parsed = parseYaml(text);
    if (Array.isArray(parsed)) return parsed;
    // setup: [...] 形式も許容
    if (parsed && Array.isArray(parsed.setup)) return parsed.setup;
  } catch { /* not YAML */ }
  return null;
}

export function SetupPanel() {
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const counterDefs = useGameStore((s) => s.counterDefs);
  const areas = useGameStore((s) => s.areas);
  const addLog = useGameStore((s) => s.addLog);
  // オンライン時はルーム人数を使う
  const roomPlayerCount = useSyncStore((s) => s.players.length);
  const isOnline = useSyncStore((s) => !!s.roomId);
  const [localPlayerCount, setLocalPlayerCount] = useState(2);
  const playerCount = isOnline && roomPlayerCount > 0 ? roomPlayerCount : localPlayerCount;

  const [format, setFormat] = useState<SetupFormat>('yaml');
  const [setupText, setSetupText] = useState(stringifyYaml(DEFAULT_SETUP_ACTIONS));
  const [isEditing, setIsEditing] = useState(false);

  const addToast = useUIStore((s) => s.addToast);

  const toggleFormat = useCallback(() => {
    const parsed = parseSetupText(setupText);
    if (!parsed) {
      addToast('現在のテキストをパースできません', 'error');
      return;
    }
    if (format === 'yaml') {
      setSetupText(JSON.stringify(parsed, null, 2));
      setFormat('json');
    } else {
      setSetupText(stringifyYaml(parsed));
      setFormat('yaml');
    }
  }, [format, setupText, addToast]);

  const runSetup = useCallback(() => {
    if (cardDefinitions.length === 0) {
      addToast('先にカードCSVを読み込んでください', 'warning');
      return;
    }

    const actions = parseSetupText(setupText);
    if (!actions) {
      addToast('セットアップ定義が不正です', 'error');
      return;
    }

    const cardTemplates = useGameStore.getState().cardTemplates;
    const result = executeSetup(cardDefinitions, areas, { playerCount, actions, counterDefs }, cardTemplates);

    // ストアに反映（オンライン時は自分のplayerIdを維持）
    const myId = useSyncStore.getState().myPlayerId;
    useGameStore.setState({
      cardInstances: result.cardInstances,
      cardStacks: result.cardStacks,
      counters: { ...useGameStore.getState().counters, ...result.counters },
      players: result.players,
      currentPlayerId: myId || result.players[0]?.playerId || 'p0',
    });

    result.logs.forEach((log) => addLog(log));
    addLog(`セットアップ完了（${playerCount}人）`);
  }, [cardDefinitions, counterDefs, areas, playerCount, setupText, addLog, addToast]);

  const resetAndSetup = useCallback(() => {
    useGameStore.getState().clearField();
    runSetup();
  }, [runSetup]);

  return (
    <div className="setup-panel">
      <h3 className="sidebar-title">セットアップ</h3>

      <div className="setup-row">
        <label>プレイ人数:{isOnline && ` (ルーム: ${roomPlayerCount}人)`}</label>
        <div className="player-count-btns">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={`player-btn ${playerCount === n ? 'active' : ''}`}
              onClick={() => setLocalPlayerCount(n)}
              disabled={isOnline}
            >
              {n}人
            </button>
          ))}
        </div>
      </div>

      <div className="setup-actions">
        <button className="setup-btn setup-btn-primary" onClick={runSetup}>
          セットアップ実行
        </button>
        <button className="setup-btn" onClick={resetAndSetup}>
          リセット＆再セットアップ
        </button>
      </div>

      <div className="setup-editor-toggle">
        <button className="setup-btn-small" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? '閉じる' : 'セットアップ編集'}
        </button>
        {isEditing && (
          <button className="setup-btn-small" onClick={toggleFormat} style={{ marginLeft: 4 }}>
            {format.toUpperCase()}
          </button>
        )}
      </div>

      {isEditing && (
        <textarea
          className="setup-json-editor"
          value={setupText}
          onChange={(e) => setSetupText(e.target.value)}
          rows={12}
        />
      )}
    </div>
  );
}
