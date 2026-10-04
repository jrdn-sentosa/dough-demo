import type { TipStatus } from '../domain/tips';

interface TipRowProps {
  id: string;
  title: string;
  body: string;
  status: TipStatus;
  /** "Read", "Unlocked at Proof", "Unlocks at Bake" ... */
  meta: string;
  newLabel: string;
  open: boolean;
  onToggle: () => void;
}

const lockIcon = (
  <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7A6552" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const checkIcon = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L19 7" />
  </svg>
);

const sparkIcon = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2B1B12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" />
    <circle cx="12" cy="12" r="3.5" />
  </svg>
);

/**
 * One rising tip. Locked tips are not buttons. Unlocked ones open in place; a "New" badge shows
 * until the first time they are opened.
 */
export function TipRow({ id, title, body, status, meta, newLabel, open, onToggle }: TipRowProps) {
  if (status === 'locked') {
    return (
      <div className="tip tip--locked" aria-disabled="true">
        <span className="tip__icon tip__icon--locked">{lockIcon}</span>
        <span className="tip__text">
          <span className="tip__title">{title}</span>
          <span className="tip__meta">{meta}</span>
        </span>
      </div>
    );
  }
  return (
    <div className="tip-wrap">
      <button type="button" className="tip" aria-expanded={open} aria-controls={`tip-${id}`} onClick={onToggle}>
        <span className={`tip__icon ${status === 'new' ? 'tip__icon--new' : 'tip__icon--read'}`}>{status === 'new' ? sparkIcon : checkIcon}</span>
        <span className="tip__text">
          <span className="tip__title">{title}</span>
          <span className="tip__meta">{meta}</span>
        </span>
        {status === 'new' && <span className="tip__new">{newLabel}</span>}
      </button>
      {open && (
        <p className="tip__body" id={`tip-${id}`}>
          {body}
        </p>
      )}
    </div>
  );
}
