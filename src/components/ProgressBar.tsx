interface ProgressBarProps {
  /** 0-100. */
  percent: number;
  label: string;
  /** Spoken value, e.g. "Question 2 of 5". */
  valueText?: string;
}

export function ProgressBar({ percent, label, valueText }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
    >
      <div className="progress-bar__fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
