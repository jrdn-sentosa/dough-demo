import { useLocation, useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { BakedLoaf } from '../../components/BakedLoaf';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { getLoaf } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { isMastered } from '../../domain/mastery';
import { monthsForTarget } from '../../domain/targets';
import { formatCents } from '../../money/format';
import { statusFor } from '../../money/ledger';
import { FLOW_LOAF } from '../useLessonFlow';

/** What the deposit that baked the loaf was. Passed in navigation state; a reload falls back to the first-bake copy. */
export interface CelebrationState {
  rebuilt?: boolean;
  grown?: boolean;
}

const CONFETTI: { left: number; top: number; w: number; h: number; color: string; rotate: number; round?: boolean }[] = [
  { left: 30, top: 30, w: 10, h: 10, color: 'var(--butter)', rotate: 20 },
  { left: 70, top: 6, w: 8, h: 14, color: 'var(--sage)', rotate: -30 },
  { left: 236, top: 18, w: 10, h: 10, color: 'var(--crust)', rotate: 45 },
  { left: 262, top: 64, w: 8, h: 14, color: 'var(--butter)', rotate: 30 },
  { left: 14, top: 92, w: 8, h: 12, color: 'var(--toast-edge)', rotate: -15 },
  { left: 200, top: 2, w: 7, h: 7, color: 'var(--sage)', rotate: 0, round: true },
];

/**
 * The celebration after a bake: first bake, a rebuilt fund, or a grown cushion. A golden finish, sparkles
 * and a pill when the lessons are mastered. The loaf scales up gently and the confetti settles (under 400ms;
 * reduced motion turns it off).
 */
export function LoafComplete() {
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('the celebration needs a built loaf');
  const copy = loaf.flow.celebration;
  const { data } = useData();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as CelebrationState;

  const record = data?.loaves.find((l) => l.loafId === FLOW_LOAF);
  if (!data || !record) return null;
  const status = statusFor(data, record);
  const mastered = isMastered(data.quizAttempts, FLOW_LOAF);
  const amount = formatCents(status.balanceCents);

  let title: string;
  let body: string;
  if (state.grown) {
    const essentials = data.profile?.essentialsCents ?? null;
    const months = essentials === null ? null : monthsForTarget(status.targetCents, essentials);
    const text = months !== null && Number.isInteger(months) && months >= 1 ? copy.grown : copy.grownNoMonths;
    title = fillTemplate(text.title, { months: String(months) });
    body = fillTemplate(text.body, { amount });
  } else {
    const text = state.rebuilt ? copy.rebuilt : copy.first;
    title = text.title;
    body = fillTemplate(text.body, { amount });
  }

  return (
    <div className="celebrate">
      <div className="celebrate__stage" aria-hidden="true">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="confetti"
            style={{
              left: c.left,
              top: c.top,
              width: c.w,
              height: c.h,
              background: c.color,
              borderRadius: c.round ? '50%' : 2,
              ['--tilt' as string]: `${c.rotate}deg`,
            }}
          />
        ))}
        <div className="celebrate__loaf">
          <BakedLoaf loafId={FLOW_LOAF} mastered={mastered} width={300} />
        </div>
      </div>
      <h1 className="celebrate__title">{title}</h1>
      <DraftNote draft={loaf.draft} />
      <p className="celebrate__body">{body}</p>
      {mastered && (
        <span className="pill pill--butter">
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2B1B12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L19 7" />
          </svg>
          {copy.mastered}
        </span>
      )}
      <p className="celebrate__tagline">{copy.tagline}</p>
      <div className="celebrate__actions">
        <LoafButton onClick={() => navigate('/choose-loaf')}>{copy.chooseNext}</LoafButton>
        <SliceButton onClick={() => navigate('/shelf')}>{copy.shelf}</SliceButton>
      </div>
    </div>
  );
}
