interface Option {
  id: string;
  label: string;
}

/** After "Check answer": the right choice is sage, a wrong pick is crust. Never red. */
export type ChoiceStatus = 'correct' | 'incorrect';

interface ChoiceGroupProps {
  legend: string;
  help?: string | null;
  options: readonly Option[];
  /** `single` renders radio inputs, `multi` renders checkboxes. Both are styled as slice buttons. */
  kind: 'single' | 'multi';
  name: string;
  /** Selected option ids. */
  value: readonly string[];
  onChange: (id: string) => void;
  /** Locks every choice, for a question that has been checked. */
  disabled?: boolean;
  /** Marks choices as correct or incorrect. Text is added too, so color is never the only signal. */
  status?: Readonly<Record<string, ChoiceStatus>>;
  /** Spoken after the label for a status, e.g. { correct: 'correct answer', incorrect: 'your answer, not quite' }. */
  statusText?: Readonly<Record<ChoiceStatus, string>>;
}

/** Real radio or checkbox inputs, styled as slice buttons. */
export function ChoiceGroup({ legend, help, options, kind, name, value, onChange, disabled, status, statusText }: ChoiceGroupProps) {
  return (
    <fieldset className="choice-group">
      <legend className="choice-group__legend">{legend}</legend>
      {help && <p className="choice-group__help">{help}</p>}
      <div className="choice-group__options">
        {options.map((o) => {
          const s = status?.[o.id];
          return (
            <label key={o.id} className={s ? `choice choice--${s}` : 'choice'}>
              <input
                className="choice__input"
                type={kind === 'single' ? 'radio' : 'checkbox'}
                name={name}
                checked={value.includes(o.id)}
                disabled={disabled}
                onChange={() => onChange(o.id)}
              />
              <span className="choice__label">
                {o.label}
                {s && statusText && <span className="visually-hidden"> ({statusText[s]})</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
