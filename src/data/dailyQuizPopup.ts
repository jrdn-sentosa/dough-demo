import { localDayKey } from '../domain/days';
import { nowFromData } from '../money/clock';
import type { DataAdapter } from './adapter';
import { serialized } from './points';

/** "Hide for today": the popup stays closed until the next local day on the demo clock. */
export function hidePopupForToday(adapter: DataAdapter): Promise<void> {
  return serialized(async () => {
    const data = await adapter.load();
    data.dailyQuizPopup = { ...data.dailyQuizPopup, hiddenDay: localDayKey(nowFromData(data)) };
    await adapter.save(data);
  });
}

/** "Don't show this again" turns the popup off for good, and the Settings switch turns it back on. */
export function setPopupOff(adapter: DataAdapter, off: boolean): Promise<void> {
  return serialized(async () => {
    const data = await adapter.load();
    data.dailyQuizPopup = { off, hiddenDay: off ? data.dailyQuizPopup.hiddenDay : null };
    await adapter.save(data);
  });
}
