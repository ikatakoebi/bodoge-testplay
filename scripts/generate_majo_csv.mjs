import { readFileSync, writeFileSync } from 'fs';

// =====================
// majo_master.csv → majo_cards.csv 変換スクリプト
// =====================

const csvText = readFileSync('K:/claude/bodoge_testplay/data/majo_master.csv', 'utf8');
const lines = csvText.trim().split('\n');
const headers = lines[0].split(',');

// 行インデックス(1始まり) → 画像ファイル名
// Row1=Card1.png, Row2=Card1-1.png, Row3=Card1-2.png, ...Row98=Card1-97.png
function rowToImage(rowIdx) {
  if (rowIdx === 1) return 'Card1.png';
  return `Card1-${rowIdx - 1}.png`;
}

// 分類別カラー
const colorMap = {
  '魔導具': '#9b59b6',
  '魔女':   '#e74c3c',
  '使い魔': '#f39c12',
  '聖遺物': '#1abc9c',
  '聖者':   '#2ecc71',
  '基本':   '#7f8c8d',
  '実績':   '#3498db',
};

// 分類別テンプレート
const templateMap = {
  '魔導具': 'spell',
  '魔女':   'unit',
  '使い魔': 'unit',
  '聖遺物': 'default',
  '聖者':   'unit',
  '基本':   'default',
  '実績':   'default',
};

const allRows = [];

lines.slice(1).forEach((line, i) => {
  const rowIdx = i + 1; // 1始まり
  const parts = line.split(',');
  const row = {};
  headers.forEach((h, j) => { row[h] = parts[j]?.trim() ?? ''; });

  const id       = row['id'];
  const bunrui   = row['分類'];
  const name     = row['name1'];
  let   text     = row['flavor1'];
  const costRaw  = row['costimage'];
  const wakucost = row['wakucost'];
  const maryoku  = row['maryokudata'];
  const mana     = row['manadata'];
  const winnum   = row['winnumdata'];

  // テキスト整形
  if (text === '-') text = '';

  // コスト解析
  let cost = 0;
  if (costRaw && costRaw !== 'name=null' && !isNaN(Number(costRaw))) {
    cost = Number(costRaw);
  } else if (bunrui === '基本' && wakucost && wakucost !== '*' && !isNaN(Number(wakucost))) {
    cost = Number(wakucost);
  }

  // 聖者のテキスト：体力/マナ報酬/アイテム報酬を追記
  if (bunrui === '聖者') {
    const parts2 = [];
    if (text) parts2.push(text);
    if (maryoku && !isNaN(Number(maryoku))) parts2.push(`体力${maryoku}`);
    if (mana    && !isNaN(Number(mana)))    parts2.push(`マナ${mana}`);
    if (winnum  && !isNaN(Number(winnum)) && Number(winnum) > 0) parts2.push(`勝利点${winnum}`);
    text = parts2.join(' / ');
  }

  // 魔導具のテキスト：魔力を追記
  if (bunrui === '魔導具' && maryoku && maryoku !== '*' && !isNaN(Number(maryoku))) {
    text = text ? `魔力${maryoku} ${text}` : `魔力${maryoku}`;
  }

  const imagePath = `/card-images/majo/${rowToImage(rowIdx)}`;

  allRows.push({
    id:      `M${id}`,
    name,
    type:    bunrui,
    cost,
    text,
    count:   1,
    color:   colorMap[bunrui] ?? '#95a5a6',
    image:   imagePath,
    template: templateMap[bunrui] ?? 'default',
    _bunrui:  bunrui,
    _rowIdx:  rowIdx,
  });
});

// 魔女・使い魔は4枚同一 → 1エントリにまとめる
const finalCards = [];
let majoAdded = false;
let tsukaimaAdded = false;

for (const c of allRows) {
  if (c._bunrui === '魔女') {
    if (!majoAdded) { c.count = 4; finalCards.push(c); majoAdded = true; }
  } else if (c._bunrui === '使い魔') {
    if (!tsukaimaAdded) { c.count = 4; finalCards.push(c); tsukaimaAdded = true; }
  } else {
    finalCards.push(c);
  }
}

// エリアIDマッピング（tag → 初期配置エリア）
const areaMap = {
  '魔導具': 'magic_supply',
  '魔女':   'p_witch',
  '使い魔': 'p_witch',
  '聖遺物': 'relic_deck',
  '聖者':   'saint_deck',
  '基本':   'field',
  '実績':   'achievement',
};

// CSV出力
const csvHeader = 'id,name,type,tag,cost,text,count,color,image,template,area';
const csvRows = finalCards.map(c => {
  // カンマ含む可能性があるフィールドはクォート
  const safeText = `"${c.text.replace(/"/g, '""')}"`;
  const area = areaMap[c._bunrui] ?? '';
  return `${c.id},${c.name},${c.type},${c._bunrui},${c.cost},${safeText},${c.count},${c.color},${c.image},${c.template},${area}`;
});
const output = [csvHeader, ...csvRows].join('\n') + '\n';

const outPath = 'K:/claude/bodoge_testplay/public/majo_cards.csv';
writeFileSync(outPath, output, 'utf8');

console.log(`✅ ${finalCards.length}件のカードエントリを生成しました → ${outPath}`);
console.log('\n分類別内訳:');
const summary = {};
for (const c of finalCards) {
  summary[c._bunrui] = (summary[c._bunrui] ?? 0) + 1;
}
for (const [k, v] of Object.entries(summary)) {
  console.log(`  ${k}: ${v}件 → エリア:${areaMap[k]}`);
}
