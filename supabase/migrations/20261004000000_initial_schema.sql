-- Dough! initial schema (milestone 12).
-- Every table is scoped to one user and has Row Level Security on, so a signed-in
-- student can only read and write their own rows. Money is integer cents.
-- No balance column exists anywhere: balances come only from `transactions` rows (src/money/).
-- Row ids made by the app are text ('tx-3' from older data, a UUID for new rows), so primary keys
-- are composite with user_id.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  placement_status text not null check (placement_status in ('complete', 'partial', 'skipped')),
  essentials text,
  essentials_exact_cents bigint check (essentials_exact_cents is null or essentials_exact_cents >= 0),
  essentials_cents bigint check (essentials_cents is null or essentials_cents >= 0),
  savings text,
  savings_exact_cents bigint check (savings_exact_cents is null or savings_exact_cents >= 0),
  accounts text[],
  card_debt text,
  earned_income boolean,
  months_covered numeric,
  risk jsonb,
  updated_at timestamptz not null default now()
);

create table public.loaves (
  user_id uuid not null references auth.users (id) on delete cascade,
  loaf_id text not null,
  target_cents bigint not null check (target_cents > 0),
  started_at timestamptz not null,
  bread text not null default 'sandwich',
  bakes jsonb not null default '[]'::jsonb,
  grow_from_cents bigint check (grow_from_cents is null or grow_from_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, loaf_id)
);

create table public.transactions (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  loaf_id text not null,
  type text not null check (type in ('starting', 'deposit', 'withdrawal')),
  source text not null default 'manual' check (source in ('manual', 'plaid', 'seed')),
  amount_cents bigint not null check (amount_cents > 0),
  at timestamptz not null,
  primary key (user_id, id),
  foreign key (user_id, loaf_id) references public.loaves (user_id, loaf_id) on delete cascade
);

create index transactions_loaf_at_idx on public.transactions (user_id, loaf_id, at);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  loaf_id text not null,
  lesson_id text not null,
  watched_at timestamptz not null,
  how text not null check (how in ('video', 'manual')),
  primary key (user_id, loaf_id, lesson_id)
);

create table public.quiz_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  loaf_id text not null,
  mode text not null check (mode in ('test-out', 'lesson')),
  score integer not null check (score >= 0),
  total integer not null check (total > 0),
  answers jsonb not null default '{}'::jsonb,
  missed_lessons text[] not null default '{}',
  at timestamptz not null,
  primary key (user_id, id)
);

-- One row per user: plans and flags that are not money (habit, opened tips, reminder, streak unlocks, demo clock).
create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  habit jsonb,
  tips_seen text[] not null default '{}',
  hysa_card text check (hysa_card is null or hysa_card in ('pending', 'dismissed')),
  streaks jsonb not null default '{"unlocked": [], "bestDays": 0}'::jsonb,
  clock_offset_days integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security: users can only read and write their own rows.
alter table public.profiles enable row level security;
alter table public.loaves enable row level security;
alter table public.transactions enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.user_state enable row level security;

create policy "Own rows only" on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own rows only" on public.loaves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own rows only" on public.transactions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own rows only" on public.lesson_progress for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own rows only" on public.quiz_attempts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own rows only" on public.user_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Signed-out visitors get nothing.
revoke all on public.profiles, public.loaves, public.transactions, public.lesson_progress,
  public.quiz_attempts, public.user_state from anon;
grant select, insert, update, delete on public.profiles, public.loaves, public.transactions,
  public.lesson_progress, public.quiz_attempts, public.user_state to authenticated;
