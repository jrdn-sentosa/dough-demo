import type { BreadsContent } from '../content/types';
import type { StreakView } from '../screens/Home/streakView';
import { loafArtUrl } from './loafArt';

/** The current streak and the next unlock, in the habit card's style. The bread beside it is the latest one unlocked. */
export function StreakCard({ view, copy }: { view: StreakView; copy: BreadsContent }) {
  return (
    <section className="habit-card streak-card" aria-label={copy.streak.label}>
      <div>
        <div className="habit-card__label">{copy.streak.label}</div>
        <div className="habit-card__value">{view.value}</div>
        <div className="streak-card__line">{view.line}</div>
      </div>
      {view.pill ? (
        <span className="habit-card__status">{view.pill}</span>
      ) : (
        view.latest && <img className="streak-card__bread" src={loafArtUrl(view.latest, 'baked')} alt="" aria-hidden="true" />
      )}
    </section>
  );
}
