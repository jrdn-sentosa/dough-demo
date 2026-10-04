import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { BakedLoaf } from '../../components/BakedLoaf';
import { DraftNote } from '../../components/DraftNote';
import { OutlineLoaf } from '../../components/OutlineLoaf';
import { SliceButton } from '../../components/SliceButton';
import { getLoaf } from '../../content/loader';
import { isMastered } from '../../domain/mastery';
import { formatCents } from '../../money/format';
import { balanceCents } from '../../money/ledger';
import { FLOW_LOAF } from '../useLessonFlow';
import { bakeLabel } from './labels';

/** The loaves on the shelf are the ones that are baked soon: Index funds, Bonds and Roth IRA, as in the mockup. */
const UPCOMING = ['index-funds', 'bonds', 'roth-ira'] as const;

/**
 * "Your bread shelf": every bake from the loaf's bakes list, newest last (a grown fund has two entries),
 * "Already built" with no date when it was baked at the start, and dashed outlines for what's coming.
 */
export function Shelf() {
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('the shelf needs a built loaf');
  const copy = loaf.flow.shelf;
  const { data } = useData();
  const navigate = useNavigate();

  const record = data?.loaves.find((l) => l.loafId === FLOW_LOAF);
  if (!data || !record) return null;
  const essentials = data.profile?.essentialsCents ?? null;
  const mastered = isMastered(data.quizAttempts, FLOW_LOAF);

  return (
    <div className="shelf-screen">
      <div className="shelf-screen__header">
        <h1 className="shelf-screen__title">{copy.title}</h1>
        <p className="shelf-screen__intro">{copy.intro}</p>
        <DraftNote draft={loaf.draft} />
      </div>

      <section className="shelf-total" aria-label={copy.totalLabel}>
        <span className="shelf-total__label">{copy.totalLabel}</span>
        <span className="shelf-total__value">{formatCents(balanceCents(data, FLOW_LOAF))}</span>
      </section>

      <section className="shelf" aria-label={copy.bakedHeading}>
        <h2>{copy.bakedHeading}</h2>
        <ul className="shelf__row">
          {record.bakes.map((bake, i) => {
            const label = bakeLabel(bake, essentials, copy);
            return (
              <li key={`${bake.targetCents}-${i}`} className="shelf__slot">
                <BakedLoaf loafId={FLOW_LOAF} mastered={mastered} width={96} sparkles={false} />
                <span className="shelf__name">{loaf.title}</span>
                <span className="shelf__sub">{label.sub}</span>
              </li>
            );
          })}
        </ul>
        <div className="shelf__plank" />
      </section>

      <section className="shelf shelf--soon" aria-label={copy.comingSoonHeading}>
        <h2>{copy.comingSoonHeading}</h2>
        <ul className="shelf__row">
          {UPCOMING.map((id) => {
            const upcoming = getLoaf(id);
            return (
              <li key={id} className="shelf__slot shelf__slot--soon">
                <OutlineLoaf loafId={id} width={84} />
                <span className="shelf__name">{upcoming.title}</span>
                <span className="shelf__sub">{copy.comingSoon}</span>
              </li>
            );
          })}
        </ul>
        <div className="shelf__plank shelf__plank--soon" />
      </section>

      <div className="shelf-screen__actions">
        <SliceButton onClick={() => navigate('/')}>{copy.back}</SliceButton>
      </div>
    </div>
  );
}
