#!/usr/bin/env node
/**
 * CSVテンプレートからExcelファイルを生成するスクリプト
 * 生成したxlsxをGoogle Driveにアップすればスプレッドシートとして使える
 */
import ExcelJS from 'exceljs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

function parseCSV(text) {
  const lines = text.trim().split('\n');
  return lines.map(line => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
      current += ch;
    }
    cells.push(current);
    return cells;
  });
}

function autoWidth(ws) {
  ws.columns.forEach((col, i) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, cell => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 40);
  });
}

function styleHeader(ws) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A2A5A' } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF666666' } },
    };
  });
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + ws.columnCount)}1` };
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Bodoge TestPlay';

  // --- カード ---
  const cardsCSV = readFileSync(resolve(publicDir, 'template_cards.csv'), 'utf-8');
  const cardsData = parseCSV(cardsCSV);
  const wsCards = wb.addWorksheet('cards', { properties: { tabColor: { argb: 'FFE74C3C' } } });
  cardsData.forEach((row, i) => {
    const r = wsCards.addRow(row);
    // 数値っぽいセルは数値に変換
    if (i > 0) {
      [3, 5, 10].forEach(ci => { // cost, count, min_players
        const v = row[ci];
        if (v && !isNaN(Number(v))) r.getCell(ci + 1).value = Number(v);
      });
    }
  });
  styleHeader(wsCards);
  autoWidth(wsCards);
  // サンプル行に色付け
  for (let i = 2; i <= wsCards.rowCount; i++) {
    const colorCell = wsCards.getRow(i).getCell(7); // color列
    const colorVal = String(colorCell.value || '');
    if (colorVal.startsWith('#')) {
      colorCell.fill = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: 'FF' + colorVal.slice(1) },
      };
      colorCell.font = { color: { argb: 'FFFFFFFF' }, size: 10 };
    }
  }

  // --- エリア ---
  const areasCSV = readFileSync(resolve(publicDir, 'template_areas.csv'), 'utf-8');
  const areasData = parseCSV(areasCSV);
  const wsAreas = wb.addWorksheet('areas', { properties: { tabColor: { argb: 'FF3498DB' } } });
  areasData.forEach((row, i) => {
    const r = wsAreas.addRow(row);
    if (i > 0) {
      [2, 3, 4, 5].forEach(ci => { // x, y, width, height
        const v = row[ci];
        if (v && !isNaN(Number(v))) r.getCell(ci + 1).value = Number(v);
      });
    }
  });
  styleHeader(wsAreas);
  autoWidth(wsAreas);

  // --- カウンター ---
  const countersCSV = readFileSync(resolve(publicDir, 'template_counters.csv'), 'utf-8');
  const countersData = parseCSV(countersCSV);
  const wsCounters = wb.addWorksheet('counters', { properties: { tabColor: { argb: 'FFF39C12' } } });
  countersData.forEach((row, i) => {
    const r = wsCounters.addRow(row);
    if (i > 0) {
      [2, 3, 4, 5].forEach(ci => { // min, max, default, step
        const v = row[ci];
        if (v && !isNaN(Number(v))) r.getCell(ci + 1).value = Number(v);
      });
    }
  });
  styleHeader(wsCounters);
  autoWidth(wsCounters);

  // --- テンプレート ---
  const templatesCSV = readFileSync(resolve(publicDir, 'template_templates.csv'), 'utf-8');
  const templatesData = parseCSV(templatesCSV);
  const wsTemplates = wb.addWorksheet('templates', { properties: { tabColor: { argb: 'FF9B59B6' } } });
  templatesData.forEach((row, i) => {
    const r = wsTemplates.addRow(row);
    if (i > 0) {
      [11, 17].forEach(ci => { // fontSize, height
        const v = row[ci];
        if (v && !isNaN(Number(v))) r.getCell(ci + 1).value = Number(v);
      });
    }
  });
  styleHeader(wsTemplates);
  autoWidth(wsTemplates);

  // --- 使い方シート ---
  const wsHelp = wb.addWorksheet('使い方', { properties: { tabColor: { argb: 'FF1ABC9C' } } });
  const helpData = [
    ['シート名', '説明', '必須列'],
    ['cards', 'カード定義。1行=1種類のカード', 'id, name, count'],
    ['areas', 'フィールド上のエリア定義', 'area_id, name, x, y, width, height'],
    ['counters', 'HP・所持金などのカウンター', 'id, name, min, max, default'],
    ['templates', 'カードの見た目テンプレート', 'template, field'],
    ['', '', ''],
    ['■ 使い方', '', ''],
    ['1. 各シートを編集してゲームデータを定義', '', ''],
    ['2. 「ファイル > ダウンロード > CSV」で各シートをCSVとしてダウンロード', '', ''],
    ['3. ダウンロードしたCSVをpublic/フォルダに配置', '', ''],
    ['4. ファイル名: cards.csv, areas.csv, counters.csv, templates.csv', '', ''],
    ['', '', ''],
    ['■ カード画像について', '', ''],
    ['image列にはパスを記入（例: /card-images/fire.svg）', '', ''],
    ['SVGファイルをpublic/card-images/に配置', '', ''],
    ['', '', ''],
    ['■ テンプレートについて', '', ''],
    ['cardsのtemplate列にテンプレート名を指定', '', ''],
    ['templatesシートで定義したレイアウトが適用される', '', ''],
    ['未指定の場合は"default"テンプレートが使われる', '', ''],
  ];
  helpData.forEach(row => wsHelp.addRow(row));
  styleHeader(wsHelp);
  wsHelp.getColumn(1).width = 25;
  wsHelp.getColumn(2).width = 55;
  wsHelp.getColumn(3).width = 35;

  // 保存
  const outPath = resolve(publicDir, 'bodoge_game_data.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`生成完了: ${outPath}`);
  console.log('→ このファイルをGoogle Driveにアップロードすると自動的にスプレッドシートに変換されます');
}

main().catch(err => { console.error(err); process.exit(1); });
