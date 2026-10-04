import type { DataAdapter } from '../data/adapter';
import type { AppData, Bake, LoafRecord, Transaction, TransactionSource, TransactionType } from '../data/types';
import { DEFAULT_BREAD } from '../domain/breads';
import type { BreadId } from '../domain/breads';
import type { LoafId, Stage } from '../domain/types';
import { growthPercent, progressPercent, stageForPercent } from '../domain/stages';
import { MAX_ENTRY_CENTS, MAX_STARTING_CENTS, checkAmount, type AmountErrorCode } from './amounts';
import { nowIso } from './clock';
import { formatCents } from './format';
import { REBUILD_MESSAGE, withdrawalTooBigMessage } from './messages';

export type MoneyErrorCode =
  | AmountErrorCode
  | 'no-loaf'
  | 'loaf-exists'
  | 'insufficient'
  | 'starting-too-late'
  | 'needs-confirmation'
  | 'grow-not-ready'
  | 'grow-not-bigger'
  | 'bread-locked'
  | 'no-habit';

export interface MoneyFailure {
  ok: false;
  code: MoneyErrorCode;
  message: string;
  /** Set when a withdrawal is more than the loaf holds. */
  availableCents?: number;
  /** Set when the amount is allowed but the UI should ask "Is that right?" first. */
  needsConfirmation?: true;
}

export interface LoafStatus {
  loafId: LoafId;
  /** The bread look the loaf rises in now. */
  bread: BreadId;
  targetCents: number;
  balanceCents: number;
  /**
   * 0-100, clamped. Extra money above the target doesn't push this past 100.
   * While `growing` it counts the new part only, from `growFromCents` to the target.
   * For the whole fund, show `balanceCents` of `targetCents` ("$400 of $1,200").
   */
  percent: number;
  /** Stage for `percent`, so a growing fund starts again as a dough ball. */
  stage: Stage;
  /** The fund has been baked at some point. */
  baked: boolean;
  /** Baked before, but a withdrawal left the balance under the target. Not set while growing. */
  rebuilding: boolean;
  /** A baked fund is being grown toward a bigger target. */
  growing: boolean;
  /** The old target, where the new growth starts. Null unless `growing`. */
  growFromCents: number | null;
  /** Every bake, oldest first, for the shelf. */
  bakes: readonly Bake[];
  /** Date of the first bake. Null if there is none, or the first was "Already built". */
  firstBakedAt: string | null;
  /** The first bake was savings the student already had. */
  bakedAtStart: boolean;
}

export interface DepositResult {
  ok: true;
  transaction: Transaction;
  status: LoafStatus;
  /** This deposit took progress from under 100% to 100% or more. */
  baked: boolean;
  /** `baked` came from a rebuild, so the UI should use "You rebuilt your fund" copy. */
  rebuilt: boolean;
  /** `baked` reached a bigger target than any earlier bake, so the shelf got another entry. */
  grown: boolean;
}

export interface WithdrawalResult {
  ok: true;
  transaction: Transaction;
  status: LoafStatus;
  message: string;
}

export interface StartingResult {
  ok: true;
  transaction: Transaction;
  status: LoafStatus;
}

const fail = (code: MoneyErrorCode, message: string, extra: Partial<MoneyFailure> = {}): MoneyFailure => ({
  ok: false,
  code,
  message,
  ...extra,
});

const NO_LOAF = 'That loaf has not been started yet.';
const BREAD_LOCKED = 'That bread is not unlocked yet.';

/** A bread can be picked when it is the default or a streak has unlocked it. */
function breadAvailable(data: AppData, bread: BreadId): boolean {
  return bread === DEFAULT_BREAD || data.streaks.unlocked.some((u) => u.bread === bread);
}

// ---- Reads (pure, from raw rows) ----

export function balanceCents(data: AppData, loafId: LoafId): number {
  let total = 0;
  for (const t of data.transactions) {
    if (t.loafId !== loafId) continue;
    total += t.type === 'withdrawal' ? -t.amountCents : t.amountCents;
  }
  return total;
}

/** Progress toward the current goal: the new part only while growing, otherwise the whole fund. */
function percentFor(loaf: LoafRecord, balance: number): number {
  return loaf.growFromCents === null
    ? progressPercent(balance, loaf.targetCents)
    : growthPercent(balance, loaf.growFromCents, loaf.targetCents);
}

export function statusFor(data: AppData, loaf: LoafRecord): LoafStatus {
  const balance = balanceCents(data, loaf.loafId);
  const percent = percentFor(loaf, balance);
  const baked = loaf.bakes.length > 0;
  const growing = loaf.growFromCents !== null;
  return {
    loafId: loaf.loafId,
    bread: loaf.bread,
    targetCents: loaf.targetCents,
    balanceCents: balance,
    percent,
    stage: stageForPercent(percent),
    baked,
    rebuilding: baked && !growing && percent < 100,
    growing,
    growFromCents: loaf.growFromCents,
    bakes: loaf.bakes,
    firstBakedAt: loaf.bakes[0]?.at ?? null,
    bakedAtStart: baked && loaf.bakes[0].at === null,
  };
}

