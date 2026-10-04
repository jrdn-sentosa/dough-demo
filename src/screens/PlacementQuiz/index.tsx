import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { ProgressBar } from '../../components/ProgressBar';
import { SliceButton } from '../../components/SliceButton';
import { getPlacement } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { savePlacement } from '../../data/profile';
import { DEFAULT_GOAL_CENTS } from '../../domain/bands';
import { answersFromSelections, toggleAccount } from '../../domain/placementInput';
import type { Selections } from '../../domain/placementInput';
import { formatCents } from '../../money/format';

const asList = (v: string | string[] | undefined): string[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** One question per screen, and every question can be skipped. Skipping keeps what was answered. */
export function PlacementQuiz() {
  const content = getPlacement();
  const { adapter, refresh } = useData();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [selections, setSelections] = useState<Selections>({});
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  const question = content.questions[index];
  const selected = asList(selections[question.id]);
  const isLast = index === content.questions.length - 1;

  function choose(id: string) {
    setSelections((prev) => ({
      ...prev,
      [question.id]: question.kind === 'multi' ? toggleAccount(asList(prev[question.id]), id) : id,
    }));
  }

  async function finish() {
    await savePlacement(adapter, answersFromSelections(selections));
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
        percent={((index + 1) / content.questions.length) * 100}
        label="Placement progress"
        valueText={`Question ${index + 1} of ${content.questions.length}`}
      />
      <p className="placement__eyebrow">{content.title}</p>
      {index === 0 && <p className="placement__intro">{content.intro}</p>}
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
          {isLast ? 'See my start' : 'Next'}
        </LoafButton>
        {index > 0 && (
          <SliceButton onClick={() => setIndex(index - 1)}>Back</SliceButton>
        )}
        <button type="button" className="text-button" onClick={() => setConfirmingSkip(true)}>
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
