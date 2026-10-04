import { Link } from 'react-router';

interface LessonRowProps {
  title: string;
  durationSeconds: number;
  href: string;
  watched: boolean;
  watchedLabel: string;
  /** A short tag like "Recommended" or "You already know this". */
  tag: string | null;
  /** Collapsed rows show only the title and tag until opened. */
  collapsed: boolean;
  watchAnywayLabel: string;
}

function length(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** One lesson on the lessons list. A collapsed row is a native `<details>`. */
export function LessonRow({ title, durationSeconds, href, watched, watchedLabel, tag, collapsed, watchAnywayLabel }: LessonRowProps) {
  const heading = (
    <>
      <span className="lesson-row__title">{title}</span>
      <span className="lesson-row__meta">
        {length(durationSeconds)}
        {watched && <span className="lesson-row__watched"> · ✓ {watchedLabel}</span>}
      </span>
      {tag && <span className="lesson-row__tag">{tag}</span>}
    </>
  );

  if (collapsed) {
    return (
      <li className="lesson-row lesson-row--collapsed">
        <details>
          <summary className="lesson-row__summary">{heading}</summary>
          <Link className="lesson-row__watch" to={href}>
            {watchAnywayLabel}
          </Link>
        </details>
      </li>
    );
  }
  return (
    <li className="lesson-row">
      <Link className="lesson-row__link" to={href}>
        {heading}
      </Link>
    </li>
  );
}
