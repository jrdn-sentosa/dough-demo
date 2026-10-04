import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { ProgressBar } from '../../components/ProgressBar';
import { QuizQuestion } from '../../components/QuizQuestion';
import type { QuestionReveal } from '../../components/QuizQuestion';
import { SliceButton } from '../../components/SliceButton';
import { getLoaf, getPoints } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { answerDailyQuestion, startDailyQuiz } from '../../data/dailyQuiz';
import { isFinished, isPerfect, type DailyQuizEntry } from '../../domain/dailyQuiz';
import { POINT_VALUES } from '../../domain/points';
import { shuffle, type ShuffledChoice } from '../../domain/shuffle';
import { FLOW_LOAF } from '../useLessonFlow';
import { dailyPool } from '../Home/dailyQuiz';

/**
 * Today's daily quiz: one question at a time, with the explanation after each answer. One try a day: once a question
 * has an answer it can't change. Leaving partway and coming back picks up at the first question without an answer.
 */
export function DailyQuiz() {
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();
  const copy = getPoints().daily;
  const loaf = getLoaf(FLOW_LOAF);
  const pool = useMemo(() => (data ? dailyPool(data) : []), [data]);
  const poolKey = pool.map((q) => `${q.loafId}/${q.id}`).join('|');

  const [entry, setEntry] = useState<DailyQuizEntry | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  /** The quiz was already finished when this screen opened (as opposed to finished just now). */
  const [wasDone, setWasDone] = useState(false);
  /** Each question's choices in the order shown, shuffled once when the quiz loads so they stay put while answering. */
  const [orders, setOrders] = useState<Record<string, ShuffledChoice[]>>({});

  // Ask for today's questions. They are saved the first time, so reloading shows the same ones.
  useEffect(() => {
    if (poolKey === '') return;
    let cancelled = false;
    void startDailyQuiz(adapter, pool).then((e) => {
      if (cancelled || !e) return;
      setEntry(e);
      setOrders(
        Object.fromEntries(
          e.questions.flatMap((asked) => {
            const item = pool.find((q) => q.loafId === asked.loafId && q.id === asked.questionId);
            return item ? [[`${item.loafId}/${item.id}`, shuffle(item.question.choices)]] : [];
          }),
        ),
      );
      setWasDone((was) => (index === null ? isFinished(e) : was));
      const next = e.questions.findIndex((q) => q.choiceId === null);
      setIndex((current) => current ?? (next === -1 ? e.questions.length : next));
    });
    return () => {
      cancelled = true;
    };
    // `pool` is derived from `poolKey`; only ask again when the set of questions changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, poolKey]);

  if (!data || loaf.status !== 'built') return null;
  const back = (
    <button type="button" className="text-button" onClick={() => navigate('/')}>
      {copy.backHome}
    </button>
  );

  if (pool.length === 0) {
    return (
      <div className="daily-quiz">
        {back}
        <h1 className="screen-title">{copy.title}</h1>
        <p className="notice">{copy.unavailable}</p>
      </div>
    );
  }
  if (!entry || index === null) return null;

  const total = entry.questions.length;

  if (index >= total) {
    const right = entry.questions.filter((q) => q.correct === true).length;
    return (
      <div className="daily-quiz">
        {back}
        <h1 className="screen-title">{copy.resultTitle}</h1>
        <DraftNote draft={getPoints().draft} />
        <p>{fillTemplate(copy.resultScore, { right: String(right), total: String(total) })}</p>
        {isFinished(entry) && <p>{fillTemplate(copy.resultFinished, { points: String(POINT_VALUES.quiz) })}</p>}
        {isPerfect(entry) && <p>{fillTemplate(copy.resultBonus, { points: String(POINT_VALUES['quiz-bonus']) })}</p>}
        <p className="daily-quiz__note">{wasDone ? copy.alreadyDone : copy.resultNext}</p>
        <LoafButton onClick={() => navigate('/')}>{copy.backHome}</LoafButton>
      </div>
    );
  }

  const asked = entry.questions[index];
  const item = pool.find((q) => q.loafId === asked.loafId && q.id === asked.questionId);
  // A question that left the content since it was drawn can't be shown. It never blocks the rest of the quiz.
  if (!item) return null;
  const question = item.question;
  const ref = `${item.loafId}/${item.id}`;
  const choices = orders[ref];
  if (!choices) return null;

  const answered = asked.choiceId !== null;
  const shownPick = answered ? asked.choiceId : picked;
  const quizCopy = loaf.flow.quiz;
  const correctLabel = question.choices.find((c) => c.id === question.answer)?.label ?? '';
  const reveal: QuestionReveal | null = answered
    ? {
        correct: asked.correct === true,
        heading: asked.correct ? copy.right : copy.wrong,
        answerLine: fillTemplate(quizCopy.correctAnswer, { answer: correctLabel }),
        explain: question.explain,
        rewatch: null,
        statusText: { correct: quizCopy.correct, incorrect: quizCopy.notQuite },
      }
    : null;

  async function check() {
    if (picked === null) return;
    const result = await answerDailyQuestion(
      adapter,
      { loafId: item!.loafId, questionId: item!.id, answer: question.answer },
      picked,
    );
    if (result) setEntry(result.entry);
    await refresh();
  }

  function next() {
    setPicked(null);
    setIndex(index! + 1);
  }

  return (
    <div className="daily-quiz">
      {back}
      <ProgressBar
        percent={(index / total) * 100}
        label={copy.title}
        valueText={fillTemplate(copy.progress, { current: String(index + 1), total: String(total) })}
      />
      <p className="daily-quiz__note">{fillTemplate(copy.progress, { current: String(index + 1), total: String(total) })}</p>
      <QuizQuestion
        key={ref}
        question={question}
        choices={choices}
        picked={shownPick}
        onPick={(id) => {
          if (!answered) setPicked(id);
        }}
        reveal={reveal}
      />
      {answered ? (
        <LoafButton onClick={next}>{index + 1 >= total ? copy.finish : copy.next}</LoafButton>
      ) : (
        <SliceButton onClick={() => void check()} disabled={picked === null}>
          {copy.check}
        </SliceButton>
      )}
    </div>
  );
}
