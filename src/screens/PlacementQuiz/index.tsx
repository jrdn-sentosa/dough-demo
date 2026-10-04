import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useData } from '../../app/DataProvider';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { ProgressBar } from '../../components/ProgressBar';
import { SliceButton } from '../../components/SliceButton';
import { getPlacement } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { retakePlacement, savePlacement } from '../../data/profile';
import { DEFAULT_GOAL_CENTS } from '../../domain/bands';
import { answersFromProfile } from '../../domain/profile';
import { answersFromSelections, safeReturnPath, selectionsFromAnswers, toggleAccount } from '../../domain/placementInput';
import type { Selections } from '../../domain/placementInput';
import { questionsToAsk } from '../../domain/retake';
import { formatCents } from '../../money/format';
import { FLOW_LOAF } from '../useLessonFlow';

const asList = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/**
 * One question per screen, and every question can be skipped. Skipping keeps what was answered.
 * With `?retake=1` it reruns placement with the current answers filled in, then goes back to
 * `?return=` (for example "Personalize" on Choose your next loaf). A retake never touches the savings or history.
 */
export function PlacementQuiz() {
  const content = getPlacement();
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const retake = params.get('retake') === '1';
  const returnTo = safeReturnPath(params.get('return'));

  // A retake skips the existing-savings question once the loaf has transactions: that money is already tracked.
  const hasTransactions = data?.transactions.some((t) => t.loafId === FLOW_LOAF) ?? false;
  const [questions] = useState(() => {
    if (!retake) return content.questions;
    const ask = questionsToAsk(hasTransactions);
    return content.questions.filter((q) => ask.some((id) => id === q.id));
  });
  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<Selections>(() =>
    retake && data?.profile ? selectionsFromAnswers(answersFromProfile(data.profile)) : {},
  );
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  const question = questions[index];
  const selected = asList(selections[question.id]);
  const isLast = index === questions.length - 1;

  function choose(id: string) {
    setSelections((prev) => ({
      ...prev,
      [question.id]: question.kind === 'multi' ? toggleAccount(asList(prev[question.id]), id) : id,
    }));
  }

  async function finish() {
    const answers = answersFromSelections(selections);
    if (retake) {
      await retakePlacement(adapter, answers, FLOW_LOAF);
      await refresh();
      navigate(returnTo, { replace: true });
      return;
    }
    await savePlacement(adapter, answers);
    await refresh();
    navigate('/placement/result', { replace: true });
  }

  function next() {
    if (isLast) void finish();
    else setIndex(index + 1);
  }

  return (
    <div className="placement">
      <ProgressBar
        percent={((index + 1) / questions.length) * 100}
        label="Placement progress"
        valueText={`Question ${index + 1} of ${questions.length}`}
      />
      <p className="placement__eyebrow">{retake ? content.retake.eyebrow : content.title}</p>
      {index === 0 && <p className="placement__intro">{retake ? content.retake.intro : content.intro}</p>}
      <DraftNote draft={content.draft} />

      <ChoiceGroup
        key={question.id}
        legend={question.prompt}
        help={question.help}
        options={question.options}
        kind={question.kind}
        name={question.id}
        value={selected}
        onChange={choose}
      />

      <div className="placement__actions">
        <LoafButton onClick={next} disabled={selected.length === 0}>
          {isLast ? (retake ? content.retake.done : 'See my start') : 'Next'}
        </LoafButton>
        {index > 0 && (
          <SliceButton onClick={() => setIndex(index - 1)}>Back</SliceButton>
        )}
        <button type="button" className="text-button" onClick={() => (retake ? void finish() : setConfirmingSkip(true))}>
          {content.skip.label}
        </button>
      </div>

      {confirmingSkip && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="skip-text">
          <div className="sheet__card">
            <p id="skip-text">{fillTemplate(content.skip.confirm, { goal: formatCents(DEFAULT_GOAL_CENTS) })}</p>
            <LoafButton onClick={() => void finish()}>{content.skip.confirmSkip}</LoafButton>
            <SliceButton onClick={() => setConfirmingSkip(false)}>{content.skip.confirmKeep}</SliceButton>
          </div>
        </div>
      )}
    </div>
  );
}
