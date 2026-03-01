import { useCallback } from 'react';
import { parseCsvToCards, expandCardDefinitions } from '../utils/csv';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import './Header.css';

export function CsvUpload() {
  const setCardDefinitions = useGameStore((s) => s.setCardDefinitions);
  const addCardInstances = useGameStore((s) => s.addCardInstances);
  const clearField = useGameStore((s) => s.clearField);
  const addLog = useGameStore((s) => s.addLog);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const newDefs = parseCsvToCards(text);
      if (newDefs.length === 0) {
        alert('CSVにカードデータが見つかりません');
        return;
      }

      const state = useGameStore.getState();
      const existingInstances = Object.values(state.cardInstances);

      if (existingInstances.length === 0) {
        // 新規読み込み
        clearField();
        setCardDefinitions(newDefs);
        const expanded = expandCardDefinitions(newDefs);
        addCardInstances(expanded);
        const msg = `CSV読み込み: ${newDefs.length}種類 / ${expanded.length}枚のカードを生成`;
        addLog(msg);
        useUIStore.getState().addToast(msg, 'success');
        return;
      }

      // ホットリロード: 差分検出
      saveSnapshot();
      const oldDefs = state.cardDefinitions;
      const oldDefMap = new Map(oldDefs.map((d) => [d.id, d]));
      const newDefMap = new Map(newDefs.map((d) => [d.id, d]));

      const added: string[] = [];
      const removed: string[] = [];
      const updated: string[] = [];
      const countChanged: { id: string; oldCount: number; newCount: number }[] = [];

      // 新規・変更検出
      for (const def of newDefs) {
        const old = oldDefMap.get(def.id);
        if (!old) {
          added.push(def.id);
        } else {
          const oldCount = typeof old.count === 'number' ? old.count : 1;
          const newCount = typeof def.count === 'number' ? def.count : 1;
          if (oldCount !== newCount) {
            countChanged.push({ id: def.id, oldCount, newCount });
          }
          // 内容変更チェック（countを除く）
          const changed = Object.keys(def).some((k) => k !== 'count' && def[k] !== old[k]);
          if (changed) updated.push(def.id);
        }
      }

      // 削除検出
      for (const old of oldDefs) {
        if (!newDefMap.has(old.id)) {
          removed.push(old.id);
        }
      }

      // 削除カードの確認
      if (removed.length > 0) {
        const removedInField = removed.filter((id) =>
          existingInstances.some((inst) => inst.definitionId === id)
        );
        if (removedInField.length > 0) {
          const ok = confirm(
            `以下のカードが削除されます（盤面に存在します）:\n${removedInField.join(', ')}\n\n削除してもよいですか？`
          );
          if (!ok) return;
        }
      }

      // 定義更新（これで既存カードの表示が即座に変わる）
      setCardDefinitions(newDefs);

      // 削除カードのインスタンスを除去
      if (removed.length > 0) {
        useGameStore.getState().removeCardsByDefinitionIds(removed);
      }

      // 枚数変更
      for (const { id, oldCount, newCount } of countChanged) {
        if (newCount > oldCount) {
          // 増加分を追加
          const def = newDefMap.get(id)!;
          const toAdd = Array(newCount - oldCount).fill(def);
          addCardInstances(toAdd);
        } else {
          // 減少分を除去（stackに入ってないカードから優先的に）
          useGameStore.getState().removeExcessCards(id, oldCount - newCount);
        }
      }

      // 新規カード追加
      if (added.length > 0) {
        const newCardDefs = added.map((id) => newDefMap.get(id)!);
        const expanded = expandCardDefinitions(newCardDefs);
        addCardInstances(expanded);
      }

      // ログ出力
      const parts: string[] = [];
      if (updated.length > 0) parts.push(`${updated.length}種更新`);
      if (added.length > 0) parts.push(`${added.length}種追加`);
      if (removed.length > 0) parts.push(`${removed.length}種削除`);
      if (countChanged.length > 0) parts.push(`${countChanged.length}種枚数変更`);
      if (parts.length === 0) parts.push('変更なし');
      const msg = `CSVホットリロード: ${parts.join('、')}`;
      addLog(msg);
      useUIStore.getState().addToast(msg, 'success');
    };
    reader.readAsText(file);
  }, [setCardDefinitions, addCardInstances, clearField, addLog, saveSnapshot]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv'))) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div
      className="csv-upload"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <label className="csv-upload-btn">
        CSV読み込み
        <input type="file" accept=".csv,.tsv" onChange={handleChange} hidden />
      </label>
    </div>
  );
}
