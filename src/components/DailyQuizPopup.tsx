import { useState } from 'react';
import { getPoints } from '../content/loader';
import { fillTemplate } from '../content/template';
import { DAILY_QUESTIONS } from '../domain/dailyQuiz';
import { POINT_VALUES } from '../domain/points';
import { LoafButton } from './LoafButton';
import { SliceButton } from './SliceButton';

interface DailyQuizPopupProps {
  /** "Start": the popup closes and the quiz opens. `hideToday` is the checkbox. */
  onStart: (hideToday: boolean) => void;
  /** "Not now", or Escape: closes until the next time the app opens. `hideToday` is the checkbox. */
  onClose: (hideToday: boolean) => void;
  /** "Don't show this again": closes and turns the popup off until Settings turns it back on. */
  onNever: () => void;
}

/** The daily quiz popup: the main way into the quiz. Calm wording, nothing about days that were skipped. */
export function DailyQuizPopup({ onStart, onClose, onNever }: DailyQuizPopupProps) {
  const copy = getPoints().daily;
  const [hideToday, setHideToday] = useState(false);

  const body = fillTemplate(copy.popupBody, {
    count: String(DAILY_QUESTIONS),
    points: String(POINT_VALUES.quiz),
    bonus: String(POINT_VALUES['quiz-bonus']),
  });

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-popup-title"
      aria-describedby="daily-popup-body"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose(hideToday);
      }}
    >
      <div className="sheet__card daily-popup">
        <h2 id="daily-popup-title">{copy.title}</h2>
        <p id="daily-popup-body">{body}</p>
        <LoafButton autoFocus onClick={() => onStart(hideToday)}>
          {copy.start}
        </LoafButton>
        <SliceButton onClick={() => onClose(hideToday)}>{copy.notNow}</SliceButton>
        <label className="daily-popup__hide">
          <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} />
          {copy.hideToday}
        </label>
        <button type="button" className="text-button" onClick={onNever}>
          {copy.dontShowAgain}
        </button>
      </div>
    </div>
  );
}
