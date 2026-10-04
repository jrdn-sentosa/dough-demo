-- The daily quiz asks 3 questions a day instead of 1, and the popup that opens it can be hidden or turned off.
-- No new tables, so Row Level Security, policies and grants are unchanged.

-- A day's quiz keeps its questions in one list: [{ loafId, questionId, choiceId, correct }, ...].
-- The one-question columns stay (and become optional) so days saved before this change still load.
alter table public.daily_quizzes add column questions jsonb check (questions is null or jsonb_typeof(questions) = 'array');
alter table public.daily_quizzes alter column loaf_id drop not null;
alter table public.daily_quizzes alter column question_id drop not null;

-- Bring the days already saved over to the list, so every row has its questions in one place.
update public.daily_quizzes
set questions = jsonb_build_array(
  jsonb_build_object('loafId', loaf_id, 'questionId', question_id, 'choiceId', choice_id, 'correct', correct)
)
where questions is null and question_id is not null;

-- Finishing the quiz earns `quiz`, and getting every question right earns `quiz-bonus`.
alter table public.point_events drop constraint point_events_kind_check;
alter table public.point_events add constraint point_events_kind_check
  check (kind in ('fund-day', 'video', 'mastery', 'bake', 'quiz', 'quiz-bonus'));

-- The popup preference: { "off": boolean, "hiddenDay": "YYYY-MM-DD" | null }. A flag, not money.
alter table public.user_state add column daily_quiz_popup jsonb check (daily_quiz_popup is null or jsonb_typeof(daily_quiz_popup) = 'object');
