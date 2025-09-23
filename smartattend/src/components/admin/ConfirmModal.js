import { useEffect } from 'react';

export default function ConfirmModal({ open, title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel?.(); }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-card" style={{ maxWidth: 420 }}>
        <h3 style={{ marginBottom: '0.75rem' }}>{title}</h3>
        <p style={{ marginBottom: '1rem', opacity: 0.9 }}>{message}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="form-button" onClick={onCancel} style={{ background: '#6b7280' }}>{cancelText}</button>
          <button className="form-button" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
