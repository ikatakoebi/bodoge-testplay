import { useCallback, useState } from 'react';
import { parse as parseYaml } from 'yaml';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { CsvUpload } from './CsvUpload';
import { RoomPanel } from './RoomPanel';
import { parseCounterCsv } from '../utils/counterCsv';
import { parseCsvToAreas, areasToCSV } from '../utils/areaCsv';
import { parseCsvToTemplates } from '../utils/templateCsv';
import { parseCsvToCards } from '../utils/csv';
import './Header.css';

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : null;
}

export function Header() {
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsOpen, setSheetsOpen] = useState(false);

  const gridEnabled = useUIStore((s) => s.gridEnabled);
  const toggleGrid = useUIStore((s) => s.toggleGrid);
  const zoom = useUIStore((s) => s.zoom);
  const resetView = useUIStore((s) => s.resetView);
  const clearField = useGameStore((s) => s.clearField);
  const setAreas = useGameStore((s) => s.setAreas);
  const areas = useGameStore((s) => s.areas);
  const addLog = useGameStore((s) => s.addLog);
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardStacks = useGameStore((s) => s.cardStacks);
  const counters = useGameStore((s) => s.counters);
  const memos = useGameStore((s) => s.memos);
  const images = useGameStore((s) => s.images);
  const tokens = useGameStore((s) => s.tokens);
  const addCounter = useGameStore((s) => s.addCounter);

  const cardCount = Object.keys(cardInstances).length;
  const stackCount = Object.keys(cardStacks).length;
  const counterCount = Object.keys(counters).length;
  const memoCount = Object.keys(memos).length;
  const imageCount = Object.keys(images).length;
  const tokenCount = Object.keys(tokens).length;

  const handleAreaCsv = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvToAreas(text);
      if (parsed.length > 0) {
        setAreas(parsed);
        addLog(`エリアCSV読み込み: ${parsed.length}エリア`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setAreas, addLog]);

  const handleCopyAreas = useCallback(() => {
    if (areas.length === 0) return;
    const csv = areasToCSV(areas);
    navigator.clipboard.writeText(csv);
    addLog('エリアCSVをクリップボードにコピーした');
  }, [areas, addLog]);

  const setCounterDefs = useGameStore((s) => s.setCounterDefs);
  const setCardTemplate = useGameStore((s) => s.setCardTemplate);
  const setCardTemplates = useGameStore((s) => s.setCardTemplates);
  const setCardDefinitions = useGameStore((s) => s.setCardDefinitions);

  const handleSheetsImport = useCallback(async () => {
    const id = extractSheetId(sheetsUrl);
    if (!id) {
      useUIStore.getState().addToast('スプレッドシートのURLが正しくありません', 'error');
      return;
    }
    setSheetsLoading(true);
    try {
      const serverUrl = (import.meta.env.VITE_SERVER_URL as string)
        || (import.meta.env.DEV ? 'http://localhost:3210' : '');
      const res = await fetch(`${serverUrl}/api/sheets?id=${id}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json() as Record<string, string | null>;

      const loaded: string[] = [];
      if (data.cards) {
        const defs = parseCsvToCards(data.cards);
        if (defs.length > 0) { setCardDefinitions(defs); loaded.push(`カード${defs.length}種`); }
      }
      if (data.areas) {
        const parsed = parseCsvToAreas(data.areas);
        if (parsed.length > 0) { setAreas(parsed); loaded.push(`エリア${parsed.length}`); }
      }
      if (data.counters) {
        const defs = parseCounterCsv(data.counters);
        if (defs.length > 0) {
          setCounterDefs(defs);
          let x = 100;
          for (const def of defs) {
            if (!def.perPlayer) { addCounter(def.name, x, 100); x += 120; }
          }
          loaded.push(`カウンター${defs.length}`);
        }
      }
      if (data.templates) {
        const parsed = parseCsvToTemplates(data.templates);
        if (Object.keys(parsed).length > 0) {
          setCardTemplates(parsed);
          loaded.push(`テンプレート${Object.keys(parsed).length}`);
        }
      }

      if (loaded.length === 0) {
        useUIStore.getState().addToast('データを取得できませんでした。シートを「リンクを知っている全員が閲覧可」に設定してください', 'error');
      } else {
        addLog(`スプシ読み込み完了: ${loaded.join(', ')}`);
        useUIStore.getState().addToast(`読み込み完了: ${loaded.join(', ')}`, 'success');
        setSheetsOpen(false);
      }
    } catch {
      useUIStore.getState().addToast('サーバーへの接続に失敗しました', 'error');
    }
    setSheetsLoading(false);
  }, [sheetsUrl, setCardDefinitions, setAreas, setCounterDefs, setCardTemplates, addCounter, addLog]);

  const handleGameYaml = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const config = parseYaml(text);
        if (config?.templates) {
          // 複数テンプレート対応
          setCardTemplates(config.templates);
          addLog(`game.yamlからテンプレート ${Object.keys(config.templates).length}個を読み込み`);
        } else if (config?.template) {
          // 後方互換: 単一テンプレート → defaultに設定
          setCardTemplate('default', config.template);
          addLog('game.yamlからテンプレートを読み込み');
        }
        if (config?.name) {
          document.title = config.name + ' - Bodoge TestPlay';
        }
        useUIStore.getState().addToast('game.yaml読み込み完了', 'success');
      } catch {
        useUIStore.getState().addToast('YAML解析エラー', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setCardTemplate, setCardTemplates, addLog]);

  const handleTemplateCsv = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsvToTemplates(text);
      const count = Object.keys(parsed).length;
      if (count > 0) {
        setCardTemplates(parsed);
        addLog(`テンプレートCSV読み込み: ${count}テンプレート`);
        useUIStore.getState().addToast(`テンプレート ${count}個を読み込み`, 'success');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setCardTemplates, addLog]);

  const handleCounterCsv = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const defs = parseCounterCsv(text);
      if (defs.length === 0) return;
      // 定義を保存（セットアップ時のper_player用）
      setCounterDefs(defs);
      // 非per_playerカウンターを即座に配置
      let x = 100;
      for (const def of defs) {
        if (!def.perPlayer) {
          addCounter(def.name, x, 100);
          x += 120;
        }
      }
      const placed = defs.filter((d) => !d.perPlayer).length;
      const perPlayer = defs.filter((d) => d.perPlayer).length;
      const msgs: string[] = [];
      if (placed > 0) msgs.push(`${placed}個配置`);
      if (perPlayer > 0) msgs.push(`${perPlayer}個はセットアップ時に生成`);
      addLog(`カウンターCSV読み込み: ${defs.length}個 (${msgs.join(', ')})`);
      useUIStore.getState().addToast(`カウンター ${defs.length}個を読み込み`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [addCounter, addLog, setCounterDefs]);

  const infoParts: string[] = [];
  if (cardCount > 0) infoParts.push(`${cardCount}枚`);
  if (stackCount > 0) infoParts.push(`${stackCount}山札`);
  if (areas.length > 0) infoParts.push(`${areas.length}エリア`);
  if (counterCount > 0) infoParts.push(`${counterCount}カウンター`);
  if (memoCount > 0) infoParts.push(`${memoCount}メモ`);
  if (imageCount > 0) infoParts.push(`${imageCount}画像`);
  if (tokenCount > 0) infoParts.push(`${tokenCount}トークン`);

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="app-title">Bodoge TestPlay</h1>
        {infoParts.length > 0 && (
          <span className="header-info">{infoParts.join(' / ')}</span>
        )}
      </div>
      <div className="header-right">
        <div className="sheets-import-wrapper">
          <button className="header-btn sheets-import-btn" onClick={() => setSheetsOpen((v) => !v)}>
            スプシ読み込み
          </button>
          {sheetsOpen && (
            <div className="sheets-import-popup">
              <input
                className="sheets-url-input"
                type="text"
                placeholder="Google SheetsのURLを貼り付け"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSheetsImport()}
              />
              <button
                className="header-btn"
                onClick={handleSheetsImport}
                disabled={sheetsLoading}
              >
                {sheetsLoading ? '読込中...' : '取得'}
              </button>
            </div>
          )}
        </div>
        <button className="header-btn header-btn-icon" onClick={undo} title="元に戻す (Ctrl+Z)">
          ↶
        </button>
        <button className="header-btn header-btn-icon" onClick={redo} title="やり直し (Ctrl+Y)">
          ↷
        </button>
        <button
          className={`header-btn ${gridEnabled ? 'active' : ''}`}
          onClick={toggleGrid}
        >
          {gridEnabled ? 'Grid ON' : 'Grid OFF'}
        </button>
        <CsvUpload />
        <label className="csv-upload-btn">
          game.yaml
          <input type="file" accept=".yaml,.yml,.json" onChange={handleGameYaml} hidden />
        </label>
        <label className="csv-upload-btn">
          エリアCSV
          <input type="file" accept=".csv,.tsv" onChange={handleAreaCsv} hidden />
        </label>
        <label className="csv-upload-btn">
          カウンターCSV
          <input type="file" accept=".csv,.tsv" onChange={handleCounterCsv} hidden />
        </label>
        <label className="csv-upload-btn">
          テンプレCSV
          <input type="file" accept=".csv,.tsv" onChange={handleTemplateCsv} hidden />
        </label>
        {areas.length > 0 && (
          <button className="header-btn" onClick={handleCopyAreas}>
            エリアコピー
          </button>
        )}
        <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
        {zoom !== 1 && (
          <button className="header-btn" onClick={resetView}>
            Reset
          </button>
        )}
        <button className="header-btn header-btn-danger" onClick={clearField}>
          クリア
        </button>
        <RoomPanel />
      </div>
    </header>
  );
}
