import type { ReactNode } from 'react';
import type { QuizQuestionContent } from '../content/types';
import type { ShuffledChoice } from '../domain/shuffle';
import { ChoiceGroup } from './ChoiceGroup';
import type { ChoiceStatus } from './ChoiceGroup';

export interface QuestionReveal {
  correct: boolean;
  heading: string;
  /** "The answer: ..." line, shown only for a wrong pick. */
  answerLine: string;
  explain: string;
  /** The "Rewatch this part" or "Read the summary" link. Shown only for a wrong pick. */
  rewatch: ReactNode;
  statusText: Record<ChoiceStatus, string>;
}

interface QuizQuestionProps {
  question: QuizQuestionContent;
  /** The choices in the order shown. Each has a fixed id from the content, so answers don't depend on order. */
  choices: readonly ShuffledChoice[];
  /** Id of the picked choice, or null. */
  picked: string | null;
  onPick: (choiceId: string) => void;
  /** Set after "Check answer". Locks the choices and shows feedback. Null while answering, and always null in a test-out. */
  reveal: QuestionReveal | null;
}

/** One question: choices as radio inputs styled as slice buttons, then feedback once checked. */
export function QuizQuestion({ question, choices, picked, onPick, reveal }: QuizQuestionProps) {
  const options = choices;
  const status: Record<string, ChoiceStatus> = {};
  if (reveal) {
    status[question.answer] = 'correct';
    if (picked !== null && picked !== question.answer) status[picked] = 'incorrect';
  }
  return (
    <>
      <ChoiceGroup
        key={question.id}
        legend={question.question}
        options={options}
        kind="single"
        name={`quiz-${question.id}`}
        value={picked === null ? [] : [picked]}
        onChange={onPick}
        disabled={reveal !== null}
        status={reveal ? status : undefined}
        statusText={reveal?.statusText}
      />
      {reveal && (
        <div className={`feedback feedback--${reveal.correct ? 'correct' : 'wrong'}`} role="status">
          <p className="feedback__heading">{reveal.heading}</p>
          {!reveal.correct && <p>{reveal.answerLine}</p>}
          <p>{reveal.explain}</p>
          {!reveal.correct && <p>{reveal.rewatch}</p>}
        </div>
      )}
    </>
  );
}
