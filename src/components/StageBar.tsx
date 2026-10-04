import { STAGES } from '../domain/stages';
import type { Stage } from '../domain/types';

interface StageBarProps {
  /** 0-100, for the fill and the progressbar value. */
  percent: number;
  stage: Stage;
  /** Label under each dot. */
  names: Record<Stage, string>;
  label: string;
}

/** Home's progress bar: a track with a dot for each stage. Dots passed are filled, the current one is butter. */
export function StageBar({ percent, stage, names, label }: StageBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const current = STAGES.indexOf(stage);
  return (
    <div className="stage-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
      <div className="stage-bar__track">
        <div className="stage-bar__fill" style={{ width: `${clamped}%` }} />
      </div>
      {STAGES.map((s, i) => {
        const state = i < current ? 'passed' : i === current ? 'current' : 'future';
        const left = `${(i / (STAGES.length - 1)) * 100}%`;
        return (
          <span key={s}>
            <span className={`stage-bar__dot stage-bar__dot--${state}`} style={{ left }} />
            <span className={`stage-bar__label${state === 'current' ? ' stage-bar__label--current' : ''}`} style={{ left }}>
              {names[s]}
            </span>
          </span>
        );
      })}
    </div>
  );
}
