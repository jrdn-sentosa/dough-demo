import { DEFAULT_BREAD, UNLOCKABLE_BREADS, isBreadId } from '../domain/breads';
import type { DailyQuizEntry } from '../domain/dailyQuiz';
import { POINT_KINDS, type PointEvent } from '../domain/points';
import { TRANSACTION_SOURCES, type AppData, type Bake, type LoafRecord, type Streaks, type TransactionSource } from './types';

/**
 * Loaves saved before `bakes` existed had `firstBakedAt` and `bakedAtStart`.
 * Turn those into a one-entry bake list, and default `growFromCents` to null.
 */
function withBakes(loaf: LoafRecord): LoafRecord {
  const legacy = loaf as LoafRecord & { firstBakedAt?: string | null; bakedAtStart?: boolean };
  const { firstBakedAt, bakedAtStart, ...rest } = legacy;
  let bakes: Bake[];
  if (Array.isArray(rest.bakes)) bakes = rest.bakes;
  else if (typeof firstBakedAt === 'string') {
    bakes = [{ targetCents: rest.targetCents, at: firstBakedAt, bread: DEFAULT_BREAD }];
  } else if (bakedAtStart === true) bakes = [{ targetCents: rest.targetCents, at: null, bread: DEFAULT_BREAD }];
  else bakes = [];
  // Loaves and bakes saved before breads existed are sandwich loaves.
  return {
    ...rest,
    bread: isBreadId(rest.bread) ? rest.bread : DEFAULT_BREAD,
    bakes: bakes.map((b) => ({ ...b, bread: isBreadId(b.bread) ? b.bread : DEFAULT_BREAD })),
    growFromCents: typeof rest.growFromCents === 'number' ? rest.growFromCents : null,
  };
}

/** Old saved data has no streaks. Keep only well-formed unlocks of ladder breads, once each. */
function withStreaks(streaks: Streaks | undefined): Streaks {
  const seen = new Set<string>();
  const unlocked = (Array.isArray(streaks?.unlocked) ? streaks.unlocked : []).filter((u) => {
    const ok =
      (UNLOCKABLE_BREADS as readonly string[]).includes(u?.bread) && typeof u.at === 'string' && !seen.has(u.bread);
    if (ok) seen.add(u.bread);
    return ok;
  });
  const bestDays = streaks?.bestDays;
  return {
    unlocked: unlocked.map((u) => ({ bread: u.bread, at: u.at, seen: u.seen === true })),
    bestDays: typeof bestDays === 'number' && Number.isFinite(bestDays) && bestDays > 0 ? bestDays : 0,
  };
}

/** Keeps well-formed ledger rows with positive whole points, one per key. Points are never deducted. */
function withPoints(points: unknown): PointEvent[] {
  if (!Array.isArray(points)) return [];
  const seen = new Set<string>();
  const out: PointEvent[] = [];
  for (const p of points as PointEvent[]) {
    const ok =
      typeof p?.key === 'string' &&
      (POINT_KINDS as readonly string[]).includes(p.kind) &&
      Number.isInteger(p.points) &&
      p.points > 0 &&
      typeof p.at === 'string' &&
      !seen.has(p.key);
    if (!ok) continue;
    seen.add(p.key);
    out.push({ key: p.key, kind: p.kind, points: p.points, at: p.at, ref: typeof p.ref === 'string' ? p.ref : '' });
  }
  return out;
}

/** Keeps well-formed daily quiz entries, one per day. */
function withDailyQuizzes(entries: unknown): DailyQuizEntry[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: DailyQuizEntry[] = [];
  for (const e of entries as DailyQuizEntry[]) {
    if (typeof e?.day !== 'string' || typeof e.loafId !== 'string' || typeof e.questionId !== 'string' || seen.has(e.day)) continue;
    seen.add(e.day);
    out.push({
      day: e.day,
      loafId: e.loafId,
      questionId: e.questionId,
      choiceId: typeof e.choiceId === 'string' ? e.choiceId : null,
      correct: typeof e.correct === 'boolean' ? e.correct : null,
    });
  }
  return out;
}

/**
 * Quiz answers used to be saved as choice positions (numbers). They are choice ids (text) now.
 * This is demo data, so attempts saved the old way are dropped instead of converted.
 */
function hasChoiceIds(attempt: { answers?: unknown }): boolean {
  const answers = attempt.answers;
  return typeof answers === 'object' && answers !== null && Object.values(answers).every((v) => typeof v === 'string');
}

/**
 * Fills in fields that older saved data didn't have. Rows saved before `source` existed (or with a bad value) count as manual.
 * Shared by every adapter, so local and Supabase data load the same way.
 */
export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    profile: data.profile ? { ...data.profile, risk: data.profile.risk ?? null } : null,
    loaves: data.loaves.map(withBakes),
    lessonProgress: Array.isArray(data.lessonProgress) ? data.lessonProgress : [],
    quizAttempts: Array.isArray(data.quizAttempts) ? data.quizAttempts.filter(hasChoiceIds) : [],
    habit: data.habit ?? null,
    tipsSeen: Array.isArray(data.tipsSeen) ? data.tipsSeen : [],
    hysaCard: data.hysaCard === 'pending' || data.hysaCard === 'dismissed' ? data.hysaCard : null,
    streaks: withStreaks(data.streaks),
    points: withPoints(data.points),
    dailyQuizzes: withDailyQuizzes(data.dailyQuizzes),
    transactions: data.transactions.map((t) => ({
      ...t,
      source: TRANSACTION_SOURCES.includes(t.source) ? t.source : ('manual' as TransactionSource),
    })),
  };
}
