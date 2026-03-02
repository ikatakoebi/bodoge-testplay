import { useState, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { getCardSize, resolveTemplate } from '../utils/cardTemplate';
import type { CardDefinition, CardTemplate, CardTemplateField } from '../types';
import './RevealModal.css';

/** 山札からN枚公開するモーダル（ラッパー） */
export function RevealModal() {
  const revealModal = useUIStore((s) => s.revealModal);
  if (!revealModal) return null;
  // keyを変えてリマウントし、useStateの初期値で状態をセット（useEffect不要）
  return (
    <RevealModalInner
      key={revealModal.stackId + '_' + revealModal.cardIds.join(',')}
      stackId={revealModal.stackId}
      initialCardIds={revealModal.cardIds}
    />
  );
}

/** 山札からN枚公開するモーダル（内部） */
function RevealModalInner({ stackId, initialCardIds }: { stackId: string; initialCardIds: string[] }) {
  const closeRevealModal = useUIStore((s) => s.closeRevealModal);

  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const cardTemplates = useGameStore((s) => s.cardTemplates);
  const cardStacks = useGameStore((s) => s.cardStacks);
  const revealFromStack = useGameStore((s) => s.revealFromStack);
  const takeRevealedCard = useGameStore((s) => s.takeRevealedCard);
  const returnRevealedCards = useGameStore((s) => s.returnRevealedCards);
  const addLog = useGameStore((s) => s.addLog);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);

  const [count, setCount] = useState(initialCardIds.length);
  const [revealedIds, setRevealedIds] = useState<string[]>(initialCardIds);

  // 枚数変更時にスタックから再取得
  const handleCountChange = useCallback((newCount: number) => {
    if (!stackId) return;
    const clamped = Math.max(1, Math.min(10, newCount));

    // 現在公開中のカードを全部スタックに戻す
    if (revealedIds.length > 0) {
      returnRevealedCards(revealedIds, stackId);
    }

    // 新しい枚数で再取得
    const newIds = revealFromStack(stackId, clamped);
    setRevealedIds(newIds);
    setCount(newIds.length);
  }, [stackId, revealedIds, revealFromStack, returnRevealedCards]);

  // カードをクリック → フィールドに配置、残りを戻す
  const handleTakeCard = useCallback((instanceId: string) => {
    if (!stackId) return;
    saveSnapshot();
    const stack = useGameStore.getState().cardStacks[stackId];
    const x = stack ? stack.x + 150 : 0;
    const y = stack ? stack.y : 0;
    takeRevealedCard(instanceId, x, y);

    // 残りのカードをスタックに戻す
    const remaining = revealedIds.filter((id) => id !== instanceId);
    if (remaining.length > 0) {
      returnRevealedCards(remaining, stackId);
    }

    const def = cardDefinitions.find((d) => d.id === cardInstances[instanceId]?.definitionId);
    addLog(`公開カード「${def?.name || '?'}」を取得、残り${remaining.length}枚を山札に戻した`);
    closeRevealModal();
  }, [stackId, revealedIds, takeRevealedCard, returnRevealedCards, saveSnapshot, addLog, closeRevealModal, cardInstances, cardDefinitions]);

  // 全部戻す
  const handleReturnAll = useCallback(() => {
    if (!stackId) return;
    if (revealedIds.length > 0) {
      returnRevealedCards(revealedIds, stackId);
    }
    addLog(`公開した${revealedIds.length}枚を全て山札に戻した`);
    closeRevealModal();
  }, [stackId, revealedIds, returnRevealedCards, addLog, closeRevealModal]);

  // オーバーレイクリックで閉じる（カードは戻す）
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleReturnAll();
    }
  }, [handleReturnAll]);

  // スタック情報からカード枚数上限を取得
  const stack = cardStacks[stackId];
  const maxCards = (stack?.cardInstanceIds.length ?? 0) + revealedIds.length;

  const defMap = new Map(cardDefinitions.map((d) => [d.id, d]));

  return (
    <div className="reveal-overlay" onClick={handleOverlayClick}>
      <div className="reveal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="reveal-modal-header">
          <span className="reveal-modal-title">山札から公開 ({revealedIds.length}枚)</span>
          <div className="reveal-count-control">
            <button
              onClick={() => handleCountChange(count - 1)}
              disabled={count <= 1}
            >
              -
            </button>
            <span className="reveal-count-value">{count}</span>
            <button
              onClick={() => handleCountChange(count + 1)}
              disabled={count >= 10 || count >= maxCards}
            >
              +
            </button>
          </div>
        </div>

        <div className="reveal-cards-container">
          {revealedIds.length === 0 ? (
            <div className="reveal-empty-message">山札にカードがありません</div>
          ) : (
            revealedIds.map((id, index) => {
              const card = cardInstances[id];
              if (!card) return null;
              const def = defMap.get(card.definitionId);
              if (!def) return null;
              const tmpl = resolveTemplate(cardTemplates, def.template as string | undefined);
              return (
                <RevealCard
                  key={id}
                  instanceId={id}
                  definition={def}
                  template={tmpl}
                  onClick={handleTakeCard}
                  order={index + 1}
                />
              );
            })
          )}
        </div>

        <div className="reveal-modal-actions">
          <button className="reveal-return-btn" onClick={handleReturnAll}>
            全部戻す
          </button>
        </div>
      </div>
    </div>
  );
}

/** モーダル内の公開カード1枚 */
function RevealCard({ instanceId, definition, template, onClick, order }: {
  instanceId: string;
  definition: CardDefinition;
  template: CardTemplate;
  onClick: (id: string) => void;
  order: number; // 山札の上からの順番（1始まり）
}) {
  const size = getCardSize(template);
  // モーダル内ではカードを少し縮小して表示
  const scale = Math.min(1, 140 / size.width);
  const displayW = size.width * scale;
  const displayH = size.height * scale;

  const borderColor = template.border.colorField
    ? (definition[template.border.colorField] as string) || template.border.color || '#666'
    : template.border.color || '#666';

  return (
    <div
      className="reveal-card"
      style={{
        width: displayW,
        height: displayH,
        borderColor,
        borderRadius: template.border.radius,
      }}
      onClick={() => onClick(instanceId)}
    >
      {/* 山札の上からの順番バッジ */}
      <span className="reveal-card-order-badge">#{order}</span>
      <div
        className="reveal-card-body"
        style={{ backgroundColor: (definition.color as string) || '#fff' }}
      >
        <div className="reveal-card-name">{String(definition.name || '')}</div>
        <div className="reveal-card-fields">
          {template.layout
            .filter((f) => f.field !== 'name')
            .slice(0, 4) // 最大4フィールドまで表示
            .map((field, i) => (
              <RevealCardField key={i} field={field} definition={definition} />
            ))}
        </div>
      </div>
      <div className="reveal-card-take-hint">クリックで取得</div>
    </div>
  );
}

/** モーダル内カードのフィールド表示 */
function RevealCardField({ field, definition }: {
  field: CardTemplateField;
  definition: CardDefinition;
}) {
  const value = definition[field.field];
  if (value === undefined || value === '') return null;
  const strVal = String(value);
  // 画像URLはモーダル内では省略
  if (/^(https?:\/\/|data:image\/)/.test(strVal)) return null;
  if (/\.(png|jpe?g|gif|svg|webp|bmp)(\?.*)?$/i.test(strVal)) return null;

  return (
    <div className="reveal-card-field">
      <span className="reveal-card-field-label">{field.field}:</span>
      <span className="reveal-card-field-value">{strVal}</span>
    </div>
  );
}
