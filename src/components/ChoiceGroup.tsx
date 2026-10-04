interface Option {
  id: string;
  label: string;
}

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
}

/** Real radio or checkbox inputs, styled as slice buttons. */
export function ChoiceGroup({ legend, help, options, kind, name, value, onChange }: ChoiceGroupProps) {
  return (
    <fieldset className="choice-group">
      <legend className="choice-group__legend">{legend}</legend>
      {help && <p className="choice-group__help">{help}</p>}
      <div className="choice-group__options">
        {options.map((o) => (
          <label key={o.id} className="choice">
            <input
              className="choice__input"
              type={kind === 'single' ? 'radio' : 'checkbox'}
              name={name}
              checked={value.includes(o.id)}
              onChange={() => onChange(o.id)}
            />
            <span className="choice__label">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
