import { fillTemplate } from '../../content/template';
import type { ShelfContent } from '../../content/types';
import type { Bake } from '../../data/types';
import { monthsForTarget } from '../../domain/targets';
import { formatCents } from '../../money/format';

/** "Oct 2026", in the student's local time. */
export function bakeMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * The size part of a shelf label: "1 month" or "3 months", worked out from the target and the student's
 * essentials (never stored). Without essentials, or for a custom amount that isn't a whole number of
 * months, it falls back to the dollar amount.
 */
export function bakeSize(bake: Bake, essentialsCents: number | null, copy: ShelfContent): string {
  if (essentialsCents !== null) {
    const months = monthsForTarget(bake.targetCents, essentialsCents);
    if (Number.isInteger(months) && months >= 1) {
      return months === 1 ? copy.monthOne : fillTemplate(copy.monthMany, { n: String(months) });
    }
  }
  return formatCents(bake.targetCents);
}

/** The line under a loaf on the shelf: "3 months · Jan 2027", or "Already built" with no date. */
export function bakeLabel(bake: Bake, essentialsCents: number | null, copy: ShelfContent): { size: string; sub: string } {
  const size = bakeSize(bake, essentialsCents, copy);
  if (bake.at === null) return { size, sub: `${size} · ${copy.alreadyBuilt}` };
  return { size, sub: fillTemplate(copy.bakedSub, { size, date: bakeMonth(bake.at) }) };
}
