import Markdown from 'react-markdown';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { VideoPlayer } from '../../components/VideoPlayer';
import { markLessonWatched } from '../../data/progress';
import { nextLessonId } from '../../domain/lessons';
import { useLessonFlow } from '../useLessonFlow';

/** One lesson: video (or the "Video coming soon" poster), the summary below it, and the way on. */
export function Lesson() {
  const { lessonId } = useParams();
  const [search] = useSearchParams();
  const { adapter, refresh } = useData();
  const navigate = useNavigate();
  const { loafId, flow, lessons, plan, watched, unlocked } = useLessonFlow();
  const t = flow.lesson;

  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) return <Navigate to="/lessons" replace />;

  const at = Number(search.get('t'));
  const startAt = Number.isFinite(at) && at > 0 ? at : 0;
  const isWatched = watched.has(lesson.id);

  async function watch(how: 'video' | 'manual') {
    await markLessonWatched(adapter, loafId, lesson!.id, how);
    await refresh();
  }

  const next = nextLessonId(plan.rows, lesson.id);
  const [nextLabel, nextTo] = next
    ? [t.next, `/lessons/${next}`]
    : plan.allOptional && unlocked
      ? [flow.lessons.continueSaving, '/saving-setup']
      : [t.toQuiz, '/quiz'];

  return (
    <div className="lesson">
      <button type="button" className="text-button lesson__back" onClick={() => navigate('/lessons')}>
        {t.back}
      </button>
      <h1 className="screen-title">{lesson.title}</h1>
      <DraftNote draft={lesson.draft} />
      {startAt > 0 && <p className="notice">{t.fromQuiz}</p>}

      <VideoPlayer
        title={lesson.title}
        videoUrl={lesson.videoUrl}
        captionsUrl={lesson.captionsUrl}
        startAt={startAt}
        onWatched={() => void watch('video')}
        posterTitle={t.videoSoon}
        posterNote={t.videoSoonNote}
      />

      {isWatched ? (
        <p className="lesson__watched" role="status">
          ✓ {t.watched}
        </p>
      ) : (
        <button type="button" className="text-button" onClick={() => void watch('manual')}>
          {t.markWatched}
        </button>
      )}

      <div className="lesson__summary">
        <Markdown>{lesson.summary}</Markdown>
      </div>

      <div className="lessons__actions">
        <LoafButton onClick={() => navigate(nextTo)}>{nextLabel}</LoafButton>
      </div>
    </div>
  );
}
