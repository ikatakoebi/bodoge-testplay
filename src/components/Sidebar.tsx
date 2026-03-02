import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { areasToCSV } from '../utils/areaCsv';
import { templatesToCSV } from '../utils/templateCsv';
import { SetupPanel } from './SetupPanel';
import { DicePanel } from './DicePanel';
import { RulesPanel } from './RulesPanel';
import { CardSearch } from './CardSearch';
import { TemplateEditor } from './TemplateEditor';
import { PlayerPanel } from './PlayerPanel';
import { SaveLoadPanel } from './SaveLoadPanel';
import { BoardImagePanel } from './BoardImagePanel';
import './Sidebar.css';

export function Sidebar() {
  const logs = useGameStore((s) => s.logs);
  const areas = useGameStore((s) => s.areas);
  const memos = useGameStore((s) => s.memos);
  const tokens = useGameStore((s) => s.tokens);
  const setAreas = useGameStore((s) => s.setAreas);
  const addLog = useGameStore((s) => s.addLog);

  const cardTemplates = useGameStore((s) => s.cardTemplates);
  const addToast = useUIStore((s) => s.addToast);

  const handleCopyAreasCsv = () => {
    if (areas.length === 0) {
      addToast('エリアがありません', 'warning');
      return;
    }
    const csv = areasToCSV(areas);
    navigator.clipboard.writeText(csv).then(() => {
      addToast('エリアCSVをクリップボードにコピーしました', 'success');
    });
  };

  const handleExportMemos = () => {
    const memoList = Object.values(memos);
    if (memoList.length === 0) {
      addToast('メモがありません', 'warning');
      return;
    }
    const text = memoList.map((m, i) => {
      const author = m.author ? ` (${m.author})` : '';
      return `[${i + 1}]${author} ${m.text || '(空)'}`;
    }).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      addToast('メモをクリップボードにコピーしました', 'success');
    });
  };

  const memoCount = Object.keys(memos).length;
  const tokenCount = Object.keys(tokens).length;

  return (
    <aside className="sidebar">
      <SetupPanel />

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">プレイヤー</h3>
        </div>
        <PlayerPanel />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">ダイス</h3>
        </div>
        <DicePanel />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">カード</h3>
        </div>
        <CardSearch />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">テンプレート</h3>
          <button className="sidebar-btn" onClick={() => {
            const csv = templatesToCSV(cardTemplates);
            navigator.clipboard.writeText(csv).then(() => {
              addToast('テンプレートCSVをクリップボードにコピーしました', 'success');
            });
          }}>
            CSVコピー
          </button>
        </div>
        <TemplateEditor />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">エリア</h3>
          <button className="sidebar-btn" onClick={handleCopyAreasCsv}>
            CSVコピー
          </button>
          {areas.length > 0 && (
            <button className="sidebar-btn sidebar-btn-danger" onClick={() => {
              useUIStore.getState().showModal(
                `全${areas.length}個のエリアを削除しますか？`, 'この操作は取り消せません', 'confirm',
                () => { setAreas([]); addLog('全エリアを削除した'); }
              );
            }}>
              全削除
            </button>
          )}
        </div>
        <div className="area-count">{areas.length}個のエリア</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">ボード画像</h3>
        </div>
        <BoardImagePanel />
      </div>

      {(memoCount > 0 || tokenCount > 0) && (
        <div className="sidebar-section">
          {memoCount > 0 && (
            <>
              <div className="sidebar-section-header">
                <h3 className="sidebar-title">メモ</h3>
                <button className="sidebar-btn" onClick={handleExportMemos}>
                  コピー
                </button>
              </div>
              <div className="area-count">{memoCount}個のメモ</div>
            </>
          )}
          {tokenCount > 0 && (
            <div className="area-count" style={{ marginTop: memoCount > 0 ? 4 : 0 }}>
              {tokenCount}個のトークン
            </div>
          )}
        </div>
      )}

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">ルール</h3>
        </div>
        <RulesPanel />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <h3 className="sidebar-title">セーブ/ロード</h3>
        </div>
        <SaveLoadPanel />
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-title">操作ログ</h3>
        <div className="log-list">
          {logs.length === 0 && <div className="log-empty">まだ操作がありません</div>}
          {logs.slice().reverse().map((log, i) => (
            <div key={i} className="log-entry">
              <span className="log-time">
                {new Date(log.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="log-message">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
