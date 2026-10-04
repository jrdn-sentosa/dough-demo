/**
 * Turns what a student typed ("25", "$1,200", "12.50") into integer cents.
 * Returns null for anything that isn't a plain dollar amount, including more than
 * two decimal places, so a half-cent never reaches the money layer.
 */
export function parseDollarsToCents(text: string): number | null {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Whole dollars as text for prefilling an input, e.g. 25000 becomes "250". */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
