import { useEffect, useCallback } from 'react';
import { useUIStore } from '../store/uiStore';
import { useGameStore } from '../store/gameStore';
import { areasToCSV } from '../utils/areaCsv';
import { getCardSize, resolveTemplate } from '../utils/cardTemplate';
import './ContextMenu.css';

export function ContextMenu() {
  const { visible, x, y, fieldX, fieldY, targetType, targetId } = useUIStore((s) => s.contextMenu);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const selectedCardIds = useUIStore((s) => s.selectedCardIds);
  const showModal = useUIStore((s) => s.showModal);
  const flipCard = useGameStore((s) => s.flipCard);
  const flipCards = useGameStore((s) => s.flipCards);
  const toggleLockCard = useGameStore((s) => s.toggleLockCard);
  const rotateCard = useGameStore((s) => s.rotateCard);
  const bringToFront = useGameStore((s) => s.bringToFront);
  const drawFromStack = useGameStore((s) => s.drawFromStack);
  const shuffleStack = useGameStore((s) => s.shuffleStack);
  const unstackAll = useGameStore((s) => s.unstackAll);
  const unstackAllOpen = useGameStore((s) => s.unstackAllOpen);
  const peekStack = useGameStore((s) => s.peekStack);
  const unpeekStack = useGameStore((s) => s.unpeekStack);
  const addCounter = useGameStore((s) => s.addCounter);
  const removeCounter = useGameStore((s) => s.removeCounter);
  const duplicateCounter = useGameStore((s) => s.duplicateCounter);
  const toggleLockCounter = useGameStore((s) => s.toggleLockCounter);
  const areas = useGameStore((s) => s.areas);
  const removeArea = useGameStore((s) => s.removeArea);
  const toggleLockArea = useGameStore((s) => s.toggleLockArea);
  const updateAreaProps = useGameStore((s) => s.updateAreaProps);
  const moveCardsTo = useGameStore((s) => s.moveCardsTo);
  const addLog = useGameStore((s) => s.addLog);
  const saveSnapshot = useGameStore((s) => s.saveSnapshot);
  const setAreaDrawMode = useUIStore((s) => s.setAreaDrawMode);
  const rotateCards = useGameStore((s) => s.rotateCards);
  const importImageAsCard = useGameStore((s) => s.importImageAsCard);
  const removeImage = useGameStore((s) => s.removeImage);
  const toggleLockImage = useGameStore((s) => s.toggleLockImage);
  const removeMemo = useGameStore((s) => s.removeMemo);
  const toggleLockMemo = useGameStore((s) => s.toggleLockMemo);
  const addMemo = useGameStore((s) => s.addMemo);
  const addToken = useGameStore((s) => s.addToken);
  const removeToken = useGameStore((s) => s.removeToken);
  const toggleLockToken = useGameStore((s) => s.toggleLockToken);
  const duplicateToken = useGameStore((s) => s.duplicateToken);
  const transferOwnership = useGameStore((s) => s.transferOwnership);
  const createStack = useGameStore((s) => s.createStack);
  const addToStack = useGameStore((s) => s.addToStack);
  const collectToStack = useGameStore((s) => s.collectToStack);
  const removeStack = useGameStore((s) => s.removeStack);
  const arrangeCardsInArea = useGameStore((s) => s.arrangeCardsInArea);
  const revealFromStack = useGameStore((s) => s.revealFromStack);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const players = useGameStore((s) => s.players);
  const setSelectedCards = useUIStore((s) => s.setSelectedCards);
  const openRevealModal = useUIStore((s) => s.openRevealModal);

  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardTemplates = useGameStore((s) => s.cardTemplates);
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const cardStacks = useGameStore((s) => s.cardStacks);
  const counters = useGameStore((s) => s.counters);
  const images = useGameStore((s) => s.images);
  const memosStore = useGameStore((s) => s.memos);
  const tokensStore = useGameStore((s) => s.tokens);

  useEffect(() => {
    if (visible) {
      const handler = () => hideContextMenu();
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [visible, hideContextMenu]);

  const handleAction = useCallback((action: () => void) => {
    saveSnapshot();
    action();
    hideContextMenu();
  }, [hideContextMenu, saveSnapshot]);

  if (!visible) return null;

  const card = targetType === 'card' && targetId ? cardInstances[targetId] : null;
  const counter = targetType === 'counter' && targetId ? counters[targetId] : null;
  const stack = targetType === 'stack' && targetId ? cardStacks[targetId] : null;
  const topCardPeeked = stack && stack.cardInstanceIds.length > 0
    ? cardInstances[stack.cardInstanceIds[0]]?.visibility === 'owner'
    : false;

  // 複数選択中のカードを右クリックした場合
  const isMultiSelection = targetType === 'card' && targetId
    && selectedCardIds.includes(targetId) && selectedCardIds.length > 1;

  // 現在のカードの周囲にある重なったカードを検出
  const overlappingCards = (() => {
    if (targetType !== 'card' || !card) return [];
    const OVERLAP_THRESHOLD = 40;
    return Object.values(cardInstances).filter((c) => {
      if (c.instanceId === targetId) return false;
      if (c.stackId !== null) return false; // スタック内は除外
      const dx = Math.abs(c.x - card.x);
      const dy = Math.abs(c.y - card.y);
      return dx <= OVERLAP_THRESHOLD && dy <= OVERLAP_THRESHOLD;
    });
  })();
  const hasOverlapping = overlappingCards.length > 0 && !isMultiSelection;

  const alignCards = (direction: 'horizontal' | 'vertical') => {
    const cards = selectedCardIds
      .map((id) => cardInstances[id])
      .filter(Boolean);
    if (cards.length === 0) return;

    // 先頭カードのテンプレートでサイズ算出（混在時は近似）
    const firstCard = cards[0];
    const def0 = firstCard ? cardDefinitions.find((d) => d.id === firstCard.definitionId) : null;
    const tmpl0 = resolveTemplate(cardTemplates, def0?.template as string | undefined);
    const cardSize = getCardSize(tmpl0);

    if (direction === 'horizontal') {
      const sorted = [...cards].sort((a, b) => a.x - b.x);
      const baseX = sorted[0].x;
      const baseY = Math.min(...cards.map((c) => c.y));
      const positions = sorted.map((c, i) => ({
        id: c.instanceId,
        x: baseX + i * cardSize.width,
        y: baseY,
      }));
      moveCardsTo(positions);
    } else {
      const sorted = [...cards].sort((a, b) => a.y - b.y);
      const baseX = Math.min(...cards.map((c) => c.x));
      const baseY = sorted[0].y;
      const positions = sorted.map((c, i) => ({
        id: c.instanceId,
        x: baseX,
        y: baseY + i * cardSize.height,
      }));
      moveCardsTo(positions);
    }
  };

  const area = targetType === 'area' && targetId
    ? areas.find((a) => a.areaId === targetId)
    : null;
  const image = targetType === 'image' && targetId ? images[targetId] : null;
  const memo = targetType === 'memo' && targetId ? memosStore[targetId] : null;
  const token = targetType === 'token' && targetId ? tokensStore[targetId] : null;

  return (
    <div className="context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {isMultiSelection && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            createStack(selectedCardIds, fieldX, fieldY);
            setSelectedCards([]);
            addLog(`${selectedCardIds.length}枚で山札を作った`);
          })}>
            山札を作る
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            flipCards(selectedCardIds, 'owner', currentPlayerId);
            addLog(`${selectedCardIds.length}枚のカードをめくった（自分だけ）`);
          })}>
            全てめくる（自分だけ）
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            flipCards(selectedCardIds, 'public', null);
            addLog(`${selectedCardIds.length}枚のカードをオープンにした`);
          })}>
            全てオープン (O)
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            flipCards(selectedCardIds, 'hidden', null);
            addLog(`${selectedCardIds.length}枚のカードを裏に戻した`);
          })}>
            全て裏に戻す
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            alignCards('horizontal');
            addLog(`${selectedCardIds.length}枚のカードを横に並べた`);
          })}>
            横に並べる
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            alignCards('vertical');
            addLog(`${selectedCardIds.length}枚のカードを縦に並べた`);
          })}>
            縦に並べる
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            rotateCards(selectedCardIds, 90);
            addLog(`${selectedCardIds.length}枚のカードを右に回転`);
          })}>
            右に回転 (E)
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            rotateCards(selectedCardIds, -90);
            addLog(`${selectedCardIds.length}枚のカードを左に回転`);
          })}>
            左に回転 (Q)
          </button>
        </>
      )}

      {targetType === 'card' && targetId && !isMultiSelection && (
        <>
          {hasOverlapping && targetId && (
            <>
              <button className="context-menu-item" onClick={() => handleAction(() => {
                const allIds = [targetId, ...overlappingCards.map((c) => c.instanceId)];
                createStack(allIds, card!.x, card!.y);
                setSelectedCards([]);
                addLog(`${allIds.length}枚の重なったカードで山札を作った`);
              })}>
                重なっているカードで山札を作る ({overlappingCards.length + 1}枚)
              </button>
              <div className="context-menu-separator" />
            </>
          )}
          <button className="context-menu-item" disabled={card?.visibility === 'owner'} onClick={() => handleAction(() => {
            flipCard(targetId, 'owner', currentPlayerId);
            addLog('カードをめくった（自分だけ）');
          })}>
            めくる（自分だけ）
          </button>
          <button className="context-menu-item" disabled={card?.visibility === 'public'} onClick={() => handleAction(() => {
            flipCard(targetId, 'public', null);
            addLog('カードをオープンにした');
          })}>
            オープンにする (O)
          </button>
          <button className="context-menu-item" disabled={card?.visibility === 'hidden'} onClick={() => handleAction(() => {
            flipCard(targetId, 'hidden', null);
            addLog('カードを裏に戻した');
          })}>
            裏に戻す
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            bringToFront(targetId);
            addLog('カードを一番上に移動した');
          })}>
            一番上に移動
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            toggleLockCard(targetId);
            addLog(card?.locked ? 'カードのロックを解除した' : 'カードをロックした');
          })}>
            {card?.locked ? 'ロック解除' : 'ロック'}
          </button>
          {card?.visibility === 'owner' && card.ownerId && players.length > 1 && (
            <>
              <div className="context-menu-separator" />
              <div className="context-menu-label">所有権を渡す</div>
              {players.filter((p) => p.playerId !== card.ownerId).map((p) => (
                <button key={p.playerId} className="context-menu-item" onClick={() => handleAction(() => {
                  transferOwnership(targetId, p.playerId);
                  addLog(`カードの所有権を「${p.name}」に譲渡`);
                })}>
                  <span className="context-menu-player-dot" style={{ backgroundColor: p.color }} />
                  {p.name}
                </button>
              ))}
            </>
          )}
          <div className="context-menu-separator" />
          <button className="context-menu-item" disabled={!card?.homeStackId || !cardStacks[card.homeStackId!]} onClick={() => handleAction(() => {
            addToStack(card!.homeStackId!, targetId!);
            addLog('カードを山札に戻した');
          })}>
            山札に戻す
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            rotateCard(targetId, 90);
            addLog('カードを右に回転');
          })}>
            右に回転 (E)
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            rotateCard(targetId, -90);
            addLog('カードを左に回転');
          })}>
            左に回転 (Q)
          </button>
        </>
      )}

      {targetType === 'stack' && targetId && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            const drawn = drawFromStack(targetId, 1);
            drawn.forEach((c) => flipCard(c.instanceId, 'owner', currentPlayerId));
            addLog('山札から1枚引いた');
          })}>
            1枚引く
          </button>
          <div className="context-menu-submenu">
            <button className="context-menu-item">複数枚引く</button>
            <div className="context-menu-submenu-items">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button key={n} className="context-menu-item" onClick={() => handleAction(() => {
                  const drawn = drawFromStack(targetId, n);
                  drawn.forEach((c) => flipCard(c.instanceId, 'owner', currentPlayerId));
                  addLog(`山札から${n}枚引いた`);
                })}>
                  {n} 枚
                </button>
              ))}
            </div>
          </div>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            drawFromStack(targetId, 1);
            addLog('山札から裏向きのまま1枚引いた');
          })}>
            裏向きのまま1枚引く
          </button>
          <div className="context-menu-submenu">
            <button className="context-menu-item">裏向きのまま複数枚引く</button>
            <div className="context-menu-submenu-items">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button key={n} className="context-menu-item" onClick={() => handleAction(() => {
                  drawFromStack(targetId, n);
                  addLog(`山札から裏向きのまま${n}枚引いた`);
                })}>
                  {n} 枚
                </button>
              ))}
            </div>
          </div>
          <div className="context-menu-separator" />
          {topCardPeeked ? (
            <button className="context-menu-item" onClick={() => handleAction(() => {
              unpeekStack(targetId);
              addLog('山札の一番上を伏せた');
            })}>
              見るのをやめる
            </button>
          ) : (
            <button className="context-menu-item" onClick={() => handleAction(() => {
              peekStack(targetId);
              addLog('山札の一番上を見た（自分だけ）');
            })}>
              一番上を見る（自分だけ）
            </button>
          )}
          <button className="context-menu-item" onClick={() => {
            hideContextMenu();
            saveSnapshot();
            const ids = revealFromStack(targetId, 3);
            if (ids.length > 0) {
              openRevealModal(targetId, ids);
              addLog(`山札から${ids.length}枚公開した`);
            }
          }}>
            N枚公開...
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            shuffleStack(targetId);
            addLog('山札をシャッフルした');
          })}>
            シャッフル
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            unstackAll(targetId);
            addLog('山札を全部広げた');
          })}>
            全部広げる
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            unstackAllOpen(targetId);
            addLog('山札をオープンにして広げた');
          })}>
            オープンにして広げる
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            collectToStack(targetId!);
            addLog('全てのカードを山札に集めた');
          })}>
            すべて集める
          </button>
          <button className="context-menu-item" disabled={Object.keys(cardStacks).length < 2} onClick={() => {
            hideContextMenu();
            showModal('合わせる山札を選択（山札をクリック）', '', 'confirm', () => {
              // 簡易: 他の山札の上にドラッグで合わせる機能は既にある
            });
          }}>
            山札を合わせる
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item context-menu-item-danger" onClick={() => handleAction(() => {
            removeStack(targetId!);
            addLog('山札を削除した');
          })}>
            削除
          </button>
        </>
      )}

      {targetType === 'counter' && targetId && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            duplicateCounter(targetId);
            addLog('カウンターを複製した');
          })}>
            複製
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            toggleLockCounter(targetId);
            addLog(counter?.locked ? 'カウンターのロックを解除した' : 'カウンターをロックした');
          })}>
            {counter?.locked ? 'ロック解除' : 'ロック'}
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item context-menu-item-danger" onClick={() => handleAction(() => {
            removeCounter(targetId);
            addLog('カウンターを削除した');
          })}>
            削除
          </button>
        </>
      )}

      {targetType === 'area' && targetId && (
        <>
          <button className="context-menu-item" onClick={() => {
            hideContextMenu();
            showModal('エリア名', area?.name || '', 'text', (name) => {
              if (name.trim() && name !== area?.name) {
                saveSnapshot();
                updateAreaProps(targetId, { name: name.trim() });
                addLog(`エリア名を「${name.trim()}」に変更`);
              }
            });
          }}>
            名前変更...
          </button>
          <button className="context-menu-item" onClick={() => {
            const vis = area?.visibility === 'public' ? 'owner' : area?.visibility === 'owner' ? 'hidden' : 'public';
            handleAction(() => {
              updateAreaProps(targetId, { visibility: vis });
              addLog(`エリアの可視性を ${vis} に変更`);
            });
          }}>
            可視性: {area?.visibility || 'public'} →
          </button>
          <button className="context-menu-item" onClick={() => {
            hideContextMenu();
            showModal('背景色 (例: #ff000030)', area?.bgColor || '', 'text', (color) => {
              saveSnapshot();
              updateAreaProps(targetId, { bgColor: color || undefined });
              addLog('エリアの背景色を変更');
            });
          }}>
            背景色...
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => handleAction(() => {
            toggleLockArea(targetId);
            addLog(area?.locked === false ? 'エリアをロックした' : 'エリアのロックを解除した');
          })}>
            {area?.locked === false ? 'ロック' : 'ロック解除'}
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            arrangeCardsInArea(targetId);
            addLog('エリア内のカードを整列した');
          })}>
            整列
          </button>
          <button className="context-menu-item" onClick={() => {
            const a = areas.find((a) => a.areaId === targetId);
            if (a) {
              const csv = areasToCSV([a]);
              navigator.clipboard.writeText(csv);
              addLog('エリアCSVをコピーした');
            }
            hideContextMenu();
          }}>
            CSVコピー
          </button>
          <button className="context-menu-item context-menu-item-danger" onClick={() => handleAction(() => {
            removeArea(targetId);
            addLog('エリアを削除した');
          })}>
            削除
          </button>
        </>
      )}

      {targetType === 'image' && targetId && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            toggleLockImage(targetId);
            addLog(image?.locked ? '画像のロックを解除した' : '画像をロックした');
          })}>
            {image?.locked ? 'ロック解除' : 'ロック'}
          </button>
          <button className="context-menu-item context-menu-item-danger" onClick={() => handleAction(() => {
            removeImage(targetId);
            addLog('画像を削除した');
          })}>
            削除
          </button>
        </>
      )}

      {targetType === 'memo' && targetId && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            toggleLockMemo(targetId);
            addLog(memo?.locked ? 'メモのロックを解除した' : 'メモをロックした');
          })}>
            {memo?.locked ? 'ロック解除' : 'ロック'}
          </button>
          <button className="context-menu-item context-menu-item-danger" onClick={() => handleAction(() => {
            removeMemo(targetId);
            addLog('メモを削除した');
          })}>
            削除
          </button>
        </>
      )}

      {targetType === 'token' && targetId && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            duplicateToken(targetId);
            addLog('トークンを複製した');
          })}>
            複製
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            toggleLockToken(targetId);
            addLog(token?.locked ? 'トークンのロックを解除した' : 'トークンをロックした');
          })}>
            {token?.locked ? 'ロック解除' : 'ロック'}
          </button>
          <button className="context-menu-item context-menu-item-danger" onClick={() => handleAction(() => {
            removeToken(targetId);
            addLog('トークンを削除した');
          })}>
            削除
          </button>
        </>
      )}

      {targetType === 'field' && (
        <>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            addCounter('Counter', fieldX, fieldY);
            addLog('カウンターを配置した');
          })}>
            カウンターを置く
          </button>
          <button className="context-menu-item" onClick={() => handleAction(() => {
            addMemo(fieldX, fieldY);
            addLog('メモを配置した');
          })}>
            メモを置く
          </button>
          <button className="context-menu-item" onClick={() => {
            const colors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff8f00'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            handleAction(() => {
              addToken('', 'circle', color, fieldX, fieldY);
              addLog('トークンを配置した');
            });
          }}>
            トークンを置く（丸）
          </button>
          <button className="context-menu-item" onClick={() => {
            const colors = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff8f00'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            handleAction(() => {
              addToken('', 'square', color, fieldX, fieldY);
              addLog('トークンを配置した');
            });
          }}>
            トークンを置く（四角）
          </button>
          <button className="context-menu-item" onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const serverUrl = import.meta.env.VITE_SERVER_URL as string
                || (import.meta.env.DEV ? 'http://localhost:3210' : '');
              const formData = new FormData();
              formData.append('image', file);
              fetch(serverUrl + '/api/upload', { method: 'POST', body: formData })
                .then((res) => res.json())
                .then(({ url: imageUrl }: { url: string }) => {
                  const fullUrl = serverUrl ? serverUrl + imageUrl : imageUrl;
                  const img = new Image();
                  img.onload = () => {
                    const maxW = 300;
                    const scale = img.width > maxW ? maxW / img.width : 1;
                    saveSnapshot();
                    importImageAsCard(fullUrl, fieldX, fieldY, img.width * scale, img.height * scale);
                    addLog(`画像をカードとして配置した: ${file.name}`);
                  };
                  img.src = fullUrl;
                })
                .catch((err) => {
                  console.error('画像アップロード失敗', err);
                  useUIStore.getState().addToast('画像アップロードに失敗しました', 'error');
                });
            };
            input.click();
            hideContextMenu();
          }}>
            画像を置く
          </button>
          <div className="context-menu-separator" />
          <button className="context-menu-item" onClick={() => {
            setAreaDrawMode(true);
            hideContextMenu();
          }}>
            エリアを作成
          </button>
          {areas.length > 0 && (
            <button className="context-menu-item" onClick={() => {
              const csv = areasToCSV(areas);
              navigator.clipboard.writeText(csv);
              addLog('全エリアCSVをコピーした');
              hideContextMenu();
            }}>
              全エリアCSVコピー
            </button>
          )}
        </>
      )}
    </div>
  );
}
