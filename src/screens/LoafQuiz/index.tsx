import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { ProgressBar } from '../../components/ProgressBar';
import { QuizQuestion } from '../../components/QuizQuestion';
import type { QuestionReveal } from '../../components/QuizQuestion';
import { getQuiz } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import type { Lesson, QuizQuestionContent } from '../../content/types';
import { syncPoints } from '../../data/points';
import { recordQuizAttempt } from '../../data/progress';
import type { QuizMode } from '../../data/types';
import { isMastered, isMasteryScore } from '../../domain/mastery';
import { evaluateTestOut, gradeQuiz } from '../../domain/quiz';
import { shuffleQuiz } from '../../domain/shuffle';
import type { QuizGrade } from '../../domain/quiz';
import { SliceButton } from '../../components/SliceButton';
import { useLessonFlow } from '../useLessonFlow';
import { useVideoAvailable } from '../videoAvailable';

/** The text of the correct choice, found by its id. */
function correctLabel(question: QuizQuestionContent): string {
  return question.choices.find((c) => c.id === question.answer)?.label ?? '';
}

/** "Rewatch this part" with a video, "Read the summary" without one. Both open the lesson. */
function RewatchLink({ lesson, timestamp, rewatch, readSummary }: { lesson: Lesson; timestamp: number; rewatch: string; readSummary: string }) {
  const hasVideo = useVideoAvailable(lesson.videoUrl);
  return (
    <Link to={`/lessons/${lesson.id}?t=${timestamp}`}>{hasVideo ? rewatch : readSummary}</Link>
  );
}

/**
 * The loaf quiz, one question per screen.
 * - Normal mode: pick a choice, tap "Check answer", then see feedback. Choices lock only after Check.
 * - Test-out mode (`?mode=test-out`): no feedback at all. The end screen shows the score and the lessons to review.
 * There is no pass gate for the emergency fund, and retrying is always allowed.
 */
export function LoafQuiz() {
  const [search] = useSearchParams();
  const mode: QuizMode = search.get('mode') === 'test-out' ? 'test-out' : 'lesson';
  const testOut = mode === 'test-out';

  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();
  const { loafId, flow, lessons, draft } = useLessonFlow();
  const t = flow.quiz;
  const quiz = useMemo(() => getQuiz(loafId), [loafId]);
  const questions = quiz.questions;

  // A fresh order for the questions and their choices on every attempt. Answers are kept by choice id.
  const [shown, setShown] = useState(() => shuffleQuiz(questions));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [masteredBefore, setMasteredBefore] = useState(false);

  function restart() {
    setShown(shuffleQuiz(questions));
    setIndex(0);
    setAnswers({});
    setChecked(false);
    setGrade(null);
  }

  if (grade) {
    return testOut ? (
      <TestOutEnd grade={grade} lessons={lessons} flow={flow} draft={draft} onContinue={() => navigate('/saving-setup')} onLessons={() => navigate('/lessons')} />
    ) : (
      <LessonEnd grade={grade} masteredBefore={masteredBefore} questions={questions} lessons={lessons} flow={flow} draft={draft} onRetry={restart} onContinue={() => navigate('/saving-setup')} />
    );
  }

  const { question, choices } = shown[index];
  const picked = answers[question.id] ?? null;
  const last = index === questions.length - 1;

  async function finish() {
    // Read before saving: did an earlier attempt already master the lessons?
    setMasteredBefore(isMastered(data?.quizAttempts ?? [], loafId));
    const result = gradeQuiz(questions, answers);
    await recordQuizAttempt(adapter, loafId, mode, result, answers);
    await syncPoints(adapter); // mastering the lessons earns points
    await refresh();
    setGrade(result);
  }

  async function advance() {
    if (last) await finish();
    else {
      setIndex(index + 1);
      setChecked(false);
    }
  }

  const reveal: QuestionReveal | null =
    checked && picked !== null
      ? {
          correct: picked === question.answer,
          heading: picked === question.answer ? t.correct : t.notQuite,
          answerLine: fillTemplate(t.correctAnswer, { answer: correctLabel(question) }),
          explain: question.explain,
          rewatch: <QuestionLink question={question} lessons={lessons} flow={flow} />,
          statusText: { correct: t.correct, incorrect: t.notQuite },
        }
      : null;

  return (
    <div className="quiz">
      <p className="placement__eyebrow">{testOut ? t.testOutTitle : fillTemplate(t.questionOf, { n: String(index + 1), total: String(questions.length) })}</p>
      <ProgressBar
        percent={((index + 1) / questions.length) * 100}
        label="Quiz progress"
        valueText={fillTemplate(t.questionOf, { n: String(index + 1), total: String(questions.length) })}
      />
      <DraftNote draft={draft} />
      {testOut && index === 0 && <p>{t.testOutIntro}</p>}

      <QuizQuestion
        key={question.id}
        question={question}
        choices={choices}
        picked={picked}
        onPick={(choice) => {
          if (!checked) setAnswers({ ...answers, [question.id]: choice });
        }}
        reveal={reveal}
      />

      <div className="quiz__actions">
        {testOut || checked ? (
          <LoafButton onClick={() => void advance()} disabled={picked === null}>
            {last ? t.seeScore : t.next}
          </LoafButton>
        ) : (
          <LoafButton onClick={() => setChecked(true)} disabled={picked === null}>
            {t.check}
          </LoafButton>
        )}
      </div>
    </div>
  );
}

