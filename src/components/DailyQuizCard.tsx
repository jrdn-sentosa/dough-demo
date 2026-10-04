import { useEffect, useMemo, useState } from 'react';
import { useData } from '../app/DataProvider';
import { fillTemplate } from '../content/template';
import { answerDailyQuiz, startDailyQuiz } from '../data/dailyQuiz';
import { entryForDay, type DailyQuizEntry } from '../domain/dailyQuiz';
import { localDayKey } from '../domain/days';
import { POINT_VALUES } from '../domain/points';
import { shuffle } from '../domain/shuffle';
import { nowFromData } from '../money/clock';
import { getPoints } from '../content/loader';
import { dailyPool } from '../screens/Home/dailyQuiz';
import { QuizQuestion } from './QuizQuestion';
import { SliceButton } from './SliceButton';

interface DailyQuizCardProps {
  /** The loaf quiz's feedback words ("Correct", "Not quite", "The answer: {answer}"), shared with the quiz screen. */
  quizCopy: { correct: string; notQuite: string; correctAnswer: string };
}

/**
 * A calm daily question on Home, drawn from the quizzes of mastered loaves. One try a day. A right answer
 * earns a point, and the explanation shows either way. It stays out of the way until a loaf is mastered, and it
 * never says anything about a day that was skipped.
 */
export function DailyQuizCard({ quizCopy }: DailyQuizCardProps) {
  const { adapter, data, refresh } = useData();
  const copy = getPoints().daily;
  const pool = useMemo(() => (data ? dailyPool(data) : []), [data]);
  const poolKey = pool.map((q) => `${q.loafId}/${q.id}`).join('|');

  const [entry, setEntry] = useState<DailyQuizEntry | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  // Ask for today's question. It is saved the first time, so reloading shows the same one.
  useEffect(() => {
    if (pool.length === 0) return;
    let cancelled = false;
    void startDailyQuiz(adapter, pool).then((e) => {
      if (!cancelled) setEntry(e);
    });
    return () => {
      cancelled = true;
    };
    // `pool` is derived from `poolKey`; only reask when the set of questions changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, poolKey]);

  const today = data ? entryForDay(data.dailyQuizzes, localDayKey(nowFromData(data))) : null;
  const current = today ?? entry;
  const item = current ? pool.find((q) => q.loafId === current.loafId && q.id === current.questionId) : undefined;
  const choices = useMemo(() => (item ? shuffle(item.question.choices) : []), [item]);

  if (!current || !item) return null;
  const question = item.question;
  const answered = current.choiceId !== null;
  const shownPick = answered ? current.choiceId : picked;

  async function check() {
    if (picked === null) return;
    const result = await answerDailyQuiz(
      adapter,
      { loafId: item!.loafId, questionId: item!.id, answer: question.answer },
      picked,
    );
    if (result) setEntry(result.entry);
    await refresh();
  }

  const correctLabel = question.choices.find((c) => c.id === question.answer)?.label ?? '';
  const reveal = answered
    ? {
        correct: current.correct === true,
        heading: current.correct ? fillTemplate(copy.right, { points: String(POINT_VALUES.quiz) }) : copy.wrong,
        answerLine: fillTemplate(quizCopy.correctAnswer, { answer: correctLabel }),
        explain: question.explain,
        rewatch: null,
        statusText: { correct: quizCopy.correct, incorrect: quizCopy.notQuite },
      }
    : null;

  return (
    <section className="card daily-quiz" aria-label={copy.title}>
      <h2>{copy.title}</h2>
      {!answered && <p className="daily-quiz__intro">{copy.intro}</p>}
      <QuizQuestion
        key={`${item.loafId}/${item.id}`}
        question={question}
        choices={choices}
        picked={shownPick}
        onPick={(id) => {
          if (!answered) setPicked(id);
        }}
        reveal={reveal}
      />
      {answered ? (
        <p className="daily-quiz__done">{copy.done}</p>
      ) : (
        <SliceButton onClick={() => void check()} disabled={picked === null}>
          {copy.check}
        </SliceButton>
      )}
    </section>
  );
}
