import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { getPlacement } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { DEFAULT_GOAL_CENTS } from '../../domain/bands';
import { startingPoint } from '../../domain/placement';
import { answersFromProfile } from '../../domain/profile';
import { formatCents } from '../../money/format';

const monthsText = (n: number) => `${n} month${n === 1 ? '' : 's'}`;

/** "Here's where you'll start": first loaf, the goal in dollars and months, and the head start. */
export function PlacementResult() {
  const { data } = useData();
  const navigate = useNavigate();
  const content = getPlacement();
  const r = content.result;
  const profile = data?.profile;
  if (!profile) return null;

  const start = startingPoint(answersFromProfile(profile));
  const skipped = profile.placementStatus === 'skipped';
  const goal = formatCents(start.targetCents ?? DEFAULT_GOAL_CENTS);

  return (
    <div className="result">
      <h1 className="screen-title">{r.title}</h1>
      <DraftNote draft={content.draft} />

      <div className="card stack-tight">
        {skipped ? (
          <p>{fillTemplate(content.resultSkipped, { goal: formatCents(DEFAULT_GOAL_CENTS) })}</p>
        ) : start.emergencyFundBaked ? (
          <p>{r.baked}</p>
        ) : (
          <>
            <p className="result__loaf">{r.firstLoaf}</p>
            <p>
              {start.targetMonths !== null
                ? fillTemplate(r.goalMonths, { goal, months: monthsText(start.targetMonths) })
                : fillTemplate(r.goalDefault, { goal })}
            </p>
            <p>
              {start.countSavingsByDefault && start.existingSavingsCents > 0
                ? fillTemplate(r.headStart, {
                    saved: formatCents(start.existingSavingsCents),
                    percent: String(start.startPercent),
                  })
                : r.noHeadStart}
            </p>
            {start.showInvestmentNote && <p>{r.investmentNote}</p>}
          </>
        )}
      </div>

      <div className="result__actions">
        <LoafButton onClick={() => navigate('/new-loaf')}>{r.continue}</LoafButton>
      </div>
    </div>
  );
}
