import { create } from 'zustand';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  fieldX: number;
  fieldY: number;
  targetType: 'card' | 'stack' | 'counter' | 'area' | 'image' | 'memo' | 'token' | 'field' | null;
  targetId: string | null;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface ModalState {
  visible: boolean;
  title: string;
  defaultValue: string;
  inputType: 'text' | 'confirm';
  onSubmit: ((value: string) => void) | null;
  onCancel: (() => void) | null;
}

interface UIState {
  gridEnabled: boolean;
  cellSize: number;
  contextMenu: ContextMenuState;
  selectedCardIds: string[];

  // ズーム/パン
  zoom: number;
  panX: number;
  panY: number;
  isPanning: boolean;
  viewportSize: { width: number; height: number };

  // エリア作成モード
  areaDrawMode: boolean;

  // エリア内ドロップ時のグリッド吸着
  areaSnap: boolean;

  // 神視点モード（山札以外の全カードを表向き表示）
  godView: boolean;

  // トースト通知
  toasts: ToastMessage[];

  // ドラッグ中のスナップガイド
  snapGuides: { type: 'h' | 'v'; pos: number }[];

  // モーダルダイアログ
  modal: ModalState;

  // 使い方ヘルプモーダル
  helpOpen: boolean;

  // 山札N枚公開モーダル
  revealModal: { stackId: string; cardIds: string[] } | null;

  toggleGrid: () => void;
  setCellSize: (size: number) => void;
  showContextMenu: (x: number, y: number, fieldX: number, fieldY: number, targetType: ContextMenuState['targetType'], targetId: string | null) => void;
  hideContextMenu: () => void;
  setSelectedCards: (ids: string[]) => void;
  clearSelection: () => void;

  setZoom: (newZoom: number, cursorFieldX: number, cursorFieldY: number) => void;
  setPan: (panX: number, panY: number) => void;
  setIsPanning: (isPanning: boolean) => void;
  setViewportSize: (width: number, height: number) => void;
  resetView: () => void;
  setAreaDrawMode: (enabled: boolean) => void;
  toggleAreaSnap: () => void;
  toggleGodView: () => void;

  addToast: (text: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  setSnapGuides: (guides: { type: 'h' | 'v'; pos: number }[]) => void;

  showModal: (title: string, defaultValue: string, inputType: 'text' | 'confirm', onSubmit: (value: string) => void, onCancel?: () => void) => void;
  hideModal: () => void;

  toggleHelp: () => void;

  openRevealModal: (stackId: string, cardIds: string[]) => void;
  closeRevealModal: () => void;
}

const emptyModal: ModalState = { visible: false, title: '', defaultValue: '', inputType: 'text', onSubmit: null, onCancel: null };

export const useUIStore = create<UIState>((set) => ({
  gridEnabled: true,
  cellSize: 10,
  contextMenu: { visible: false, x: 0, y: 0, fieldX: 0, fieldY: 0, targetType: null, targetId: null },
  selectedCardIds: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  isPanning: false,
  viewportSize: { width: 0, height: 0 },
  areaDrawMode: false,
  areaSnap: false,
  godView: false,
  toasts: [],
  snapGuides: [],
  modal: { ...emptyModal },
  helpOpen: false,
  revealModal: null,

  toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),
  setCellSize: (size) => set({ cellSize: size }),

  showContextMenu: (x, y, fieldX, fieldY, targetType, targetId) =>
    set({ contextMenu: { visible: true, x, y, fieldX, fieldY, targetType, targetId } }),

  hideContextMenu: () =>
    set({ contextMenu: { visible: false, x: 0, y: 0, fieldX: 0, fieldY: 0, targetType: null, targetId: null } }),

  setSelectedCards: (ids) => set({ selectedCardIds: ids }),
  clearSelection: () => set({ selectedCardIds: [] }),

  setZoom: (newZoom, cursorFieldX, cursorFieldY) => {
    const clamped = Math.max(0.25, Math.min(3.0, newZoom));
    set((s) => {
      const newPanX = cursorFieldX - (cursorFieldX - s.panX) * s.zoom / clamped;
      const newPanY = cursorFieldY - (cursorFieldY - s.panY) * s.zoom / clamped;
      return { zoom: clamped, panX: newPanX, panY: newPanY };
    });
  },

  setPan: (panX, panY) => set({ panX, panY }),
  setIsPanning: (isPanning) => set({ isPanning }),
  setViewportSize: (width, height) => set({ viewportSize: { width, height } }),
  resetView: () => set((s) => ({
    zoom: 1,
    panX: 10000 - s.viewportSize.width / 2,
    panY: 10000 - s.viewportSize.height / 2,
  })),
  setAreaDrawMode: (enabled) => set({ areaDrawMode: enabled }),
  toggleAreaSnap: () => set((s) => ({ areaSnap: !s.areaSnap })),
  toggleGodView: () => set((s) => ({ godView: !s.godView })),

  addToast: (text, type = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    // エラーは5秒、それ以外は3秒で自動消去
    const duration = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setSnapGuides: (guides) => set({ snapGuides: guides }),

  showModal: (title, defaultValue, inputType, onSubmit, onCancel) =>
    set({ modal: { visible: true, title, defaultValue, inputType, onSubmit: onSubmit, onCancel: onCancel || null } }),
  hideModal: () => set({ modal: { ...emptyModal } }),

  toggleHelp: () => set((s) => ({ helpOpen: !s.helpOpen })),

  openRevealModal: (stackId, cardIds) => set({ revealModal: { stackId, cardIds } }),
  closeRevealModal: () => set({ revealModal: null }),
}));
