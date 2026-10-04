import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { getPoints } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { historyNewestFirst, pointsTotal } from '../../domain/points';
import { dailyQuizWaiting } from '../Home/dailyQuiz';
import { earnedOn, reasonLabel } from './labels';

const PAGE = 30;

/** "Your Dough points": the total and what earned each point and when, newest first. */
export function Points() {
  const copy = getPoints();
  const t = copy.history;
  const { data } = useData();
  const navigate = useNavigate();
  const [shown, setShown] = useState(PAGE);

  if (!data) return null;
  const total = pointsTotal(data.points);
  const history = historyNewestFirst(data.points);

  return (
    <div className="points">
      <button type="button" className="text-button" onClick={() => navigate('/')}>
        {t.back}
      </button>
      <h1 className="screen-title">{t.title}</h1>
      <DraftNote draft={copy.draft} />
      {dailyQuizWaiting(data) && <LoafButton onClick={() => navigate('/daily-quiz')}>{copy.daily.takeQuiz}</LoafButton>}
      <p className="points__total">{total === 1 ? t.totalOne : fillTemplate(t.total, { points: String(total) })}</p>
      <p>{t.intro}</p>

      {history.length === 0 ? (
        <p className="notice">{t.empty}</p>
      ) : (
        <ul className="points__list">
          {history.slice(0, shown).map((event) => (
            <li key={event.key} className="points__row">
              <span className="points__what">{reasonLabel(event, t)}</span>
              <span className="points__when">{earnedOn(event)}</span>
              <span className="points__earned">{fillTemplate(t.earned, { points: String(event.points) })}</span>
            </li>
          ))}
        </ul>
      )}
      {history.length > shown && <SliceButton onClick={() => setShown(shown + PAGE)}>{t.showMore}</SliceButton>}

      <p className="points__note">{t.demoNote}</p>
    </div>
  );
}
