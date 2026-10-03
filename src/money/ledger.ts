import type { DataAdapter } from '../data/adapter';
import type { AppData, LoafRecord, Transaction, TransactionType } from '../data/types';
import type { LoafId, Stage } from '../domain/types';
import { progressPercent, stageForBalance } from '../domain/stages';
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
  | 'needs-confirmation';

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
  targetCents: number;
  balanceCents: number;
  /** 0-100, clamped. Extra money above the target doesn't push this past 100. */
  percent: number;
  stage: Stage;
  /** The fund has been baked at some point (first bake or baked at start). */
  baked: boolean;
  /** Baked before, but the balance is now under the target. */
  rebuilding: boolean;
  firstBakedAt: string | null;
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

// ---- Reads (pure, from raw rows) ----

export function balanceCents(data: AppData, loafId: LoafId): number {
  let total = 0;
  for (const t of data.transactions) {
    if (t.loafId !== loafId) continue;
    total += t.type === 'withdrawal' ? -t.amountCents : t.amountCents;
  }
  return total;
}

export function statusFor(data: AppData, loaf: LoafRecord): LoafStatus {
  const balance = balanceCents(data, loaf.loafId);
  const percent = progressPercent(balance, loaf.targetCents);
  const baked = loaf.firstBakedAt !== null || loaf.bakedAtStart;
  return {
    loafId: loaf.loafId,
    targetCents: loaf.targetCents,
    balanceCents: balance,
    percent,
    stage: stageForBalance(balance, loaf.targetCents),
    baked,
    rebuilding: baked && percent < 100,
    firstBakedAt: loaf.firstBakedAt,
    bakedAtStart: loaf.bakedAtStart,
  };
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
): Transaction {
  const tx: Transaction = { id: `tx-${data.transactions.length + 1}`, loafId, type, amountCents, at };
  data.transactions.push(tx);
  return tx;
}

export async function startLoaf(
  adapter: DataAdapter,
  loafId: LoafId,
  targetCents: number,
): Promise<{ ok: true; loaf: LoafRecord } | MoneyFailure> {
  const bad = checkAmount(targetCents, Number.MAX_SAFE_INTEGER);
  if (bad) return bad;
  const data = await adapter.load();
  if (data.loaves.some((l) => l.loafId === loafId)) {
    return fail('loaf-exists', 'This loaf has already been started.');
  }
  const loaf: LoafRecord = {
    loafId,
    targetCents,
    startedAt: await nowIso(adapter),
    firstBakedAt: null,
    bakedAtStart: false,
  };
  data.loaves.push(loaf);
  await adapter.save(data);
  return { ok: true, loaf };
}

/**
 * Changes the target. If existing savings had counted as baked and the new
 * target is bigger than the balance, the loaf is no longer baked at start.
 */
export async function setTarget(
  adapter: DataAdapter,
  loafId: LoafId,
  targetCents: number,
): Promise<{ ok: true; status: LoafStatus } | MoneyFailure> {
  const bad = checkAmount(targetCents, Number.MAX_SAFE_INTEGER);
  if (bad) return bad;
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return fail('no-loaf', NO_LOAF);
  loaf.targetCents = targetCents;
  if (loaf.bakedAtStart && balanceCents(data, loafId) < targetCents) loaf.bakedAtStart = false;
  await adapter.save(data);
  return { ok: true, status: statusFor(data, loaf) };
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
  options: { confirmed?: boolean } = {},
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
  const tx = newTransaction(data, loafId, 'starting', amountCents, await nowIso(adapter));
  if (amountCents >= loaf.targetCents) loaf.bakedAtStart = true;
  await adapter.save(data);
  return { ok: true, transaction: tx, status: statusFor(data, loaf) };
}

export async function deposit(
  adapter: DataAdapter,
  loafId: LoafId,
  amountCents: number,
): Promise<DepositResult | MoneyFailure> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return fail('no-loaf', NO_LOAF);
  const bad = checkAmount(amountCents, MAX_ENTRY_CENTS);
  if (bad) return bad;

  const before = statusFor(data, loaf);
  const at = await nowIso(adapter);
  const tx = newTransaction(data, loafId, 'deposit', amountCents, at);
  const afterPercent = progressPercent(before.balanceCents + amountCents, loaf.targetCents);
  const baked = before.percent < 100 && afterPercent >= 100;
  if (baked && !before.baked) loaf.firstBakedAt = at;
  await adapter.save(data);
  return { ok: true, transaction: tx, status: statusFor(data, loaf), baked, rebuilt: baked && before.baked };
}

export async function withdraw(
  adapter: DataAdapter,
  loafId: LoafId,
  amountCents: number,
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
  const tx = newTransaction(data, loafId, 'withdrawal', amountCents, await nowIso(adapter));
  await adapter.save(data);
  return { ok: true, transaction: tx, status: statusFor(data, loaf), message: REBUILD_MESSAGE };
}
