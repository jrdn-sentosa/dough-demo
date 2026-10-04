import type { BreadsContent } from '../content/types';
import { fillTemplate } from '../content/template';
import { BREAD_IDS, DEFAULT_BREAD } from '../domain/breads';
import type { BreadId } from '../domain/breads';
import { loafArtUrl } from './loafArt';

interface BreadPickerProps {
  copy: BreadsContent;
  /** The breads that can be picked: the default plus everything unlocked. */
  available: readonly BreadId[];
  value: BreadId;
  onChange: (bread: BreadId) => void;
  /** Whole weeks of saving still to go for a locked bread. */
  weeksLeft: (bread: BreadId) => number;
}

/**
 * Pick the look for the next loaf: the topic's default and every unlocked bread. Locked breads are shown but
 * can't be picked, with the weeks of saving left. Real radio inputs, styled like the other slice-button choices.
 */
export function BreadPicker({ copy, available, value, onChange, weeksLeft }: BreadPickerProps) {
  return (
    <fieldset className="choice-group bread-picker">
      <legend className="visually-hidden">{copy.picker.groupLabel}</legend>
      <div className="choice-group__options">
        {BREAD_IDS.map((bread) => {
          const open = available.includes(bread);
          const left = weeksLeft(bread);
          const tag = open
            ? bread === DEFAULT_BREAD
              ? copy.picker.defaultTag
              : copy.picker.unlockedTag
            : left === 1
              ? copy.picker.lockedOne
              : fillTemplate(copy.picker.locked, { count: String(left) });
          return (
            <label key={bread} className={`choice${open ? '' : ' choice--locked'}`}>
              <input
                className="choice__input"
                type="radio"
                name="bread"
                checked={value === bread}
                disabled={!open}
                onChange={() => onChange(bread)}
              />
              <span className="choice__label bread-option">
                <img className="bread-option__art" src={loafArtUrl(bread, 'bake')} alt="" aria-hidden="true" />
                <span className="bread-option__name">{copy.names[bread]}</span>
                <span className="bread-option__tag">{tag}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
