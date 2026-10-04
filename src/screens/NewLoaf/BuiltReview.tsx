import Markdown from 'react-markdown';
import { useNavigate } from 'react-router';
import { DraftNote } from '../../components/DraftNote';
import { SliceButton } from '../../components/SliceButton';
import { getLessons, getPlacement } from '../../content/loader';

/** Optional review for students whose emergency fund starts baked: what the three lessons cover. */
export function BuiltReview() {
  const navigate = useNavigate();
  const content = getPlacement();
  const lessons = getLessons('emergency-fund');
  return (
    <div className="new-loaf">
      <h1 className="screen-title">{content.newLoaf.reviewTitle}</h1>
      <DraftNote draft={content.draft || lessons.some((l) => l.draft)} />
      {lessons.map((lesson) => (
        <section key={lesson.id} className="card">
          <h2>{lesson.title}</h2>
          <Markdown>{lesson.summary}</Markdown>
        </section>
      ))}
      <div className="new-loaf__actions">
        <SliceButton onClick={() => navigate('/new-loaf')}>{content.newLoaf.reviewBack}</SliceButton>
      </div>
    </div>
  );
}