/**
 * The loaf just reached its target. Adds a shelf entry for the first bake, or
 * for a target higher than every earlier bake (a grown fund). Finishing a
 * rebuild at a target already on the shelf adds nothing. Ends any growing.
 * `at` is null for "Already built".
 */
function recordBake(loaf: LoafRecord, at: string | null): { grown: boolean } {
  const last = loaf.bakes[loaf.bakes.length - 1];
  loaf.growFromCents = null;
  if (last && loaf.targetCents <= last.targetCents) return { grown: false };
  loaf.bakes.push({ targetCents: loaf.targetCents, at, bread: loaf.bread });
  return { grown: last !== undefined };
}

export async function getLoafStatus(adapter: DataAdapter, loafId: LoafId): Promise<LoafStatus | null> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  return loaf ? statusFor(data, loaf) : null;
}

export async function listTransactions(adapter: DataAdapter, loafId: LoafId): Promise<Transaction[]> {
  const data = await adapter.load();
  return data.transactions.filter((t) => t.loafId === loafId);
}

// ---- Writes ----

function newTransaction(
  data: AppData,
  loafId: LoafId,
  type: TransactionType,
  amountCents: number,
  at: string,
  source: TransactionSource,
): Transaction {
  const tx: Transaction = { id: `tx-${data.transactions.length + 1}`, loafId, type, source, amountCents, at };
  data.transactions.push(tx);
  return tx;
}

export async function startLoaf(
  adapter: DataAdapter,
  loafId: LoafId,
  targetCents: number,
  options: { bread?: BreadId } = {},
): Promise<{ ok: true; loaf: LoafRecord } | MoneyFailure> {
  const bad = checkAmount(targetCents, Number.MAX_SAFE_INTEGER);
  if (bad) return bad;
  const data = await adapter.load();
  if (data.loaves.some((l) => l.loafId === loafId)) {
    return fail('loaf-exists', 'This loaf has already been started.');
  }
  const bread = options.bread ?? DEFAULT_BREAD;
  if (!breadAvailable(data, bread)) return fail('bread-locked', BREAD_LOCKED);
  const loaf: LoafRecord = {
    loafId,
    bread,
    targetCents,
    startedAt: await nowIso(adapter),
    bakes: [],
    growFromCents: null,
  };
  data.loaves.push(loaf);
  await adapter.save(data);
  return { ok: true, loaf };
}

export interface SetTargetResult {
  ok: true;
  status: LoafStatus;
  /** The new target is at or below the balance, so the loaf just baked (same rule as a deposit). */
  baked: boolean;
  /** `baked` came back after an earlier bake, so the UI should use rebuild copy. */
  rebuilt: boolean;
  /** `baked` reached a bigger target than any earlier bake. */
  grown: boolean;
}

/**
 * Changes the target.
 * - Raising it above the balance of a loaf that was only "Already built" undoes
 *   that bake (the student is still choosing a goal).
 * - Lowering it to or below the balance bakes the loaf, like a deposit crossing
 *   the target. If the balance is only savings the student already had, it is
 *   "Already built" (no completion date); otherwise the bake gets a date.
 * - `grow: true` is the "Grow your cushion" choice on a baked fund: the old
 *   target becomes `growFromCents` and progress counts the new part only. It
 *   fails unless the fund is baked and the new target is bigger. Raising the
 *   target without `grow` just edits the goal.
 * - `bread` (with `grow`) is the look the grown loaf rises and bakes in. It must be the
 *   default or an unlocked bread. Earlier bakes keep the bread they were baked as.
 */
export async function setTarget(
  adapter: DataAdapter,
  loafId: LoafId,
  targetCents: number,
  options: { grow?: boolean; bread?: BreadId } = {},
): Promise<SetTargetResult | MoneyFailure> {
  const bad = checkAmount(targetCents, Number.MAX_SAFE_INTEGER);
  if (bad) return bad;
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return fail('no-loaf', NO_LOAF);

  const before = statusFor(data, loaf);
  const balance = before.balanceCents;
  let endedGrowing = false;

  if (options.grow) {
    if (!before.baked || (!before.growing && before.percent < 100)) {
      return fail('grow-not-ready', 'Finish baking this loaf before growing it.');
    }
    if (targetCents <= loaf.targetCents) {
      return fail('grow-not-bigger', 'Pick a goal bigger than your current one.');
    }
    if (options.bread !== undefined) {
      if (!breadAvailable(data, options.bread)) return fail('bread-locked', BREAD_LOCKED);
      loaf.bread = options.bread;
    }
    loaf.growFromCents ??= loaf.targetCents;
  } else {
    if (loaf.growFromCents !== null && targetCents <= loaf.growFromCents) {
      loaf.growFromCents = null;
      endedGrowing = true;
    }
    const onlyAlreadyBuilt = loaf.bakes.length === 1 && loaf.bakes[0].at === null;
    if (onlyAlreadyBuilt && balance < targetCents) loaf.bakes = [];
  }
  loaf.targetCents = targetCents;

  // A fund that was already at 100% can only bake again by growing, so skip the "was under 100%" check then.
  const crossed = (options.grow || before.percent < 100) && percentFor(loaf, balance) >= 100;
  const baked = !endedGrowing && crossed;
  let grown = false;
  if (baked) {
    const onlyStarting = data.transactions.every((t) => t.loafId !== loafId || t.type === 'starting');
    grown = recordBake(loaf, onlyStarting ? null : await nowIso(adapter)).grown;
  }
  await adapter.save(data);
  return { ok: true, status: statusFor(data, loaf), baked, rebuilt: baked && before.baked && !grown, grown };
}

