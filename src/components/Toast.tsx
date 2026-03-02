import { useEffect, useState } from 'react';
import { useUIStore } from '../store/uiStore';
import type { ToastMessage } from '../store/uiStore';
import './Toast.css';

// 個別Toastアイテム（フェードアウトアニメーション管理）
function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // 消去の少し前にフェードアウト開始
    const fadeOutDuration = 400; // CSSアニメーション時間に合わせる
    const autoRemoveMs = toast.type === 'error' ? 5000 : 3000;
    const fadeTimer = setTimeout(() => setExiting(true), autoRemoveMs - fadeOutDuration);
    return () => clearTimeout(fadeTimer);
  }, [toast.type]);

  return (
    <div
      className={`toast toast-${toast.type} ${exiting ? 'toast-exit' : ''}`}
      onClick={() => onRemove(toast.id)}
    >
      {toast.text}
    </div>
  );
}

// Toastコンテナ（画面右下にスタック表示）
export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={removeToast} />
      ))}
    </div>
  );
}
