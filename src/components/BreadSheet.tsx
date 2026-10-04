import { fillTemplate } from '../content/template';
import type { BreadsContent } from '../content/types';
import type { BreadId } from '../domain/breads';
import { BreadPicker } from './BreadPicker';
import { LoafButton } from './LoafButton';
import { SliceButton } from './SliceButton';

interface BreadSheetProps {
  copy: BreadsContent;
  available: readonly BreadId[];
  value: BreadId;
  onChange: (bread: BreadId) => void;
  weeksLeft: (bread: BreadId) => number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The bread step before a loaf grows: pick a look from the default and everything unlocked, then go on. */
export function BreadSheet({ copy, available, value, onChange, weeksLeft, onConfirm, onCancel }: BreadSheetProps) {
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="bread-sheet-title">
      <div className="sheet__card">
        <h2 id="bread-sheet-title">{copy.picker.title}</h2>
        <p>{copy.picker.intro}</p>
        <BreadPicker copy={copy} available={available} value={value} onChange={onChange} weeksLeft={weeksLeft} />
        <LoafButton onClick={onConfirm}>{fillTemplate(copy.picker.button, { bread: copy.names[value] })}</LoafButton>
        <SliceButton onClick={onCancel}>{copy.picker.back}</SliceButton>
      </div>
    </div>
  );
}