/**
 * Settings, "Change your goal". Uses `setTarget`, so its rules apply: at or
 * below the balance bakes the loaf. A higher target on a baked fund that is at
 * 100% (or already growing) starts growing. While the fund is rebuilding, or
 * has never baked, a higher target just edits the goal.
 */
export async function changeGoal(
  adapter: DataAdapter,
  loafId: LoafId,
  targetCents: number,
): Promise<SetTargetResult | MoneyFailure> {
  const status = await getLoafStatus(adapter, loafId);
  if (!status) return fail('no-loaf', NO_LOAF);
  const grow = status.baked && !status.rebuilding && targetCents > status.targetCents;
  return setTarget(adapter, loafId, targetCents, { grow });
}

/**
 * Savings the student already had ("Savings you already had"). Must be the
 * loaf's first row. Up to $10,000 goes straight in; above that, up to $100,000,
 * the caller gets `needsConfirmation` and calls again with `confirmed: true`.
 */
export async function addStarting(
  adapter: DataAdapter,
  loafId: LoafId,
  amountCents: number,
  options: { confirmed?: boolean; source?: TransactionSource } = {},
): Promise<StartingResult | MoneyFailure> {
  const bad = checkAmount(amountCents, MAX_STARTING_CENTS);
  if (bad) return bad;
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return fail('no-loaf', NO_LOAF);
  if (data.transactions.some((t) => t.loafId === loafId)) {
    return fail('starting-too-late', 'Savings you already had can only be counted when a loaf begins.');
  }
  if (amountCents > MAX_ENTRY_CENTS && !options.confirmed) {
    return fail('needs-confirmation', `Is ${formatCents(amountCents)} right?`, { needsConfirmation: true });
  }
  const tx = newTransaction(data, loafId, 'starting', amountCents, await nowIso(adapter), options.source ?? 'manual');
  if (amountCents >= loaf.targetCents) recordBake(loaf, null);
  await adapter.save(data);
  return { ok: true, transaction: tx, status: statusFor(data, loaf) };
}

export async function deposit(
  adapter: DataAdapter,
  loafId: LoafId,
  amountCents: number,
  options: { source?: TransactionSource } = {},
): Promise<DepositResult | MoneyFailure> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return fail('no-loaf', NO_LOAF);
  const bad = checkAmount(amountCents, MAX_ENTRY_CENTS);
  if (bad) return bad;

  const before = statusFor(data, loaf);
  const at = await nowIso(adapter);
  const tx = newTransaction(data, loafId, 'deposit', amountCents, at, options.source ?? 'manual');
  const baked = before.percent < 100 && percentFor(loaf, before.balanceCents + amountCents) >= 100;
  const { grown } = baked ? recordBake(loaf, at) : { grown: false };
  await adapter.save(data);
  return {
    ok: true,
    transaction: tx,
    status: statusFor(data, loaf),
    baked,
    rebuilt: baked && before.baked && !grown,
    grown,
  };
}

export async function withdraw(
  adapter: DataAdapter,
  loafId: LoafId,
  amountCents: number,
  options: { source?: TransactionSource } = {},
): Promise<WithdrawalResult | MoneyFailure> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return fail('no-loaf', NO_LOAF);
  const bad = checkAmount(amountCents, MAX_ENTRY_CENTS);
  if (bad) return bad;

  const available = balanceCents(data, loafId);
  if (amountCents > available) {
    return fail('insufficient', withdrawalTooBigMessage(formatCents(available)), { availableCents: available });
  }
  const tx = newTransaction(data, loafId, 'withdrawal', amountCents, await nowIso(adapter), options.source ?? 'manual');
  loaf.growFromCents = null; // progress goes back to balance / target
  await adapter.save(data);
  return { ok: true, transaction: tx, status: statusFor(data, loaf), message: REBUILD_MESSAGE };
}
