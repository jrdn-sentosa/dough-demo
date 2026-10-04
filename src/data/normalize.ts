import { DEFAULT_BREAD, UNLOCKABLE_BREADS, isBreadId } from '../domain/breads';
import type { DailyQuestionEntry, DailyQuizEntry, PopupPrefs } from '../domain/dailyQuiz';
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

/** One question of a daily quiz, or null when it isn't well formed. */
function withDailyQuestion(q: Partial<DailyQuestionEntry> | null | undefined): DailyQuestionEntry | null {
  if (typeof q?.loafId !== 'string' || typeof q.questionId !== 'string') return null;
  return {
    loafId: q.loafId,
    questionId: q.questionId,
    choiceId: typeof q.choiceId === 'string' ? q.choiceId : null,
    correct: typeof q.correct === 'boolean' ? q.correct : null,
  };
}

/**
 * Keeps well-formed daily quiz entries, one per day. A day saved when the quiz asked a single question
 * (`loafId`, `questionId`, `choiceId` and `correct` on the entry itself) becomes a one-question entry.
 */
function withDailyQuizzes(entries: unknown): DailyQuizEntry[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const out: DailyQuizEntry[] = [];
  for (const e of entries as (Partial<DailyQuizEntry> & Partial<DailyQuestionEntry>)[]) {
    if (typeof e?.day !== 'string' || seen.has(e.day)) continue;
    const raw = Array.isArray(e.questions) ? e.questions : [e];
    const questions = raw.map(withDailyQuestion).filter((q): q is DailyQuestionEntry => q !== null);
    if (questions.length === 0) continue;
    seen.add(e.day);
    out.push({ day: e.day, questions });
  }
  return out;
}

/** Old saved data has no popup preference: the popup is on and nothing is hidden. */
function withPopupPrefs(prefs: Partial<PopupPrefs> | null | undefined): PopupPrefs {
  return {
    off: prefs?.off === true,
    hiddenDay: typeof prefs?.hiddenDay === 'string' ? prefs.hiddenDay : null,
  };
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
    dailyQuizPopup: withPopupPrefs(data.dailyQuizPopup),
    transactions: data.transactions.map((t) => ({
      ...t,
      source: TRANSACTION_SOURCES.includes(t.source) ? t.source : ('manual' as TransactionSource),
    })),
  };
}
