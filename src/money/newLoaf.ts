import type { DataAdapter } from '../data/adapter';
import type { LoafId } from '../domain/types';
import { MAX_ENTRY_CENTS, MAX_STARTING_CENTS, checkAmount } from './amounts';
import { formatCents } from './format';
import { addStarting, getLoafStatus, startLoaf } from './ledger';
import type { LoafStatus, MoneyFailure } from './ledger';

/**
 * "Your new loaf": starts the loaf and, when the student counts savings they already
 * have, records them as its first row. Everything is checked before anything is
 * written, so a failed or unconfirmed attempt leaves no half-started loaf behind.
 * Over $10,000 of existing savings returns `needsConfirmation`: call again with
 * `confirmed: true` after asking "Is that right?".
 */
export async function createFirstLoaf(
  adapter: DataAdapter,
  loafId: LoafId,
  targetCents: number,
  startingCents: number | null,
  options: { confirmed?: boolean } = {},
): Promise<{ ok: true; status: LoafStatus } | MoneyFailure> {
  const badTarget = checkAmount(targetCents, Number.MAX_SAFE_INTEGER);
  if (badTarget) return badTarget;
  if (startingCents !== null) {
    const bad = checkAmount(startingCents, MAX_STARTING_CENTS);
    if (bad) return bad;
    if (startingCents > MAX_ENTRY_CENTS && !options.confirmed) {
      return {
        ok: false,
        code: 'needs-confirmation',
        message: `Is ${formatCents(startingCents)} right?`,
        needsConfirmation: true,
      };
    }
  }
  const started = await startLoaf(adapter, loafId, targetCents);
  if (!started.ok) return started;
  if (startingCents !== null) {
    const added = await addStarting(adapter, loafId, startingCents, { confirmed: true });
    if (!added.ok) return added;
  }
  const status = await getLoafStatus(adapter, loafId);
  // startLoaf just wrote this loaf, so it is always there.
  return { ok: true, status: status as LoafStatus };
}
