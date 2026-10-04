import { useNavigate } from 'react-router';
import { DraftNote } from '../../components/DraftNote';
import { LessonRow } from '../../components/LessonRow';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { useLessonFlow } from '../useLessonFlow';

/** "Your lessons": the loaf's lessons in order, with the test-out offer above and the quiz below. */
export function Lessons() {
  const { flow, lessons, plan, watched, unlocked, draft } = useLessonFlow();
  const navigate = useNavigate();
  const t = flow.lessons;

  const title = plan.reviewing ? t.reviewTitle : plan.allOptional ? t.allOptionalTitle : t.title;
  const intro = plan.reviewing ? t.reviewIntro : plan.allOptional ? t.allOptionalBody : t.intro;
  // Every lesson optional and saving setup open: lead with the way forward. Otherwise the quiz is the next step.
  const leadWithSaving = plan.allOptional && unlocked;

  const list = (
    <ul className="lesson-list">
      {lessons.map((lesson) => {
        const row = plan.rows.find((r) => r.id === lesson.id);
        const state = row?.state ?? 'recommended';
        const tag =
          state === 'recommended'
            ? plan.reviewing
              ? t.recommended
              : null
            : row?.reason === 'account'
              ? t.known
              : row?.reason === 'answered-right'
                ? t.answeredRight
                : null;
        return (
          <LessonRow
            key={lesson.id}
            title={lesson.title}
            durationSeconds={lesson.durationSeconds}
            href={`/lessons/${lesson.id}`}
            watched={watched.has(lesson.id)}
            watchedLabel={t.watched}
            tag={tag}
            collapsed={state !== 'recommended'}
            watchAnywayLabel={t.watchAnyway}
          />
        );
      })}
    </ul>
  );

  return (
    <div className="lessons">
      <h1 className="screen-title">{title}</h1>
      <DraftNote draft={draft} />
      <p>{intro}</p>

      {leadWithSaving && <LoafButton onClick={() => navigate('/saving-setup')}>{t.continueSaving}</LoafButton>}
      {!plan.allOptional && !plan.reviewing && (
        <SliceButton onClick={() => navigate('/quiz?mode=test-out')}>{t.testOutButton}</SliceButton>
      )}

      {list}

      {!leadWithSaving && (
        <div className="lessons__actions">
          <LoafButton onClick={() => navigate('/quiz')}>{t.quizButton}</LoafButton>
        </div>
      )}
    </div>
  );
}
