import { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../store/uiStore';
import './ModalDialog.css';

function ModalInner({ title, defaultValue, inputType, onSubmit, onCancel }: {
  title: string;
  defaultValue: string;
  inputType: string;
  onSubmit: ((value: string) => void) | null;
  onCancel: (() => void) | null;
}) {
  const hideModal = useUIStore((s) => s.hideModal);
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel?.();
        hideModal();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, hideModal]);

  const handleSubmit = () => {
    onSubmit?.(value);
    hideModal();
  };

  const handleCancel = () => {
    onCancel?.();
    hideModal();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        {inputType === 'text' ? (
          <input
            ref={inputRef}
            className="modal-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        ) : (
          <div className="modal-confirm-text">{defaultValue}</div>
        )}
        <div className="modal-actions">
          <button className="modal-btn modal-btn-cancel" onClick={handleCancel}>
            キャンセル
          </button>
          <button className="modal-btn modal-btn-ok" onClick={handleSubmit}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalDialog() {
  const modal = useUIStore((s) => s.modal);

  if (!modal.visible) return null;

  return (
    <ModalInner
      key={`${modal.title}-${modal.defaultValue}`}
      title={modal.title}
      defaultValue={modal.defaultValue}
      inputType={modal.inputType}
      onSubmit={modal.onSubmit}
      onCancel={modal.onCancel}
    />
  );
}
