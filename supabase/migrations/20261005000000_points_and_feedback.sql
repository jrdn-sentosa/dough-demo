-- Milestone 13: Dough points, the daily quiz, and feedback.
-- Same rules as the first migration: every row belongs to a user, Row Level Security is on, signed-out visitors get nothing.

-- The points ledger. Append-only: one row per award, and the primary key makes an award impossible to give twice.
-- Nobody (not even the owner of the rows) can update or delete a row, so points are never taken back.
create table public.point_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  award_key text not null check (char_length(award_key) between 1 and 200),
  kind text not null check (kind in ('fund-day', 'video', 'mastery', 'bake', 'quiz')),
  points integer not null check (points > 0),
  ref text not null default '',
  at timestamptz not null,
  primary key (user_id, award_key)
);

-- One row per day the daily quiz ran: which question was asked and what was picked.
create table public.daily_quizzes (
  user_id uuid not null references auth.users (id) on delete cascade,
  day text not null check (day ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  loaf_id text not null,
  question_id text not null,
  choice_id text,
  correct boolean,
  primary key (user_id, day)
);

-- Feedback from the Settings screen. Insert only: the app can send it but never read it back.
-- It is read in the Supabase dashboard. The length limits are enforced here too, not just in the app.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text check (category is null or category in ('bug', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 1000),
  app_version text not null default '' check (char_length(app_version) <= 100),
  screen text not null default '' check (char_length(screen) <= 200),
  created_at timestamptz not null default now()
);

alter table public.point_events enable row level security;
alter table public.daily_quizzes enable row level security;
alter table public.feedback enable row level security;

create policy "Read own points" on public.point_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Add own points" on public.point_events for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Own rows only" on public.daily_quizzes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Send own feedback" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));

-- New tables start with broad default grants, so take them back first, then give each table only what it needs.
revoke all on public.point_events, public.daily_quizzes, public.feedback from anon;
revoke all on public.point_events, public.feedback from authenticated;
grant select, insert on public.point_events to authenticated;
grant select, insert, update, delete on public.daily_quizzes to authenticated;
grant insert on public.feedback to authenticated;
