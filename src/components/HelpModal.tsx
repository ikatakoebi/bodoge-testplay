import { useEffect, useState } from 'react';
import { useUIStore } from '../store/uiStore';
import './HelpModal.css';

/** タブ定義 */
const tabs = [
  { id: 'basics', label: '基本操作' },
  { id: 'cards', label: 'カード・山札' },
  { id: 'areas', label: 'エリア' },
  { id: 'setup', label: 'セットアップ' },
  { id: 'online', label: 'オンライン' },
  { id: 'shortcuts', label: 'ショートカット' },
] as const;

type TabId = (typeof tabs)[number]['id'];

/** キーボードショートカット用のヘルパー */
function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="help-kbd">{children}</span>;
}

/** 各タブのコンテンツ */
function TabContent({ tab }: { tab: TabId }) {
  switch (tab) {
    case 'basics':
      return (
        <div>
          <h3>基本操作</h3>
          <ul>
            <li><strong>カードをドラッグ</strong>して移動できます</li>
            <li><strong>クリック</strong>でカードを選択、<Kbd>Shift</Kbd>+クリックで複数選択</li>
            <li><strong>右クリック</strong>でコンテキストメニュー（めくる、ロック、回転など）</li>
            <li><Kbd>Q</Kbd> / <Kbd>E</Kbd> で選択カードを回転（90度ずつ）</li>
            <li><Kbd>Delete</Kbd> で選択カードを削除</li>
            <li><Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> で元に戻す、<Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd> でやり直し</li>
            <li><strong>マウスホイール</strong>でズーム、<strong>中ボタンドラッグ</strong>でパン（移動）</li>
          </ul>
        </div>
      );
    case 'cards':
      return (
        <div>
          <h3>カード・山札</h3>
          <ul>
            <li><strong>山札をクリック</strong> → 1枚ドロー（一番上のカードを引く）</li>
            <li><strong>山札を右クリック</strong> → シャッフル、全めくり、全回収などの操作</li>
            <li><strong>カードを山札にドロップ</strong> → 山札に戻す</li>
            <li>カードの<strong>表/裏</strong>は右クリックメニューの「めくる」で切り替え</li>
            <li><Kbd>O</Kbd> キーで選択カードをオープン（全員に見える状態）にできます</li>
          </ul>
        </div>
      );
    case 'areas':
      return (
        <div>
          <h3>エリア</h3>
          <p>エリアはカードの配置場所を区切る領域です。</p>
          <ul>
            <li><strong>public</strong> — 全員にカードが見えるエリア（場札など）</li>
            <li><strong>owner</strong> — そのエリアのオーナーだけがカードの表を見られるエリア（手札など）</li>
            <li><strong>hidden</strong> — 裏向き山札用のエリア（デッキなど）</li>
          </ul>
          <p>エリアの設定はスプレッドシートの「areas」シートで定義できます。</p>
        </div>
      );
    case 'setup':
      return (
        <div>
          <h3>セットアップ</h3>
          <ul>
            <li>ヘッダーの「<strong>スプシ読み込み</strong>」からGoogle SheetsのURLを入力してデータを読み込み</li>
            <li>サイドバーの「<strong>セットアップ実行</strong>」でカードの自動配布を実行</li>
            <li>セットアップ手順はスプレッドシートの「setup」シートで定義（YAML/JSON形式）</li>
            <li>スプレッドシートには以下のシートを作成できます:
              <ul>
                <li><strong>cards</strong> — カード定義（名前、枚数、画像など）</li>
                <li><strong>areas</strong> — エリア定義（位置、サイズ、可視性）</li>
                <li><strong>counters</strong> — カウンター定義</li>
                <li><strong>templates</strong> — カードテンプレート定義</li>
                <li><strong>setup</strong> — セットアップ手順</li>
              </ul>
            </li>
          </ul>
        </div>
      );
    case 'online':
      return (
        <div>
          <h3>オンラインプレイ</h3>
          <ul>
            <li>ヘッダーの「<strong>ルーム作成</strong>」でオンライン対戦部屋を作成</li>
            <li>表示される<strong>ルームID</strong>を共有して、他のプレイヤーが参加</li>
            <li>カード移動、めくり、山札操作など<strong>全操作がリアルタイム同期</strong>されます</li>
            <li>ページを閉じても、しばらくの間は自動的に再接続されます</li>
          </ul>
        </div>
      );
    case 'shortcuts':
      return (
        <div>
          <h3>ショートカット一覧</h3>
          <table className="help-shortcut-table">
            <thead>
              <tr>
                <th>キー</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Kbd>Q</Kbd> / <Kbd>E</Kbd></td>
                <td>選択カードを左/右に90度回転</td>
              </tr>
              <tr>
                <td><Kbd>O</Kbd></td>
                <td>選択カードをオープンにする</td>
              </tr>
              <tr>
                <td><Kbd>Delete</Kbd></td>
                <td>選択カードを削除</td>
              </tr>
              <tr>
                <td><Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd></td>
                <td>元に戻す (Undo)</td>
              </tr>
              <tr>
                <td><Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd></td>
                <td>やり直し (Redo)</td>
              </tr>
              <tr>
                <td><Kbd>Shift</Kbd>+クリック</td>
                <td>複数選択</td>
              </tr>
              <tr>
                <td>マウスホイール</td>
                <td>ズーム</td>
              </tr>
              <tr>
                <td>中ボタンドラッグ</td>
                <td>パン（画面移動）</td>
              </tr>
              <tr>
                <td><Kbd>Escape</Kbd></td>
                <td>選択解除</td>
              </tr>
            </tbody>
          </table>
        </div>
      );
  }
}

export function HelpModal() {
  const helpOpen = useUIStore((s) => s.helpOpen);
  const toggleHelp = useUIStore((s) => s.toggleHelp);
  const [activeTab, setActiveTab] = useState<TabId>('basics');

  // ESCキーで閉じる
  useEffect(() => {
    if (!helpOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        toggleHelp();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [helpOpen, toggleHelp]);

  if (!helpOpen) return null;

  return (
    <div className="help-overlay" onClick={toggleHelp}>
      <div className="help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="help-modal-header">
          <h2>使い方ガイド</h2>
          <button className="help-close-btn" onClick={toggleHelp} title="閉じる">
            ✕
          </button>
        </div>
        <div className="help-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`help-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="help-content">
          <TabContent tab={activeTab} />
        </div>
      </div>
    </div>
  );
}
