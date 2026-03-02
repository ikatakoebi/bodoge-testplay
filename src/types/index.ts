// === カード定義（CSVから読み込むマスターデータ） ===
export interface CardDefinition {
  id: string;
  name: string;
  [key: string]: string | number | undefined; // 自由カラム対応
}

// === フィールド上のカードインスタンス ===
export type CardFace = 'up' | 'down';
export type CardVisibility = 'hidden' | 'owner' | 'public';

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  x: number;
  y: number;
  zIndex: number;
  face: CardFace;           // 表/裏
  visibility: CardVisibility; // 誰に見えるか
  ownerId: string | null;   // 所有者（めくった人）
  stackId: string | null;     // 現在いる山札のID（null=フィールド上）
  homeStackId: string | null; // 所属元の山札のID（引かれても保持）
  locked: boolean;           // 位置ロック
  rotation: number;          // 回転角度（0, 90, 180, 270）
}

// === 山札（スタック） ===
export interface CardStack {
  stackId: string;
  x: number;
  y: number;
  zIndex: number;
  cardInstanceIds: string[]; // 上から順
}

// === エリア ===
export interface Area {
  areaId: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visibility: 'public' | 'owner' | 'hidden';
  perPlayer: boolean;
  bgColor?: string;
  playerId?: string; // perPlayer=trueの時、どのプレイヤーのエリアか
  locked?: boolean;  // undefined/true = ロック, false = 解除
}

// === カウンター ===
export interface Counter {
  counterId: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  x: number;
  y: number;
  zIndex: number;
  locked: boolean;
}

// === 画像オブジェクト ===
export interface ImageObject {
  imageId: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
}

// === メモ（付箋） ===
export interface Memo {
  memoId: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex: number;
  locked: boolean;
  author?: string;  // 作成者名
}

// === トークン/駒 ===
export interface Token {
  tokenId: string;
  label: string;
  shape: 'circle' | 'square';
  color: string;
  size: number;     // px
  x: number;
  y: number;
  zIndex: number;
  locked: boolean;
}

// === ダイス結果 ===
export interface DiceResult {
  id: string;
  values: number[];
  faces: number;
  timestamp: number;
}

// === カードテンプレート ===
export type CardSizePreset = 'standard' | 'mini' | 'tarot' | 'custom';

export interface CardTemplateField {
  field: string;
  position: 'top' | 'top-left' | 'top-right' | 'center' | 'center-left' | 'center-right' | 'bottom' | 'bottom-left' | 'bottom-right';
  fontSize?: number;
  fontSizeField?: string; // カードCSVの列名からfontSizeを取得
  bold?: boolean;
  italic?: boolean;
  shape?: 'circle' | 'square';
  bgColor?: string;
  height?: string;
  textColor?: string;
}

export interface CardTemplate {
  size: {
    preset: CardSizePreset;
    width?: number;  // px
    height?: number; // px
  };
  layout: CardTemplateField[];
  back: {
    bgColor: string;
    text?: string;
    imageUrl?: string;
  };
  border: {
    colorField?: string; // CSVのどのカラムを色に使うか
    color?: string;      // 固定色
    radius: number;
  };
}

// === ゲーム設定 ===
export interface GameConfig {
  name: string;
  players: {
    min: number;
    max: number;
  };
  field: {
    gridEnabled: boolean;
    cols: number;
    rows: number;
    cellSize: number; // px
    bgColor: string;
  };
}

// === プレイヤー ===
export interface Player {
  playerId: string;
  name: string;
  color: string;
}

// === 操作ログ ===
export interface LogEntry {
  timestamp: number;
  playerId: string;
  message: string;
}

// === Undo/Redo用のアクション記録 ===
export interface UndoAction {
  type: string;
  before: unknown;
  after: unknown;
}
