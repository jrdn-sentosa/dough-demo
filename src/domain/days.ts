/**
 * Local calendar days. A "day" is the student's own midnight-to-midnight, written `YYYY-MM-DD`.
 * Nothing here reads the current time: callers pass in a date (from the demo clock).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day an instant falls on. */
export function localDayKey(when: Date | string): string {
  const d = typeof when === 'string' ? new Date(when) : when;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The day `n` calendar days after `day` (negative goes back). Works across daylight saving changes. */
export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}

/** The last moment of a local day, as an ISO string. Used to date points earned for a whole day. */
export function endOfDayIso(day: string): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + 1);
  return new Date(d.getTime() - 1).toISOString();
}

/** A local day as a date at local noon, for formatting without edge cases. */
export function dayToDate(day: string): Date {
  const d = parseDay(day);
  d.setHours(12);
  return d;
}
