'use client';

export type TxStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

interface StatusToastProps {
  status: TxStatus;
  errorMessage?: string;
  onDismiss: () => void;
}

export function StatusToast({ status, errorMessage, onDismiss }: StatusToastProps) {
  if (status === 'idle') return null;

  const config: Record<TxStatus, { label: string; color: string; bg: string; border: string }> = {
    idle:       { label: '',                          color: '#fff',     bg: '#1a1a2e', border: '#ffffff22' },
    pending:    { label: 'Transaction sent...',       color: '#ffd700', bg: '#1a1500', border: '#ffd70033' },
    confirming: { label: 'Confirming on-chain...',    color: '#ff8855', bg: '#1a0d00', border: '#ff885533' },
    success:    { label: 'Transaction confirmed!',    color: '#00ff88', bg: '#001a0d', border: '#00ff8844' },
    error:      { label: errorMessage ?? 'Transaction failed.', color: '#ff4455', bg: '#1a0005', border: '#ff445533' },
  };

  const c = config[status];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 font-mono text-xs font-bold shadow-lg sm:left-auto sm:right-4 sm:max-w-[320px]"
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        boxShadow: `0 0 20px ${c.border}`,
      }}
    >
      {(status === 'pending' || status === 'confirming') && (
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2"
          style={{ borderColor: `${c.color}44`, borderTopColor: c.color }}
        />
      )}

      <span className="flex-1 leading-snug">{c.label}</span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="ml-2 shrink-0 opacity-50 transition-opacity hover:opacity-100 flex items-center justify-center w-11 h-11 -mr-2 rounded-full"
        style={{ color: c.color, fontSize: '1rem', lineHeight: 1 }}
      >
        x
      </button>
    </div>
  );
}
