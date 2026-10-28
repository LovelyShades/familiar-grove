import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Extra class for sizing (e.g. 'modal-wide'). */
  className?: string;
  children: ReactNode;
}

/** Shared glass dialog: Esc and backdrop close it, focus moves inside on open. */
export function Modal({ open, onClose, title, className = '', children }: Props) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    card.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`glass modal-card ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={card}>
        <header className="modal-header">
          <h2 className="panel-title">{title}</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label={`Close ${title}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
