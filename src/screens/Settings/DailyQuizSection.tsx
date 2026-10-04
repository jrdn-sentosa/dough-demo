import { useData } from '../../app/DataProvider';
import { getPoints } from '../../content/loader';
import { setPopupOff } from '../../data/dailyQuizPopup';

/** Settings, "Daily quiz popup": a switch for the popup, which "Don't show this again" on the popup turns off. */
export function DailyQuizSection() {
  const { adapter, data, refresh } = useData();
  const copy = getPoints().daily;
  if (!data) return null;
  const on = !data.dailyQuizPopup.off;

  async function change(next: boolean) {
    await setPopupOff(adapter, !next);
    await refresh();
  }

  return (
    <section className="settings__section" aria-labelledby="settings-daily-quiz">
      <h2 id="settings-daily-quiz" className="settings__heading">
        {copy.settingsTitle}
      </h2>
      <p className="settings__text">{copy.settingsIntro}</p>
      <label className="settings__switch">
        <input type="checkbox" role="switch" checked={on} onChange={(e) => void change(e.target.checked)} />
        {copy.settingsLabel}
      </label>
    </section>
  );
}
