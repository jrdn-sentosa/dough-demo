import type { BreadId } from '../domain/breads';
import type { DailyQuizEntry, PopupPrefs } from '../domain/dailyQuiz';
import type { Habit } from '../domain/habits';
import type { PointEvent, PointKind } from '../domain/points';
import type { PlacementStatus, Profile } from '../domain/profile';
import type { RiskRecord } from '../domain/risk';
import type { AccountType, CardDebt, LoafId } from '../domain/types';
import { emptyData } from './types';
import type {
  AppData,
  Bake,
  HysaCardState,
  LessonProgress,
  LoafRecord,
  QuizAttempt,
  QuizMode,
  Streaks,
  Transaction,
  TransactionSource,
  TransactionType,
} from './types';

/** One database row. Column names are snake_case, exactly as in `supabase/migrations`. */
export type Row = Record<string, unknown>;

/** Tables in the order they must be written (a transaction needs its loaf first). Deletes run in reverse. */
export const TABLES = [
  'profiles',
  'loaves',
  'transactions',
  'lesson_progress',
  'quiz_attempts',
  'point_events',
  'daily_quizzes',
  'user_state',
] as const;
export type TableName = (typeof TABLES)[number];

export type TableRows = Record<TableName, Row[]>;

/** The columns that identify a row besides `user_id`. */
export const KEY_COLUMNS: Record<TableName, readonly string[]> = {
  profiles: [],
  loaves: ['loaf_id'],
  transactions: ['id'],
  lesson_progress: ['loaf_id', 'lesson_id'],
  quiz_attempts: ['id'],
  point_events: ['award_key'],
  daily_quizzes: ['day'],
  user_state: [],
};

/** Tables that only ever gain rows: written with insert-and-ignore-duplicates, never updated or deleted. */
export const APPEND_ONLY_TABLES: readonly TableName[] = ['point_events'];

export function emptyRows(): TableRows {
  return {
    profiles: [],
    loaves: [],
    transactions: [],
    lesson_progress: [],
    quiz_attempts: [],
    point_events: [],
    daily_quizzes: [],
    user_state: [],
  };
}

/** A stable string for a row's primary key, used to compare saved and new rows. */
export function rowKey(table: TableName, row: Row): string {
  return KEY_COLUMNS[table].map((c) => String(row[c])).join('\u0000');
}

/**
 * AppData to rows. `userId` comes from the signed-in session, never from AppData, so a caller can't
 * write into another user's rows (Row Level Security would refuse it anyway).
 */
export function toRows(data: AppData, userId: string): TableRows {
  const p = data.profile;
  return {
    profiles: p
      ? [
          {
            user_id: userId,
            placement_status: p.placementStatus,
            essentials: p.essentials,
            essentials_exact_cents: p.essentialsExactCents,
            essentials_cents: p.essentialsCents,
            savings: p.savings,
            savings_exact_cents: p.savingsExactCents,
            accounts: p.accounts,
            card_debt: p.cardDebt,
            earned_income: p.earnedIncome,
            months_covered: p.monthsCovered,
            risk: p.risk,
          },
        ]
      : [],
    loaves: data.loaves.map((l) => ({
      user_id: userId,
      loaf_id: l.loafId,
      target_cents: l.targetCents,
      started_at: l.startedAt,
      bread: l.bread,
      bakes: l.bakes,
      grow_from_cents: l.growFromCents,
    })),
    transactions: data.transactions.map((t) => ({
      user_id: userId,
      id: t.id,
      loaf_id: t.loafId,
      type: t.type,
      source: t.source,
      amount_cents: t.amountCents,
      at: t.at,
    })),
    lesson_progress: data.lessonProgress.map((l) => ({
      user_id: userId,
      loaf_id: l.loafId,
      lesson_id: l.lessonId,
      watched_at: l.watchedAt,
      how: l.how,
    })),
    quiz_attempts: data.quizAttempts.map((q) => ({
      user_id: userId,
      id: q.id,
      loaf_id: q.loafId,
      mode: q.mode,
      score: q.score,
      total: q.total,
      answers: q.answers,
      missed_lessons: q.missedLessons,
      at: q.at,
    })),
    point_events: data.points.map((e) => ({
      user_id: userId,
      award_key: e.key,
      kind: e.kind,
      points: e.points,
      ref: e.ref,
      at: e.at,
    })),
    daily_quizzes: data.dailyQuizzes.map((q) => ({
      user_id: userId,
      day: q.day,
      questions: q.questions,
      // The columns from when the quiz asked one question a day. New rows leave them empty.
      loaf_id: null,
      question_id: null,
      choice_id: null,
      correct: null,
    })),
    user_state: [
      {
        user_id: userId,
        habit: data.habit,
        tips_seen: data.tipsSeen,
        hysa_card: data.hysaCard,
        daily_quiz_popup: data.dailyQuizPopup,
        streaks: data.streaks,
        clock_offset_days: data.clock.offsetDays,
      },
    ],
  };
}

