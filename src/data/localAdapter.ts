import { DEFAULT_BREAD, UNLOCKABLE_BREADS, isBreadId } from '../domain/breads';
import type { DataAdapter } from './adapter';
import { TRANSACTION_SOURCES, emptyData, type AppData, type Bake, type LoafRecord, type Streaks, type TransactionSource } from './types';

export const STORAGE_KEY = 'dough:v1';

/** The slice of the Web Storage API we use, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isAppData(value: unknown): value is AppData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const clock = v.clock as Record<string, unknown> | null | undefined;
  return (
    v.version === 1 &&
    Array.isArray(v.loaves) &&
    Array.isArray(v.transactions) &&
    typeof clock === 'object' &&
    clock !== null &&
    Number.isInteger(clock.offsetDays)
  );
}

/**
 * Loaves saved before `bakes` existed had `firstBakedAt` and `bakedAtStart`.
 * Turn those into a one-entry bake list, and default `growFromCents` to null.
 */
function withBakes(loaf: LoafRecord): LoafRecord {
  const legacy = loaf as LoafRecord & { firstBakedAt?: string | null; bakedAtStart?: boolean };
  const { firstBakedAt, bakedAtStart, ...rest } = legacy;
  let bakes: Bake[];
  if (Array.isArray(rest.bakes)) bakes = rest.bakes;
  else if (typeof firstBakedAt === 'string') bakes = [{ targetCents: rest.targetCents, at: firstBakedAt }];
  else if (bakedAtStart === true) bakes = [{ targetCents: rest.targetCents, at: null }];
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

/**
 * Quiz answers used to be saved as choice positions (numbers). They are choice ids (text) now.
 * This is demo data, so attempts saved the old way are dropped instead of converted.
 */
function hasChoiceIds(attempt: { answers?: unknown }): boolean {
  const answers = attempt.answers;
  return typeof answers === 'object' && answers !== null && Object.values(answers).every((v) => typeof v === 'string');
}

/** Fills in fields that older saved data didn't have. Rows saved before `source` existed (or with a bad value) count as manual. */
function withDefaults(data: AppData): AppData {
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
    transactions: data.transactions.map((t) => ({
      ...t,
      source: TRANSACTION_SOURCES.includes(t.source) ? t.source : ('manual' as TransactionSource),
    })),
  };
}

/**
 * localStorage adapter. Browsers can block storage (private mode) or hold
 * damaged data, so every read and write is guarded. When storage can't be
 * written, the latest data is kept in memory for the rest of the session.
 */
export function createLocalAdapter(storage?: StorageLike): DataAdapter {
  let fallback: AppData | null = null;

  function resolveStorage(): StorageLike | null {
    try {
      return storage ?? window.localStorage;
    } catch {
      return null;
    }
  }

  return {
    async load() {
      try {
        const raw = resolveStorage()?.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isAppData(parsed)) return withDefaults(parsed);
        }
      } catch {
        // fall through to the in-memory copy or fresh data
      }
      return fallback ?? emptyData();
    },
    async save(data) {
      fallback = data;
      try {
        resolveStorage()?.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // storage blocked or full: keep going from memory
      }
    },
  };
}
