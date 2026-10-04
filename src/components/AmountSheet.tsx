import type { ReactNode } from 'react';
import { LoafButton } from './LoafButton';
import { SliceButton } from './SliceButton';

interface AmountSheetProps {
  id: string;
  title: string;
  intro?: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** The confirm button's text, already filled with the amount. */
  confirmLabel: string;
  cancelLabel: string;
  /** The amount can't be used yet (empty or not a dollar amount). */
  disabled: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A bottom sheet with one dollar field, used to add to the loaf and to use the fund. */
export function AmountSheet(props: AmountSheetProps) {
  const titleId = `${props.id}-title`;
  const inputId = `${props.id}-amount`;
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <form
        className="sheet__card"
        onSubmit={(e) => {
          e.preventDefault();
          if (!props.disabled) props.onConfirm();
        }}
      >
        <h2 id={titleId}>{props.title}</h2>
        {props.intro}
        <div className="field">
          <label htmlFor={inputId}>{props.label}</label>
          <input id={inputId} inputMode="decimal" autoFocus value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        </div>
        {props.error && (
          <p className="field-error" role="alert">
            {props.error}
          </p>
        )}
        <LoafButton type="submit" disabled={props.disabled}>
          {props.confirmLabel}
        </LoafButton>
        <SliceButton onClick={props.onCancel}>{props.cancelLabel}</SliceButton>
      </form>
    </div>
  );
}