/** The database hands timestamps back in its own format; keep them as the app writes them (ISO, UTC). */
function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function num(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function str(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/**
 * Rows to AppData. A missing profile row means the student hasn't answered or skipped placement yet,
 * and a missing user_state row means no habit, no seen tips and a clock at real time.
 * The result still goes through `normalizeAppData`, like every adapter's data.
 */
export function fromRows(rows: TableRows, user: { email: string } | null): AppData {
  const data = emptyData();
  data.user = user;

  const p = rows.profiles[0];
  if (p) {
    const profile: Profile = {
      placementStatus: p.placement_status as PlacementStatus,
      essentials: str(p.essentials),
      essentialsExactCents: num(p.essentials_exact_cents),
      essentialsCents: num(p.essentials_cents),
      savings: str(p.savings),
      savingsExactCents: num(p.savings_exact_cents),
      accounts: Array.isArray(p.accounts) ? (p.accounts as AccountType[]) : null,
      cardDebt: str(p.card_debt) as CardDebt | null,
      earnedIncome: typeof p.earned_income === 'boolean' ? p.earned_income : null,
      monthsCovered: num(p.months_covered),
      risk: (p.risk ?? null) as RiskRecord | null,
    };
    data.profile = profile;
  }

  data.loaves = rows.loaves.map(
    (r): LoafRecord => ({
      loafId: r.loaf_id as LoafId,
      targetCents: Number(r.target_cents),
      startedAt: iso(r.started_at),
      bread: r.bread as BreadId,
      bakes: (Array.isArray(r.bakes) ? r.bakes : []) as Bake[],
      growFromCents: num(r.grow_from_cents),
    }),
  );

  data.transactions = rows.transactions
    .map(
      (r): Transaction => ({
        id: String(r.id),
        loafId: r.loaf_id as LoafId,
        type: r.type as TransactionType,
        source: r.source as TransactionSource,
        amountCents: Number(r.amount_cents),
        at: iso(r.at),
      }),
    )
    // Oldest first, like the order they were written in. `starting` stays a loaf's first row even on a tie.
    .sort((a, b) => a.at.localeCompare(b.at) || Number(b.type === 'starting') - Number(a.type === 'starting'));

  data.lessonProgress = rows.lesson_progress.map(
    (r): LessonProgress => ({
      loafId: r.loaf_id as LoafId,
      lessonId: String(r.lesson_id),
      watchedAt: iso(r.watched_at),
      how: r.how as LessonProgress['how'],
    }),
  );

  data.quizAttempts = rows.quiz_attempts
    .map(
      (r): QuizAttempt => ({
        id: String(r.id),
        loafId: r.loaf_id as LoafId,
        mode: r.mode as QuizMode,
        score: Number(r.score),
        total: Number(r.total),
        answers: (r.answers ?? {}) as Record<string, string>,
        missedLessons: Array.isArray(r.missed_lessons) ? (r.missed_lessons as string[]) : [],
        at: iso(r.at),
      }),
    )
    .sort((a, b) => a.at.localeCompare(b.at));

  data.points = rows.point_events
    .map(
      (r): PointEvent => ({
        key: String(r.award_key),
        kind: r.kind as PointKind,
        points: Number(r.points),
        at: iso(r.at),
        ref: String(r.ref ?? ''),
      }),
    )
    .sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));

  // A row from before the quiz asked three questions has no `questions`: its single question is in the old columns.
  data.dailyQuizzes = rows.daily_quizzes
    .map(
      (r): DailyQuizEntry => ({
        day: String(r.day),
        questions:
          Array.isArray(r.questions) && r.questions.length > 0
            ? (r.questions as DailyQuizEntry['questions'])
            : r.question_id == null
              ? []
              : [
                  {
                    loafId: r.loaf_id as LoafId,
                    questionId: String(r.question_id),
                    choiceId: str(r.choice_id),
                    correct: typeof r.correct === 'boolean' ? r.correct : null,
                  },
                ],
      }),
    )
    .sort((a, b) => a.day.localeCompare(b.day));

  const s = rows.user_state[0];
  if (s) {
    data.habit = (s.habit ?? null) as Habit | null;
    data.tipsSeen = Array.isArray(s.tips_seen) ? (s.tips_seen as string[]) : [];
    data.hysaCard = (s.hysa_card ?? null) as HysaCardState;
    data.dailyQuizPopup = (s.daily_quiz_popup ?? data.dailyQuizPopup) as PopupPrefs;
    data.streaks = (s.streaks ?? data.streaks) as Streaks;
    data.clock = { offsetDays: Number(s.clock_offset_days ?? 0) };
  }
  return data;
}
