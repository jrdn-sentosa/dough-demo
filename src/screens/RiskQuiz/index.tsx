import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { ProgressBar } from '../../components/ProgressBar';
import { SliceButton } from '../../components/SliceButton';
import { getRisk } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { saveRisk } from '../../data/profile';
import type { RiskAnswers, RiskQuestionId } from '../../domain/risk';

type Picks = Partial<Record<RiskQuestionId, string>>;

/** The picks that were made, as typed answers. Anything not picked stays unknown. */
function answersFromPicks(picks: Picks): RiskAnswers {
  const answers: Record<string, string> = {};
  for (const [id, value] of Object.entries(picks)) if (value !== undefined) answers[id] = value;
  return answers as RiskAnswers;
}

/**
 * The risk quiz: one question per screen with a progress bar, and no right answers.
 * Every screen can be skipped; skipping keeps what was answered and the rest take the most cautious answer.
 * A student who has taken it before sees their answers filled in.
 */
export function RiskQuiz() {
  const content = getRisk();
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<Picks>(() => ({ ...(data?.profile?.risk?.answers ?? {}) }));
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  const question = content.questions[index];
  const selected = picks[question.id];
  const isLast = index === content.questions.length - 1;

  async function finish() {
    await saveRisk(adapter, answersFromPicks(picks));
    await refresh();
    navigate('/risk-result', { replace: true });
  }

  return (
    <div className="placement">
      <ProgressBar
        percent={((index + 1) / content.questions.length) * 100}
        label={content.progressLabel}
        valueText={fillTemplate(content.questionOf, { n: String(index + 1), total: String(content.questions.length) })}
      />
      <p className="placement__eyebrow">{content.title}</p>
      {index === 0 && <p className="placement__intro">{content.intro}</p>}
      <DraftNote draft={content.draft} />

      <ChoiceGroup
        key={question.id}
        legend={question.prompt}
        help={question.help}
        options={question.options}
        kind="single"
        name={question.id}
        value={selected === undefined ? [] : [selected]}
        onChange={(id) => setPicks((prev) => ({ ...prev, [question.id]: id }))}
      />

      <div className="placement__actions">
        <LoafButton onClick={() => (isLast ? void finish() : setIndex(index + 1))} disabled={selected === undefined}>
          {isLast ? content.seeResult : content.next}
        </LoafButton>
        {index > 0 && <SliceButton onClick={() => setIndex(index - 1)}>{content.back}</SliceButton>}
        <button type="button" className="text-button" onClick={() => setConfirmingSkip(true)}>
          {content.skip.label}
        </button>
      </div>

      {confirmingSkip && (
        <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="risk-skip-text">
          <div className="sheet__card">
            <p id="risk-skip-text">{content.skip.confirm}</p>
            <LoafButton onClick={() => void finish()}>{content.skip.confirmSkip}</LoafButton>
            <SliceButton onClick={() => setConfirmingSkip(false)}>{content.skip.confirmKeep}</SliceButton>
          </div>
        </div>
      )}
    </div>
  );
}