function QuestionLink({ question, lessons, flow }: { question: QuizQuestionContent; lessons: Lesson[]; flow: ReturnType<typeof useLessonFlow>['flow'] }) {
  const lesson = lessons.find((l) => l.id === question.lesson);
  if (!lesson) return null;
  return <RewatchLink lesson={lesson} timestamp={question.timestamp} rewatch={flow.quiz.rewatch} readSummary={flow.quiz.readSummary} />;
}

interface EndProps {
  grade: QuizGrade;
  lessons: Lesson[];
  flow: ReturnType<typeof useLessonFlow>['flow'];
  draft: boolean;
}

/** Normal end screen: the score, why each missed answer is what it is, retry, and on to saving setup. */
function LessonEnd({ grade, masteredBefore, questions, lessons, flow, draft, onRetry, onContinue }: EndProps & { masteredBefore: boolean; questions: QuizQuestionContent[]; onRetry: () => void; onContinue: () => void }) {
  const t = flow.quiz;
  const mastered = isMasteryScore(grade.score, grade.total);
  return (
    <div className="quiz">
      <h1 className="screen-title">{t.scoreTitle}</h1>
      <DraftNote draft={draft} />
      <p className="quiz__score" role="status">{fillTemplate(t.score, { score: String(grade.score), total: String(grade.total) })}</p>
      <p>{t.scoreNote}</p>
      <p className={mastered ? 'quiz__mastered' : undefined}>
        {mastered ? t.mastered : masteredBefore ? t.masteredBefore : t.masteryHint}
      </p>

      {grade.missed.length > 0 && (
        <section className="stack-tight" aria-label={t.reviewMissed}>
          <h2>{t.reviewMissed}</h2>
          {grade.missed.map((r) => {
            const q = questions.find((x) => x.id === r.id);
            if (!q) return null;
            return (
              <div key={r.id} className="card">
                <p><strong>{q.question}</strong></p>
                <p>{fillTemplate(t.correctAnswer, { answer: correctLabel(q) })}</p>
                <p>{q.explain}</p>
                <p><QuestionLink question={q} lessons={lessons} flow={flow} /></p>
              </div>
            );
          })}
        </section>
      )}

      <div className="quiz__actions">
        <LoafButton onClick={onContinue}>{t.continueSaving}</LoafButton>
        <SliceButton onClick={onRetry}>{t.tryAgain}</SliceButton>
      </div>
    </div>
  );
}

/**
 * Test-out end screen. It shows the score and which lessons to review, and nothing
 * that gives away answers: no correct choices, no explanations, no per-question links.
 */
function TestOutEnd({ grade, lessons, flow, draft, onContinue, onLessons }: EndProps & { onContinue: () => void; onLessons: () => void }) {
  const t = flow.quiz;
  const result = evaluateTestOut(grade);
  const review = result.recommendedLessons
    .map((id) => lessons.find((l) => l.id === id))
    .filter((l): l is Lesson => l !== undefined);
  return (
    <div className="quiz">
      <h1 className="screen-title">{result.passed ? t.testOutPassTitle : t.scoreTitle}</h1>
      <DraftNote draft={draft} />
      <p className="quiz__score" role="status">{fillTemplate(t.score, { score: String(grade.score), total: String(grade.total) })}</p>
      <p>{result.passed ? t.testOutPassBody : t.testOutFailBody}</p>

      {!result.passed && (
        <section className="stack-tight" aria-label={t.testOutLessons}>
          <h2>{t.testOutLessons}</h2>
          <ul className="plain-list">
            {review.map((l) => (
              <li key={l.id}>{l.title}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="quiz__actions">
        {result.passed ? (
          <LoafButton onClick={onContinue}>{t.continueSaving}</LoafButton>
        ) : (
          <LoafButton onClick={onLessons}>{t.testOutToLessons}</LoafButton>
        )}
      </div>
    </div>
  );
}
