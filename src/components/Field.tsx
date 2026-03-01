import { useCallback, useRef, useEffect, useLayoutEffect, useState, createContext } from 'react';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';
import { CardComponent } from './CardComponent';
import { CardStackComponent } from './CardStack';
import { AreaOverlay } from './AreaOverlay';
import { CounterComponent } from './Counter';
import { ImageOverlay } from './ImageOverlay';
import { MemoComponent } from './MemoComponent';
import { TokenComponent } from './TokenComponent';
import { Minimap } from './Minimap';
import { getCardSize, resolveTemplate } from '../utils/cardTemplate';
import { screenToField, FIELD_OFFSET } from '../utils/viewport';
import './Field.css';

const ViewportRefContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

export function Field() {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const cardInstances = useGameStore((s) => s.cardInstances);
  const cardDefinitions = useGameStore((s) => s.cardDefinitions);
  const cardTemplates = useGameStore((s) => s.cardTemplates);
  const cardStacks = useGameStore((s) => s.cardStacks);
  const areas = useGameStore((s) => s.areas);
  const counters = useGameStore((s) => s.counters);
  const images = useGameStore((s) => s.images);
  const memos = useGameStore((s) => s.memos);
  const tokens = useGameStore((s) => s.tokens);
  const addImage = useGameStore((s) => s.addImage);
  const addToStack = useGameStore((s) => s.addToStack);
  const createStack = useGameStore((s) => s.createStack);
  const mergeStacks = useGameStore((s) => s.mergeStacks);
  const addLog = useGameStore((s) => s.addLog);

  const gridEnabled = useUIStore((s) => s.gridEnabled);
  const cellSize = useUIStore((s) => s.cellSize);
  const zoom = useUIStore((s) => s.zoom);
  const panX = useUIStore((s) => s.panX);
  const panY = useUIStore((s) => s.panY);
  const isPanning = useUIStore((s) => s.isPanning);
  const showContextMenu = useUIStore((s) => s.showContextMenu);
  const hideContextMenu = useUIStore((s) => s.hideContextMenu);
  const setPan = useUIStore((s) => s.setPan);
  const setIsPanning = useUIStore((s) => s.setIsPanning);
  const setViewportSize = useUIStore((s) => s.setViewportSize);
  const areaDrawMode = useUIStore((s) => s.areaDrawMode);
  const setAreaDrawMode = useUIStore((s) => s.setAreaDrawMode);
  const snapGuides = useUIStore((s) => s.snapGuides);
  const addArea = useGameStore((s) => s.addArea);

  const defMap = new Map(cardDefinitions.map((d) => [d.id, d]));

  // エリア描画
  const areaDrawRef = useRef<{ startFieldX: number; startFieldY: number } | null>(null);
  const [drawingRect, setDrawingRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // 範囲選択
  const selectionRef = useRef<{ startFieldX: number; startFieldY: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const setSelectedCards = useUIStore((s) => s.setSelectedCards);
  const clearSelection = useUIStore((s) => s.clearSelection);

  // 初期センタリング（描画前に同期実行）
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      useUIStore.setState({
        panX: FIELD_OFFSET - width / 2,
        panY: FIELD_OFFSET - height / 2,
        viewportSize: { width, height },
      });
    }
  }, []);

  // Viewport size tracking (リサイズ時のみ)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;
      setViewportSize(width, height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewportSize]);

  // Space key tracking for pan mode
  const [spaceHeld, setSpaceHeld] = useState(false);
  const spaceHeldRef = useRef(false);
  const panDragRef = useRef<{ startX: number; startY: number; origPanX: number; origPanY: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        spaceHeldRef.current = true;
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        setSpaceHeld(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // 画像ドラッグ&ドロップ
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1) setIsDragOver(true);
    };
    const handleDragLeave = () => {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) setIsDragOver(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const url = URL.createObjectURL(file);
        const fp = screenToField(e.clientX, e.clientY, el);
        const img = new Image();
        img.onload = () => {
          const maxW = 300;
          const scale = img.width > maxW ? maxW / img.width : 1;
          addImage(url, fp.x, fp.y, img.width * scale, img.height * scale);
          addLog(`画像を配置した: ${file.name}`);
        };
        img.src = url;
      }
    };
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
    return () => {
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, [addImage, addLog]);

  // Wheel zoom (attached with passive: false)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { zoom, panX, panY } = useUIStore.getState();
      const rect = el.getBoundingClientRect();
      const cursorFieldX = (e.clientX - rect.left) / zoom + panX;
      const cursorFieldY = (e.clientY - rect.top) / zoom + panY;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      useUIStore.getState().setZoom(zoom * factor, cursorFieldX, cursorFieldY);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pan or Area draw or Selection
  const handleViewportPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || e.button === 0) {
      e.preventDefault();
      e.stopPropagation();

      // Space+左クリック → 強制パン（エリア描画・範囲選択より優先）
      if (spaceHeldRef.current && e.button === 0) {
        clearSelection();
        const { panX, panY } = useUIStore.getState();
        panDragRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
        setIsPanning(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // エリア描画モード
      if (areaDrawMode && e.button === 0 && viewportRef.current) {
        const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
        areaDrawRef.current = { startFieldX: fp.x, startFieldY: fp.y };
        setDrawingRect({ x: fp.x, y: fp.y, w: 0, h: 0 });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // Shift+左クリック → 範囲選択
      if (e.shiftKey && e.button === 0 && viewportRef.current) {
        const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
        selectionRef.current = { startFieldX: fp.x, startFieldY: fp.y };
        setSelectionRect({ x: fp.x, y: fp.y, w: 0, h: 0 });
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // 通常クリックで選択解除
      clearSelection();

      const { panX, panY } = useUIStore.getState();
      panDragRef.current = { startX: e.clientX, startY: e.clientY, origPanX: panX, origPanY: panY };
      setIsPanning(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, [setIsPanning, areaDrawMode, clearSelection]);

  const handleViewportPointerMove = useCallback((e: React.PointerEvent) => {
    // エリア描画中
    if (areaDrawRef.current && viewportRef.current) {
      const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
      const sx = areaDrawRef.current.startFieldX;
      const sy = areaDrawRef.current.startFieldY;
      setDrawingRect({
        x: Math.min(sx, fp.x),
        y: Math.min(sy, fp.y),
        w: Math.abs(fp.x - sx),
        h: Math.abs(fp.y - sy),
      });
      return;
    }

    // 範囲選択中
    if (selectionRef.current && viewportRef.current) {
      const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
      const sx = selectionRef.current.startFieldX;
      const sy = selectionRef.current.startFieldY;
      setSelectionRect({
        x: Math.min(sx, fp.x),
        y: Math.min(sy, fp.y),
        w: Math.abs(fp.x - sx),
        h: Math.abs(fp.y - sy),
      });
      return;
    }

    if (!panDragRef.current) return;
    const { zoom } = useUIStore.getState();
    const dx = (e.clientX - panDragRef.current.startX) / zoom;
    const dy = (e.clientY - panDragRef.current.startY) / zoom;
    setPan(panDragRef.current.origPanX - dx, panDragRef.current.origPanY - dy);
  }, [setPan]);

  const handleViewportPointerUp = useCallback((e: React.PointerEvent) => {
    // 範囲選択完了
    if (selectionRef.current && viewportRef.current) {
      const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
      const sx = selectionRef.current.startFieldX;
      const sy = selectionRef.current.startFieldY;

      const rx = Math.min(sx, fp.x);
      const ry = Math.min(sy, fp.y);
      const rw = Math.abs(fp.x - sx);
      const rh = Math.abs(fp.y - sy);

      selectionRef.current = null;
      setSelectionRect(null);

      // 矩形内のカードを選択
      const state = useGameStore.getState();
      const defMap = new Map(state.cardDefinitions.map((d) => [d.id, d]));
      const selected: string[] = [];

      for (const card of Object.values(state.cardInstances)) {
        if (card.stackId) continue;
        const def = defMap.get(card.definitionId);
        const tmpl = resolveTemplate(state.cardTemplates, def?.template as string | undefined);
        const cardSize = getCardSize(tmpl);
        if (
          card.x + cardSize.width > rx && card.x < rx + rw &&
          card.y + cardSize.height > ry && card.y < ry + rh
        ) {
          selected.push(card.instanceId);
        }
      }

      if (selected.length > 0) {
        setSelectedCards(selected);
        addLog(`${selected.length}枚のカードを選択した`);
      }
      return;
    }

    // エリア描画完了
    if (areaDrawRef.current && viewportRef.current) {
      const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
      const sx = areaDrawRef.current.startFieldX;
      const sy = areaDrawRef.current.startFieldY;
      const { cellSize } = useUIStore.getState();

      const rx = Math.min(sx, fp.x);
      const ry = Math.min(sy, fp.y);
      const rw = Math.abs(fp.x - sx);
      const rh = Math.abs(fp.y - sy);

      const gx = Math.round(rx / cellSize);
      const gy = Math.round(ry / cellSize);
      const gw = Math.max(1, Math.round(rw / cellSize));
      const gh = Math.max(1, Math.round(rh / cellSize));

      areaDrawRef.current = null;
      setDrawingRect(null);

      if (gw > 0 && gh > 0) {
        const defaultName = `area_${Date.now() % 10000}`;
        useUIStore.getState().showModal('エリア名を入力', defaultName, 'text', (name) => {
          if (!name.trim()) return;
          addArea({
            areaId: name.trim().replace(/\s+/g, '_').toLowerCase(),
            name: name.trim(),
            x: gx,
            y: gy,
            width: gw,
            height: gh,
            visibility: 'public',
            perPlayer: false,
          });
          addLog(`エリア「${name.trim()}」を作成した`);
        });
      }
      setAreaDrawMode(false);
      return;
    }

    if (panDragRef.current) {
      panDragRef.current = null;
      setIsPanning(false);
    }
  }, [setIsPanning, addArea, addLog, setAreaDrawMode, setSelectedCards]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!viewportRef.current) return;
    const fp = screenToField(e.clientX, e.clientY, viewportRef.current);
    showContextMenu(e.clientX, e.clientY, fp.x, fp.y, 'field', null);
  }, [showContextMenu]);

  const handleClick = useCallback(() => {
    hideContextMenu();
  }, [hideContextMenu]);

  // カードドロップ時の自動スタック判定（裏向き同士のみ山札化）
  const checkAutoStack = useCallback((instanceId: string) => {
    const state = useGameStore.getState();
    const card = state.cardInstances[instanceId];
    if (!card || card.stackId) return;

    const dMap = new Map(state.cardDefinitions.map((d) => [d.id, d]));
    const def = dMap.get(card.definitionId);
    const tmpl = resolveTemplate(state.cardTemplates, def?.template as string | undefined);
    const cardSize = getCardSize(tmpl);
    const threshold = cardSize.width * 0.3;
    const isFaceDown = card.face === 'down';

    // 山札に追加（ドロップカードが裏向きのみ）
    if (isFaceDown) {
      for (const stack of Object.values(state.cardStacks)) {
        const dx = Math.abs(card.x - stack.x);
        const dy = Math.abs(card.y - stack.y);
        if (dx < threshold && dy < threshold) {
          addToStack(stack.stackId, instanceId);
          addLog('カードを山札に追加した');
          return;
        }
      }
    }

    // カード同士で新しい山札を作成（両方裏向きのみ）
    if (isFaceDown) {
      for (const other of Object.values(state.cardInstances)) {
        if (other.instanceId === instanceId || other.stackId) continue;
        if (other.face !== 'down') continue;
        const dx = Math.abs(card.x - other.x);
        const dy = Math.abs(card.y - other.y);
        if (dx < threshold && dy < threshold) {
          createStack([other.instanceId, instanceId], other.x, other.y);
          addLog('カードを重ねて山札を作成した');
          return;
        }
      }
    }
  }, [addToStack, createStack, addLog]);

  const checkAutoStackForStack = useCallback((stackId: string) => {
    const state = useGameStore.getState();
    const stack = state.cardStacks[stackId];
    if (!stack) return;

    // スタックのトップカードのテンプレサイズを使う
    const dMap = new Map(state.cardDefinitions.map((d) => [d.id, d]));
    const topId = stack.cardInstanceIds[0];
    const topCard = topId ? state.cardInstances[topId] : null;
    const topDef = topCard ? dMap.get(topCard.definitionId) : null;
    const tmpl = resolveTemplate(state.cardTemplates, topDef?.template as string | undefined);
    const cardSize = getCardSize(tmpl);
    const threshold = cardSize.width * 0.3;

    // 山札同士の結合
    for (const other of Object.values(state.cardStacks)) {
      if (other.stackId === stackId) continue;
      const dx = Math.abs(stack.x - other.x);
      const dy = Math.abs(stack.y - other.y);
      if (dx < threshold && dy < threshold) {
        mergeStacks(other.stackId, stackId);
        addLog('山札同士を結合した');
        return;
      }
    }

    // 裏向きカードのみ山札に吸収
    for (const card of Object.values(state.cardInstances)) {
      if (card.stackId || card.face !== 'down') continue;
      const dx = Math.abs(stack.x - card.x);
      const dy = Math.abs(stack.y - card.y);
      if (dx < threshold && dy < threshold) {
        addToStack(stackId, card.instanceId);
        addLog('カードを山札に追加した');
        return;
      }
    }
  }, [mergeStacks, addToStack, addLog]);

  const singleCards = Object.values(cardInstances).filter((c) => !c.stackId);
  const canvasTransform = `scale(${zoom}) translate(${-panX}px, ${-panY}px)`;

  return (
    <ViewportRefContext.Provider value={viewportRef}>
      <div
        ref={viewportRef}
        className={`field-viewport ${isPanning ? 'panning' : ''} ${areaDrawMode ? 'area-draw-mode' : ''} ${spaceHeld ? 'space-pan' : ''}`}
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
      >
        <div
          className={`field-canvas ${gridEnabled ? 'field-grid' : ''}`}
          style={{
            '--cell-size': `${cellSize}px`,
            transform: canvasTransform,
            transformOrigin: '0 0',
          } as React.CSSProperties}
        >
          {areas.map((area) => (
            <AreaOverlay key={area.areaId} area={area} />
          ))}

          {singleCards.map((instance) => {
            const def = defMap.get(instance.definitionId);
            if (!def) return null;
            const tmpl = resolveTemplate(cardTemplates, def.template as string | undefined);
            return (
              <CardComponent
                key={instance.instanceId}
                instance={instance}
                definition={def}
                template={tmpl}
                onDragEnd={checkAutoStack}
              />
            );
          })}

          {Object.values(cardStacks).map((stack) => {
            // スタックのトップカードのテンプレートを使用
            const topId = stack.cardInstanceIds[0];
            const topCard = topId ? cardInstances[topId] : null;
            const topDef = topCard ? defMap.get(topCard.definitionId) : null;
            const tmpl = resolveTemplate(cardTemplates, topDef?.template as string | undefined);
            return (
              <CardStackComponent
                key={stack.stackId}
                stack={stack}
                template={tmpl}
                onDragEnd={checkAutoStackForStack}
              />
            );
          })}

          {Object.values(images).map((image) => (
            <ImageOverlay key={image.imageId} image={image} />
          ))}

          {Object.values(counters).map((counter) => (
            <CounterComponent key={counter.counterId} counter={counter} />
          ))}

          {Object.values(memos).map((memo) => (
            <MemoComponent key={memo.memoId} memo={memo} />
          ))}

          {Object.values(tokens).map((token) => (
            <TokenComponent key={token.tokenId} token={token} />
          ))}

          {drawingRect && (
            <div
              className="area-drawing-preview"
              style={{
                left: drawingRect.x + FIELD_OFFSET,
                top: drawingRect.y + FIELD_OFFSET,
                width: drawingRect.w,
                height: drawingRect.h,
              }}
            />
          )}

          {selectionRect && (
            <div
              className="selection-preview"
              style={{
                left: selectionRect.x + FIELD_OFFSET,
                top: selectionRect.y + FIELD_OFFSET,
                width: selectionRect.w,
                height: selectionRect.h,
              }}
            />
          )}

          {snapGuides.map((g, i) =>
            g.type === 'v' ? (
              <div key={`sg${i}`} className="snap-guide snap-guide-v" style={{ left: g.pos + FIELD_OFFSET }} />
            ) : (
              <div key={`sg${i}`} className="snap-guide snap-guide-h" style={{ top: g.pos + FIELD_OFFSET }} />
            )
          )}
        </div>
        <Minimap />
        {isDragOver && (
          <div className="drop-overlay">
            <div className="drop-overlay-text">画像をドロップして配置</div>
          </div>
        )}
      </div>
    </ViewportRefContext.Provider>
  );
}
