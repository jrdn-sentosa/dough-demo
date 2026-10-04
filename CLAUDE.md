# Dough! tech demo

Dough! is a mobile-first web app that teaches college students money basics and helps them act on what they learn. Each loaf is one money topic with one savings goal. The student watches short video lessons, takes a quiz, then moves money toward the goal, and the loaf rises as they save. When the target is reached, the loaf is done and they choose a new one.

This repository is a **tech demo only**. It runs as a progressive web app (PWA) that looks and feels like a native phone app. Only the first loaf, the emergency fund, is fully built.

## Non-negotiable rules

- **No real bank connections.** Plaid is allowed only in Sandbox mode, in the Plaid milestone. Never use Plaid development or production keys. Never integrate payment, brokerage, or other account-linking APIs (Stripe, etc.). Nothing ever moves real money: all deposits and withdrawals are simulated, and Plaid is read-only (see "Plaid Sandbox bank linking").
- **No real payments.** Plus is simulated until a later milestone adds a payment provider in test mode only. Until then, no payment code, packages, or keys (see "Dough! Plus").
- **No real financial details.** Never ask for or store bank account numbers, card numbers, SSNs, or income documents. Placement answers use ranges, not exact figures, where possible.
- **All simulated money lives in `src/money/`.** No other folder creates, edits, or calculates balances directly. This keeps the fake layer replaceable.
- **No secrets in git.** Keys go in `.env.local`, which is in `.gitignore`. Only `.env.example` (with empty values) is committed.
- **Label it.** The app shows "Educational demo. Not financial advice. No real money moves." on the sign-up screen and in Settings.
- **No group or social features.** No crews, friends, leaderboards, or sharing balances.

## Stack

- React + TypeScript (strict mode) + Vite
- `vite-plugin-pwa` for the manifest and service worker
- Supabase for auth (email one-time code and Google) and the database, through `@supabase/supabase-js`. The Supabase CLI is run with `npx supabase ...` and is not a dependency.
- Plain CSS with CSS variables for design tokens (no UI kit)
- Fonts self-hosted with `@fontsource-variable/fraunces` and `@fontsource-variable/dm-sans` so the app works offline
- Native HTML `<video>` with WebVTT captions for lessons
- `react-router` for routing (so the phone's back button and deep links like `?demo=1` work)
- `react-markdown` for lesson summaries. Frontmatter is parsed by a small in-house function, not gray-matter.
- Vitest for unit tests, plus `@testing-library/react`, `@testing-library/user-event`, and `jsdom` (dev dependencies) for screen tests. Screen test files opt in to jsdom with a `// @vitest-environment jsdom` comment at the top and call `cleanup` after each test.
- Stretch milestone only: Plaid Sandbox through Supabase server functions. The Plaid Link library is not approved yet. Ask before adding it.

Ask before adding any dependency not listed here.

## Commands

- `npm run dev`: start the dev server
- `npm run build`: production build (must pass before a task is done)
- `npm run preview`: serve the production build, used to test PWA install and offline behavior
- `npm run test`: run Vitest
- `npm run lint`: run ESLint

## Folder structure

```
src/
  app/          routing, providers, app shell, phone frame for desktop
  screens/      Login, PlacementQuiz, PlacementResult, NewLoaf, Lesson,
                LoafQuiz, SavingSetup, Home, LoafComplete, ChooseLoaf,
                Shelf, RiskQuiz, RiskResult, Settings
  components/   LoafButton, SliceButton, LoafIllustration, ProgressBar,
                ChoiceGroup (radio or checkbox inputs styled as slice buttons,
                used by placement and the quiz), VideoPlayer, QuizQuestion, LessonRow,
                StageBar, HabitCard, TipRow, AmountSheet, HysaPoints (Home and Saving setup)
  domain/       pure logic: placement scoring, targets, stages,
                recommendations, quiz grading (no React, no Supabase)
  content/      typed loader for everything in content/ (import.meta.glob),
                throws on malformed content; review-page renderer
  money/        simulated deposits and withdrawals, demo clock
  data/         the only code that talks to storage: DataAdapter interface,
                localStorage (demo user), in-memory (tests) and Supabase (real accounts) adapters
  styles/       tokens.css, global.css
content/
  placement.json            placement quiz questions and scoring
  risk.json                 risk quiz questions and result copy (educational)
  loaves/<loaf>.json        loaf definition: title, bread, lessons, quiz, tips
  lessons/<loaf>/<id>.md    lesson page text and video metadata
  quizzes/<loaf>.json       loaf quiz questions
public/
  videos/<loaf>/            lesson videos (MP4, H.264) and captions (.vtt)
  icons/                    PWA icons
design/
  loaves/                   stage illustrations as SVG
```

## The user flow

```
Login
  → Placement quiz (about 2 minutes, optional: "Skip for now" on every screen)
  → Placement result: "Here's where you'll start" (first loaf, goal, head start)
  → Video lessons for this loaf (or "Already know this? Take the quiz first")
  → Loaf quiz
  → Saving setup: pick a habit, encourage moving money into savings
  → Home: loaf rises as money is added over time
  → Target reached: celebration, then the loaf goes on the bread shelf
  → Choose your next loaf: keep saving (grow the cushion) or start investing (risk quiz)
```

First-time users go through every step in order. Returning users land on Home.

## Placement quiz

Purpose: work out where the student starts: which loaf first, how big the goal is, how much of it they already have, and which setup steps apply. **Placement is about the student's situation, not their knowledge, and assigns no level or label anywhere.** Knowledge is checked inside each loaf (see Lessons and quizzes). Frame placement as "Let's get to know your money," not a test. One question per screen with a progress bar.

**Placement is only for personalization and baseline goals, and it is optional.** Every screen has "Skip for now". Skipping asks for confirmation ("No problem. You'll start from the beginning with a default goal of $1,000, about one month of typical essentials. You can personalize anytime in Settings." with "Skip" and "Keep answering"). Answers already given are kept, and defaults fill only the rest. The profile stores `placementStatus`: `complete` (all 5 answered), `partial` (skipped partway, at least one answer kept), or `skipped` (nothing answered). The $1,000 figure is `DEFAULT_GOAL_CENTS`; content uses a `{goal}` token, never a typed figure.

**5 questions:**

1. **Monthly essentials** (bands below). Explains what to count: "Rent, food, phone, transportation, and anything else you'd need to get by for a month. If your housing or meals are prepaid, count only what you still pay each month."
2. **Money set aside for emergencies** (bands below).
3. **Which accounts do you have?** (multi-select): checking, regular savings, high-yield savings, retirement account (Roth IRA, 401(k), 403(b)), investment account or investing app, none, not sure.
4. **Do you carry a credit card balance month to month?** Yes, no, no credit card.
5. **Do you earn income from a job?** Yes, no.

### Range bands

Bands are defined once in `src/domain/` constants. Content refers to them by id.

| Monthly essentials | Used for target |
|---|---|
| Under $250 | midpoint |
| $250–$499 | midpoint |
| $500–$749 | midpoint |
| $750–$999 | midpoint |
| $1,000–$1,499 | midpoint |
| $1,500 and up | open-ended: lower bound, `needsExactInput: true` |
| Not sure | essentials unknown (`cents: null`). The goal is the $1,000 starter goal, flagged `isDefault: true`, which the student can change in Settings |

Target = midpoint rounded up to the nearest $50.

| Existing emergency savings | Credited at |
|---|---|
| None | $0 |
| $1–$99 | $1 |
| $100–$249 | $100 |
| $250–$499 | $250 |
| $500–$999 | $500 |
| $1,000 and up | $1,000 |

Existing savings count by default for everyone: if the student reported any savings, the "Count the money I already have set aside" box starts checked, whatever their months covered, and they can uncheck it. When counted, offer an optional exact amount, prefilled with the band's lower bound. If they enter one, use it instead.

### Unknown answers (skipped or "Not sure")

| Question | When unknown |
|---|---|
| Essentials | Unknown, never guessed. The emergency fund starts at the $1,000 starter goal (`isDefault: true`), and existing savings count toward it. If savings already meet $1,000, the fund counts as baked ("Already built"). `monthsCovered` is not computed |
| Existing savings | None, so the loaf starts as a dough ball |
| Accounts | Unknown: include the high-yield savings step, and `ef-where-to-keep` stays recommended |
| Card debt, earned income | Unknown (see ChooseLoaf rules) |

### Starting point

`monthsCovered` = existing savings ÷ monthly essentials. It is internal only, never shown as a label, and stored on the profile. It is null when essentials are unknown.

| Situation | Start |
|---|---|
| Under 1 month | Emergency fund loaf, target 1 month, any existing savings counted so it starts partly risen |
| 1 to under 3 months, no card debt | Emergency fund loaf, target 3 months, existing savings counted so it starts partly risen |
| 1 to under 3 months, card debt | Emergency fund counts as baked and goes on the shelf. Recommend Debt payoff next |
| 3+ months | Emergency fund counts as baked and goes on the shelf. ChooseLoaf: card debt → Debt payoff; earned income and no retirement account → Roth IRA; otherwise Index funds |

### Account rules

- **No savings account of any kind** (no regular or high-yield savings): Saving setup includes a step about opening a high-yield savings account.
- **Has high-yield savings:** skip that step, and lesson `ef-where-to-keep` is optional, tagged "You're already doing this."
- **Has investments but under 3 months covered:** still starts with the emergency fund loaf, with a note that a cushion means never having to sell investments at a loss in an emergency.

### Placement result screen

Titled "Here's where you'll start." Shows the first loaf, the goal in dollars and months, and how far along existing savings put them. When placement was skipped, it says "Your first loaf: Emergency fund. Starting goal: $1,000, a default you can change in Settings."

### Retaking placement and changing the goal (Settings)

Settings (`/settings`, linked from Home) exists in a bare form since milestone 12: the signed-in email and **Sign out** (real accounts) or **Exit demo** (the demo user, who has no account; it uses `signOutLocal` and keeps the local demo data, so "Continue as demo user" picks up where they left off), **Retake the quiz** (`/placement?retake=1&return=/settings`) and the disclaimer. Changing the goal and the habit, the demo tools and Reset demo come with milestone 11.

- **Retake the quiz** reruns placement with current answers prefilled. New answers update the profile, account steps, and recommendations. It never deletes or changes transactions.
- If the new answers suggest a different goal, ask "Update your goal to $X?" instead of changing it silently. If the current target is the $1,000 starter goal and the student now gives essentials, suggest 1 month of essentials. If the target was months-based (1, 3, or 6 months), re-price the same number of months. A custom amount is left alone. Nothing is suggested unless the essentials or savings answer changed.
- If the current loaf already has transactions, skip the existing savings question: that money is already tracked.
- **Change your goal:** pick 1, 3, or 6 months, or type an amount. It uses `setTarget` (through `changeGoal`), so the existing rules apply: at or below the balance bakes the loaf, and above it on a baked fund starts growing. While rebuilding, a higher target just edits the goal.

Placement scoring and starting-point rules live in `src/domain/placement.ts` (and siblings) with unit tests.

## Loaves

Each loaf is a topic, a goal, a bread type, a set of video lessons, a quiz, and short tips that appear while it rises.

| Loaf | Bread | Why that bread | Demo status |
|---|---|---|---|
| Emergency fund | Sandwich loaf | The everyday staple you always keep on hand | **Fully built, required first** |
| Index funds | Braided loaf | Many strands woven into one: diversification | Coming soon |
| Bonds | Rye loaf | Dense and steady, rises slowly | Coming soon |
| Roth IRA | Sourdough | Long, slow growth over decades | Coming soon |
| Debt payoff | Flatbread | Simple and flat: clear what you owe | Coming soon |

The emergency fund loaf is the first loaf for students with under 3 months covered. Students who already have 3+ months (or 1 to 3 months with card debt) start with it on the shelf. In the demo, ChooseLoaf offers two paths, "Keep saving" and "Start investing" (see "Save or invest"), and lists the other four loaves as "Coming soon" rows that are not buttons. At most one path is tagged "Recommended," and both paths stay choosable.

Each topic keeps its bread above as the default. A student can also pick any bread they have unlocked with a saving streak for the next loaf (see "Streaks and bread unlocks").

### Emergency fund loaf

- **Target:** 1 month of essential costs by default (3 months when they start with 1 to under 3 months covered), rounded up to the nearest $50. The student can choose 1, 3, or 6 months.
- **Ranges to numbers:** the placement quiz collects ranges, but targets and stages need dollar figures. See "Range bands" under Placement quiz.
  - Open-ended top range: lower bound, and ask the student to type an exact number.
  - "Not sure" or skipped: essentials are unknown. Start at the $1,000 starter goal (`isDefault`), which the student can change in Settings.
  - Always let the student edit the target on the "Your new loaf" screen.
  - Existing savings: lower bound of the chosen range, so the loaf never shows more progress than the student really has. An optional exact amount overrides it.
- **Existing savings:** if the student already has money set aside, ask whether to count it. If yes, the loaf starts at the matching stage. If it already meets the target, suggest a bigger target instead of finishing instantly.
- **Video lessons (3, each under 2 minutes):**
  1. What an emergency fund is for
  2. How much you need
  3. Where to keep it: high-yield savings
- **Loaf quiz:** 5 questions on those videos.
- **While it rises (short text tips, unlocked by stage):** Shape "Why small deposits add up", Proof "Make it automatic", Bake "When it's the right time to use it", Baked "Choosing your next loaf".

## Lessons and quizzes

### Content rules (financial copy)

- **Draft flag:** every content file carries a boolean `draft`. The app shows a "Draft content" note while it is `true`. Removing the flag after review must not break anything.
- **Nothing that goes stale:** no specific interest rates, yields, or dollar figures. Say "much more than a regular savings account," not a rate. (Placement range labels are the one exception; they come from the bands.)
- **No brand names:** never name specific banks, credit unions, or apps.
- **Insurance:** when explaining high-yield savings, say the account should be insured by the FDIC (banks) or the NCUA (credit unions).
- **Plain language:** about a 2-minute read per lesson summary. Tests enforce the number, name, and FDIC/NCUA rules.

- Lessons are videos with captions (WebVTT) and a short text summary below. Track "watched" when the student reaches 90% of the video or taps "Mark as watched."
- **Missing video:** no fake video files. If a lesson's video file is missing, show a "Video coming soon" poster with the lesson summary and a "Mark as watched" button. Real videos are added later by filename in `public/videos/<loaf>/`.
- Each loaf quiz question has 3–4 choices, each with a fixed string `id` (like `car-repair`), one correct answer given by choice id, an explanation, and a link back to the lesson and timestamp that covers it.
- Quiz format in `content/quizzes/<loaf>.json`:

```
{
  "id": "ef-q1",
  "question": "What is an emergency fund for?",
  "choices": [
    { "id": "spring-break", "label": "A spring break trip" },
    { "id": "car-repair", "label": "A surprise car repair" },
    { "id": "textbooks", "label": "New textbooks" }
  ],
  "answer": "car-repair",
  "explain": "It's for urgent costs you couldn't plan for.",
  "lesson": "ef-what-its-for",
  "timestamp": 34
}
```

- **Quiz screens:** one question per screen with a progress bar. In the normal quiz the student picks a choice (and can change it), then taps "Check answer"; feedback appears and the choices lock only after Check. Right answers are sage, wrong picks are crust, each with the explanation, and a wrong pick gets "Rewatch this part" (a link to the lesson at its timestamp, or "Read the summary" when the video file doesn't exist).
- **Shuffling:** question order and choice order are shuffled on every attempt, in both normal and test-out modes (`src/domain/shuffle.ts`). Answers, saved attempts, grading, and lesson links all use the choice's fixed string id from the content file, never its position on screen or its wording. Ids are unique within a question and the `answer` must be one of them (the loader throws otherwise, and a test checks the content). Quiz attempts saved with positions before this change are dropped on load, since this is demo data.
- **Mastery:** a loaf's lessons are "Mastered" once the best normal-quiz score is 4 out of 5 (80%) or more. It is worked out from saved attempts (`bestScore`, `isMastered` in `src/domain/mastery.ts`), not stored, and a later lower score never takes it away. Test-out attempts don't count. The lessons list shows a "Mastered" badge, and the quiz end screen says "You mastered this loaf's lessons." Below 4 it keeps the missed-question explanations and adds "Get 4 out of 5 to master these lessons. You can try again anytime." Retries have no limit and no cooldown.
- **Emergency fund quiz:** completing it unlocks Saving setup. It does not require a passing score, because the real goal is getting the student to save. Show the score, explain every wrong answer, and allow retries.
- **Investment loaves (future):** require 80% (4 out of 5) to start, since understanding risk protects new investors. This check applies to everyone, including students who test out of the videos. No cooldown: students can retry right away, as many times as they like.
- **Test out (knowledge is checked inside each loaf):** before a loaf's videos, offer "Already know this? Take the quiz first."
  - The test-out quiz gives **no per-question feedback** (no Check step, no explanations). Its end screen shows the score and, when it was missed, which lessons to review, but never the correct answers or explanations.
  - 4 or more of 5 correct: the videos become optional, with copy like "You know this. Let's make it happen." Go to Saving setup.
  - Fewer: each missed question recommends its lesson (quiz questions already map to lessons), the lessons list shows those as "Recommended" and collapses the rest, and Saving setup stays locked. After the lessons, the student takes the normal quiz, with full feedback.
  - Lesson progress (`lessonProgress`) and quiz attempts (`quizAttempts`, with `mode` of `test-out` or `lesson`) are saved through the data adapter. Saving setup opens after a normal quiz at any score or a passing test-out. Routes: `/lessons`, `/lessons/:lessonId?t=<seconds>`, `/quiz` (`?mode=test-out` for the test-out), `/saving-setup`. The route guard keeps a new loaf on `/lessons` until Saving setup is unlocked.
  - The normal path (no test-out) is unchanged: videos, then quiz.

## Saving and rising

- **Saving setup:** the student picks a habit and sees both suggestions: **weekly** = target ÷ 12 weeks (about one semester), rounded up to the nearest $5, minimum $5; **per paycheck** = 10% of each paycheck. Placement doesn't ask income type, so the student chooses. They also see the suggested account type (high-yield savings). In the demo there is no real account. Students with no savings account of any kind get an extra step about opening a high-yield savings account; students who already have one skip it.
- **Saving setup steps:** (1) only when the account rules say so, a "Open a high-yield savings account" step with the "what to look for" points from the lesson, "I have one now" and "I'll do this later". Neither blocks. "I have one now" adds `high-yield-savings` to the profile's accounts (dropping "None" and "Not sure"), so a retake shows it selected and later loaves skip the step. "I'll do this later" puts a small dismissible reminder card on Home with the same points and the same "I have one now". (2) The habit: weekly or 10% of each paycheck, editable. A paycheck habit asks how often they are paid (every week, every two weeks, twice a month, once a month, it varies). "Skip for now" saves the suggested weekly amount and says it can be changed in Settings. (3) "Make it automatic", then Home. Home waits for a habit (the route guard sends a student with none to `/saving-setup`), except for a fund that has baked.
- **Habit card (Home):** the habit is a plan stored on `AppData.habit`, never a balance. Periods are fixed windows counted from the day the habit started, by the demo clock: 7 days (weekly), 14, 15 (twice a month) or 30 (monthly). The card shows "Logged" when any deposit falls in the current window, otherwise "Not logged yet". For "it varies" the card reads "Each paycheck" with when they last added to their loaf, never a logged status.
- **Home tips:** unlocked when the loaf reaches the tip's stage, and all stay unlocked once the fund has baked (so a withdrawal never re-locks a tip). A "New" badge shows until the tip is opened (`AppData.tipsSeen`). After a deposit or withdrawal that changes the stage, Home says so and points to a newly unlocked tip.
- **Adding money:** "I moved money to savings" logs a simulated deposit.
- **Progress** = this loaf's balance (its `starting`, deposit, and withdrawal rows) ÷ this loaf's target.

| Stage | Progress | Illustration |
|---|---|---|
| Mix | 0–24% | small dough ball |
| Shape | 25–49% | shaped loaf, pale |
| Proof | 50–74% | larger puffy loaf, pale |
| Bake | 75–99% | full size, butter colored, scored |
| Baked | 100% | golden brown with steam |

- **Investment loaves (future)** rise with contributions, never with market value. Show market value separately. A loaf must never shrink because the market dropped.
- Stage logic lives in `src/domain/stages.ts` as pure functions with unit tests.

## Withdrawals

- Emergency withdrawals are always allowed, instantly, up to the loaf's balance.
- The loaf shrinks to the stage that matches the new balance.
- The message is supportive, never guilt: "You used your fund for what it's for. Let's rebuild." Never use words like "failed," "lost," or "broke your streak."

## Loaf done and choosing the next loaf

- Celebration screen, then the loaf goes to the bread shelf with its completion month. A loaf counted as baked at the start (existing savings already cover the goal) shows "Already built" instead of a date, with no completion month recorded.
- **The shelf keeps every bake.** Each loaf stores a list of bakes (target and date, or "Already built" with no date). A grown fund shows two shelf entries, "1 month" and "3 months". Months are worked out from the target and the student's essentials (`monthsForTarget`), not stored. Finishing a rebuild at a target already on the shelf adds nothing; reaching a higher target than any earlier bake adds an entry.
- **ChooseLoaf is a save-or-invest choice** (see "Save or invest"). `recommendNext` decides which path gets the "Recommended" pill, using placement answers and the target that just baked. Both paths stay choosable, including when the personalization prompt is shown.
- **Grow your cushion to 3 months:** raises the target on the same emergency fund loaf with `setTarget(..., { grow: true })`. If essentials are unknown, first ask "To size your 3-month goal, about how much do you need each month?", then set the target to 3 times the answer (`growGoal`). It is allowed only when the fund is baked and the new target is bigger. The old target is stored as `growFromCents`. While growing, stage and progress count the new part only: `(balance - growFromCents) / (target - growFromCents)`, so the growth starts as a dough ball and the loaf never shrinks. Home also shows the whole fund total separately, e.g. "$400 of $1,200". Any withdrawal ends growing, and progress goes back to `balance / target` (rebuild mode). Reaching the new target returns `baked: true` and `grown: true` (not `rebuilt`), and adds the second shelf entry. Plain `setTarget` without `grow` only edits the goal.
- **Multiple loaves (future, not in demo):** after the emergency fund loaf is done, allow up to 2 active loaves. Each deposit is assigned to one loaf when logged.

### Save or invest

After the emergency fund bakes, "Choose your next loaf" offers two paths. The investing loaves stay "Coming soon" in the demo, so the invest path ends in a result, not a new loaf.

- **Keep saving:** raises the goal on the same emergency fund loaf with the grow flow described above. It works today. If the fund that baked covered under 3 months (or was the starter goal), the option is "Grow your cushion to 3 months". If it covered 3 months or more but under 6, the option is "Grow to 6 months", and it is never the recommended one. At 6 months or more, Keep saving is not offered.
- **Start investing:** if the student carries card debt (`cardDebt` is `yes`), first show "Paying off high-interest debt usually comes before investing," with "Continue anyway" and a Debt payoff row marked "Coming soon" (not a button). Then the risk quiz. If card debt is unknown, the debt check is never skipped: the personalization prompt (opens placement) comes first.
- `recommendNext` returns which path gets the "Recommended" pill (`path`: `save`, `invest`, or null), plus the same fields as before (`debtNote`, `growTargetMonths`, `growNeedsEssentials`, `needsPersonalization`). In order: (1) the fund that baked covered under 3 months, or was the starter goal: `save` (unknown answers don't block it); (2) card debt unknown: no pill, `needsPersonalization`; (3) card debt yes: no pill, the debt note is on the invest path; (4) otherwise `invest`. The "Answer a few quick questions for a personalized pick" prompt (with a "Personalize" loaf button that opens placement) replaces the recommended card when it applies.

### Risk quiz

Four questions, one per screen with a progress bar, framed as "Let's see what fits," never as a test. **There are no right answers.** Skippable like placement: "Skip for now" on every screen, confirmation, answers already given are kept and the rest default to the most cautious choice.

1. When might you need this money? Within a year / 1 to 3 years / 3 to 5 years / more than 5 years.
2. If your investment dropped sharply in one month, what would you do? Sell everything / sell some / wait it out / add more.
3. What matters more to you? Not losing money / a balance / growth, even with big ups and downs.
4. Have you invested before? No / a little / yes.

The result is a pure function in `src/domain/risk.ts` with unit tests:

- **Under 3 years** (answer 1 is within a year or 1 to 3 years): suggest keeping it in savings and explain why (money needed soon shouldn't ride market swings). Offer "Grow your cushion".
- **Otherwise** a steadier approach (more bonds, Bonds loaf) or a growth-focused one (Index funds loaf), explained in plain language. Questions 2 and 3 set the comfort level; a 3-to-5-year horizon leans steadier. Question 4 only changes the wording (for example "start small while you learn").
- **Where:** a Roth IRA only when earned income is yes **and** the horizon is more than 5 years (explained as an account that holds the investments, meant for long-term money). For a 3-to-5-year horizon, or when earned income is no, a regular investment account. Unknown earned income never produces a Roth IRA suggestion.
- **Educational, never instructions.** "Here's what a steadier approach looks like and why." No percentages, allocations, fund names, or brand names. Not financial advice, same label as everywhere else.
- The result shows which loaf fits (Coming soon) and is saved to the profile (`profile.risk`: status, answers, result). Retaking placement never clears it.
- The 4-out-of-5 knowledge check still applies before any investing loaf starts, once that content exists.

## Dough! Plus (simulated, milestone 14, planned, not built)

- **Always free:** the emergency fund loaf and everything about it (saving, withdrawing, rebuilding, growing to 3 or 6 months), the placement quiz, the risk quiz and its result, and streak breads.
- **Plus:** the investing loaves (lessons, quizzes, loaves), a set of exclusive breads that streaks can't unlock, and bank linking once Plaid exists.
- **Where it appears:** after the emergency fund bakes, Plus options on "Choose your next loaf" show an "Included with Plus" label. Tapping one opens the Plus screen. Plus never interrupts saving or withdrawing. Until the Plus milestone, the investing loaves are plain "Coming soon" rows with no label.
- **Plus screen:** what's included and what stays free, "Start free trial" and "Maybe later" with equal visibility, and the price shown as a placeholder from content. No countdowns or pressure copy.
- **Demo:** no payments. "Start free trial" sets a premium flag in saved data. A demo tool behind `?demo=1` turns it off.
- **One gate.** Every premium check goes through one pure function (`src/domain/entitlements.ts`), so real billing can replace the flag later. No other code reads the flag.
- **Later, not now:** charging real money needs Vercel's paid plan and clear renewal and cancellation terms. A payment provider in test mode would be its own milestone.

## Streaks and bread unlocks (milestone 9)

- **Streak** = consecutive habit periods with a deposit. A period is the habit's period (week, or the paycheck period); for "it varies" it is a month (30 days). A period with no deposit yet only ends the streak once that period is over. Counted from deposits only: a withdrawal never breaks a streak. Logic is in `src/domain/streaks.ts`; `src/data/streaks.ts` works the streak out from `AppData` (`streakFromData`) and saves unlocks (`syncStreaks`, which Home runs on load and after a deposit).
- **Unlocks are permanent.** The current streak can reset, with no-guilt copy ("New streak starts now"). Never "lost," "broke," or "failed." A test checks `content/breads.json` for guilt words.
- **Ladder** (weeks of consistent saving, so weekly, paycheck and monthly savers climb it the same way): baguette 2, bagel 4, focaccia 6, pretzel 8, brioche 12, croissant 16. Weeks covered = streak periods x period days / 7, and a bread unlocks once the weeks covered reach its rung. A monthly saver therefore unlocks at the first whole month that covers it, never earlier. The ladder lives in `src/domain/breads.ts`.
- **Changing the habit:** a new amount never touches the streak. Changing how often the student is paid restarts the streak whenever it changes the period length (7, 14, 15 or 30 days), because the old windows no longer fit: the habit's `startedAt` moves to now. Frequencies that share a period length (weekly and every week; monthly and "it varies") keep it. Unlocks and the best streak always stay (`startFor` in `src/data/habit.ts`).
- Each topic keeps its bread as the default (see "Loaves"). Any unlocked bread can be chosen for the next loaf. A bread is a look, never a different loaf rule: goals, stages, and baking work the same.
- **Where a bread is chosen:** a bread picker step (`BreadPicker`, `BreadSheet`, copy in `content/breads.json` under `picker`) appears only when a bread beyond the default is unlocked: before "Grow my cushion" on ChooseLoaf and the risk result (both through `useGrowCushion`), and on "Your new loaf". With nothing unlocked there is no extra step. Locked breads are shown but not selectable, with the weeks left. The money layer checks it too: `startLoaf` and `setTarget(..., { grow: true, bread })` return `bread-locked` for a bread that is not the default or unlocked.
- **Bread on the records:** each loaf has a `bread` (the look it rises in now), and each bake stores the bread it was baked as, so a grown fund's shelf shows each bake in its own bread. Loaves and bakes saved before breads existed load as `sandwich`. Growing without choosing keeps the loaf's current bread.
- **Art:** all breads share the Mix and Shape dough ball (kept in `design/loaves/sandwich/`, the default bread's folder). Each bread has its own Proof, Bake, and Baked SVGs in `design/loaves/<bread>/`, and a test checks every bread and stage exists.
- Home shows the current streak and the next unlock, and a small unlock moment (dismissable, no confetti) when a new bread is earned. Dismissing it is stored (`seen`).
- **Demo tools** (behind `?demo=1`, on Home): "Skip a week" and "Skip a week without saving" (only the clock moves, so a missed week can be tried). Skipped deposits are saved with `source: 'seed'`. The code is in `src/money/demo.ts`.
- Streaks are personal. No sharing, no leaderboards, no comparing with friends.
- Unlocks and best streak (`AppData.streaks`: `unlocked` and `bestDays`) are stored (the current streak is worked out from the habit and deposit rows). They are stored in `user_state.streaks`.

## Money and data rules

- Store all money as **integer cents**. Format only at display time.
- Dates are ISO strings in UTC; display in the user's local time.
- **Every balance comes only from transaction rows** (`src/money/`). The data adapter stores and returns raw rows and never a balance.
- **Existing savings** are a transaction of type `starting` ("Savings you already had" in history), not a separate field. It must be a loaf's first row, and only one is allowed per loaf.
- **Amounts** are positive integer cents. Zero, negatives, and non-whole cents are rejected. Deposits and withdrawals over $10,000 in one entry are rejected with a friendly "check for a typo" message. `starting` allows up to $100,000: above $10,000 it returns `needsConfirmation` (nothing is written) so the UI can ask "Is that right?" and call again with `confirmed: true`.
- **Withdrawals** can't exceed the loaf's balance. The result carries `availableCents` and a friendly message, not an error.
- **Reaching the target:** a deposit that takes progress from under 100% to 100% or more returns `baked: true`. Extra money above the target stays in that loaf's balance (progress is clamped at 100%). The next loaf has its own rows and starts at zero. Lowering a target to or below the balance (`setTarget`) bakes the loaf the same way and returns `baked: true`. If the balance is only savings the student already had, it counts as baked at start instead (no completion date).
- **Rebuild mode:** withdrawing from a baked emergency fund (including one baked at start) brings the loaf back to Home as `rebuilding`, at the stage matching its balance, with "You used your fund for what it's for. Let's rebuild." Bakes are never removed, so the shelf keeps every earlier bake. When a rebuild reaches the target again, the result has `baked: true` and `rebuilt: true`. A fund that is growing (see "Grow your cushion") is not `rebuilding`.
- **Bakes and growing on the loaf record:** `bakes` (list of `{ targetCents, at }`, `at` null for "Already built") and `growFromCents` (null unless growing) are stored on the loaf, not derived, and old saved data is converted on load. Withdrawals clear `growFromCents`. Raising the target of a loaf that is only "Already built" (without `grow`) undoes that bake, because the student is still choosing a goal.
- **Demo clock** (`src/money/clock.ts`): `now()`, `advance(days)`, `reset()`. It is saved as part of the data so it survives a reload. Every transaction's date comes from it. Only this file reads the real time.
- **Accounts and the two stores (milestone 12):** "Continue as demo user" stays on the local adapter: no account, works without Supabase or a connection. Real accounts (email code or Google OAuth) use the Supabase adapter, which implements the same `DataAdapter` and passes the same contract tests. The two stores never mix: signing in does not import local demo data. `AuthProvider` (`src/app/`) decides which adapter `DataProvider` uses. Only the project URL and the publishable key (`sb_publishable_...`) are used by the app.
- **Ids:** new transaction and quiz-attempt ids are `crypto.randomUUID()`, so rows made on two devices never collide. Older ids like `tx-3` stay valid. Primary keys in Supabase are composite with `user_id`.
- **Offline and two devices (real accounts only):** if the connection drops, the loaf stays readable (the adapter keeps a read-only copy under `dough:cache:<user id>`, removed on sign out) and a banner says changes can't be saved. There is no offline syncing: a change made offline is not kept. The adapter never writes before it has read, so an empty screen from a failed load can't overwrite saved rows. Using two devices at the same time is "last save wins" for loaf and `user_state` rows. Transactions are insert-only with random ids, so deposits are never lost. Fine for the demo.
- **Local storage:** one versioned key, `dough:v1`. If saved data is missing, unreadable, or the wrong version, start fresh instead of crashing. Every read and write is wrapped in try/catch because some browsers block storage in private mode. If writes are blocked, the app keeps working from memory.
- **Tests** use an in-memory adapter that implements the same `DataAdapter` interface, so they never touch real browser storage.
- Supabase tables: `profiles` (`placementStatus`, essentials range and figure, existing savings range, `accounts`, `cardDebt`, `earnedIncome`, `monthsCovered`, and the risk quiz `risk` status, answers and result; any of these can be null when unknown), `loaves`, `transactions` (with a `type` of `starting`, `deposit`, or `withdrawal`, and a `source` of `manual`, `plaid`, or `seed`), `lesson_progress`, `quiz_attempts`, and `user_state` (one row per user: `habit`, `tips_seen`, `hysa_card`, `streaks`, and the demo clock offset). There is no `placement_results` table: placement results are derived from `profiles` (the starting point is recomputed from the answers). The schema is in `supabase/migrations/`, and a test checks that every table has Row Level Security and an own-rows policy.
- **Transaction source:** every row records where it came from: `manual` (the student typed it, the default), `plaid` (read from a linked sandbox account), or `seed` (demo seed data such as Maya's history). Source never changes how balances, stages, or baking work. Rows saved before `source` existed load as `manual`.
- Saving habit, opened tips and the high-yield reminder (`habit`, `tipsSeen`, `hysaCard` on `AppData`) are plans and flags, not money. They live in `src/data/` (`habit.ts`, `profile.ts`) and are stored in `user_state`. Old saved data without them loads with no habit, no seen tips and no reminder.
- Row Level Security is on for every table. Users can only read and write their own rows.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_...` key) in `.env.local`. The app uses only these two. Secret keys never go in the app, never get a `VITE_` prefix, and never go in git.

## Demo mode

- Turned on with `?demo=1` in the URL or `VITE_DEMO_MODE=true`. This turns on the demo tools only (the Demo pill, Skip a week, Reset demo).
- Shows a small "Demo" pill in the top corner.
- **Continue as demo user** is always on the login screen, with or without `?demo=1`, because the whole app is a demo. It is a slice button. Until Maya's seed exists (milestone 11) it signs in a plain demo user (`signInDemo` in `src/data/session.ts`) who starts the placement quiz. Once the seed exists it signs into a seeded account: Maya. Placement: checking and regular savings, no emergency savings at start, no retirement account. She did not test out. Lessons watched, quiz done, emergency fund loaf at 60% ($240 of $400), with about 6 weeks of past deposits so her history looks real. Earned income: yes. Credit card debt: no. Her target is under 3 months, so when her fund bakes ChooseLoaf puts the "Recommended" pill on Keep saving ("Grow your cushion to 3 months"); once the grown fund bakes, Start investing is the recommendation, and her risk result would point to a Roth IRA because she has earned income. Her 6 weeks of weekly deposits should also give her a 6-week streak once milestone 9 exists.
- **Start fresh demo** runs the full first-time flow from the placement quiz.
- **Skip a week** adds one simulated deposit of the user's habit amount and moves the demo clock forward 7 days.
- **Reset demo** restores the seed data.
- The demo clock lives in `src/money/clock.ts`. Domain code gets "now" from it, never from `Date.now()` directly.

## Design system

White background everywhere. Warm bakery palette. Friendly, never childish.

### Colors (`src/styles/tokens.css`)

| Token | Hex | Use |
|---|---|---|
| `--ground` | #FFFFFF | Screen background |
| `--crumb` | #FFF6E6 | Input fields, cards |
| `--butter` | #F6C453 | Highlights, celebrations, "new" badges |
| `--toast-edge` | #B9773A | Secondary button borders |
| `--crust` | #8A4B1F | Primary buttons, wordmark, links |
| `--deep-crust` | #5E3315 | Primary button base, pressed state |
| `--rye` | #2B1B12 | Body text |
| `--sage` | #5E7A4F | Growth, success, correct answers |
| `--text-muted` | #6B5446 | Secondary text |
| `--field-border` | #9C8467 | Input borders |
| `--divider` | #EADBC4 | Hairlines, progress track |
| `--placeholder` | #7A6552 | Input placeholder text |

Don't use red as a main color. It reads as loss or debt. For wrong quiz answers, use `--crust` text with an explanation, not red.

### Type

- Display: Fraunces with `font-variation-settings: 'SOFT' 100`, weight 700. Wordmark, screen titles, big numbers.
- Body: DM Sans, 400 to 700.
- Sentence case for all labels and buttons.

### Buttons

- **Loaf button** (main action, one per screen): background `--crust`, white text 18px bold, height 62px, `border-radius: 70px 70px 16px 16px / 38px 38px 16px 16px`, `border-bottom: 5px solid var(--deep-crust)`, three small slanted cream score marks near the top. Pressed: move down 3px and shrink the bottom border to 2px.
- **Slice button** (secondary, quiz answer choices): background `--crumb`, 3px `--toast-edge` border, `border-radius: 46px 46px 14px 14px / 32px 32px 14px 14px`.
- Third-party sign-in buttons must follow Google's branding rules (Apple sign-in is out of scope). Use Google's official assets. The Google button is not shown at all until the Supabase milestone wires it up: never show a button that does nothing.
- **Login screen** follows `docs/mockups/login.html` exactly (sizes, colors, button shapes): "Continue with email" loaf button, tagline "Stack that bread.", "Continue as demo user" slice button (`.slice-button--tall`), and the disclaimer at the bottom. Email sign-in is a 6-digit one-time code (Supabase), not a magic link. The email form and the Google button render only when Supabase is configured (never a button that does nothing); without it, only "Continue as demo user" and the disclaimer show.

### Illustrations

Use the SVGs in `design/loaves/<bread>/` (the sandwich loaf's folder is `sandwich`, not `emergency-fund`). The dough-ball Mix and Shape are shared by every bread, and each bread has its own Proof, Bake, and Baked. A baked loaf whose lessons are mastered gets a golden finish and sparkles on the celebration, shelf, and Home. Animate stage changes gently (scale and crossfade, under 400ms). Respect `prefers-reduced-motion`.

### Voice

Warm, encouraging, plain. Explain the why behind every nudge. No guilt, no shame, no jargon without explanation.

## PWA requirements

- Manifest: name "Dough!", short_name "Dough!", `display: standalone`, `start_url: "/"`, `background_color` and `theme_color` #FFFFFF, icons at 192 and 512 plus a maskable icon, and a 180px `apple-touch-icon`.
- Viewport: `width=device-width, initial-scale=1, viewport-fit=cover`. Pad screens with `env(safe-area-inset-*)`.
- Use `100dvh` for full-height screens, never `100vh`.
- `overscroll-behavior: none` on the body to avoid pull-to-refresh bounce. `touch-action: manipulation` on buttons.
- Videos use `playsinline` so they don't force full-screen on iPhone.
- The service worker caches the app shell, fonts, illustrations, lesson text, and quizzes. Videos are cached only after first play, so the install stays small.
- Nothing may depend on hover. Touch targets are at least 44×44px.
- On screens wider than 600px, center the app in a 390×844 phone frame on a `--crumb` backdrop, so it presents well on a laptop.

## Accessibility

- Real `<button>`, `<a>`, `<input>`, and `<label>` elements. Quiz choices are radio inputs styled as slice buttons.
- Every video has captions and a text summary.
- Text contrast at least 4.5:1. The tokens above already pass on white.
- Icon-only buttons get `aria-label`. Decorative SVGs get `aria-hidden="true"`.
- Progress bars expose `role="progressbar"` with `aria-valuenow`.

## Plaid Sandbox bank linking (stretch milestone, after Supabase)

Optional. Not started. Nothing in this section is built until the milestone begins.

- **Sandbox only.** Never use Plaid development or production keys.
- **Secrets stay on the server.** The Plaid client id, secret, and access tokens live only in Supabase server functions (Edge Functions secrets). Never in the browser, never in git, never in `VITE_` variables.
- **Read only.** The student picks one savings account as their emergency fund. Use balance data only. Never move money, never request payment or transfer products.
- **Linking creates the starting transaction** from the account's current balance (`source: 'plaid'`). Later balance changes become `deposit` or `withdrawal` rows (`source: 'plaid'`) written through `src/money/`, so the loaf logic doesn't change. The same amount rules, baked flag, and rebuild mode apply.
- **Check balances when the app opens**, not on a timer.
- **Manual logging stays.** "I moved money" is always available. Linking is optional.
- **UI states:** "New deposits can take a day to appear" and "Reconnect your bank."
- Still never store bank account numbers. Keep only what the server functions need to read the balance.

## Out of scope for the demo

Content for the Index funds, Bonds, Roth IRA, and Debt payoff loaves (cards only), real payments or billing, multiple active loaves, crews or any social features, real banking or investing (the Plaid Sandbox stretch milestone is the only exception, and it is read-only test data), local business rewards, school single sign-on, push notifications, Apple sign-in (needs a paid Apple developer account), and native app store builds.

## Deploying

- The app is hosted on Vercel. Pushes to `main` deploy to production automatically, and every other branch gets its own preview link.
- `vercel.json` rewrites page routes only to `index.html`, so refreshing or opening a link like `/placement` works. `react-router` handles routing in the browser. Paths under `assets/`, `videos/`, `icons/`, and any path ending in a file extension are not rewritten, so a missing video, image, or icon returns a real 404. (The video player still has an `onError` poster as a backup, because the dev and preview servers answer a missing file with the app's index page.)
- Environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_DEMO_MODE`) are set in the Vercel dashboard, never committed. Only `.env.example` (with empty values) is in git.

## How to work in this repo

- Read this file before starting. If a request conflicts with it, point out the conflict before writing code.
- The build plan is in `docs/plan.md`. Update it at the end of every milestone (mark done, note changes).
- For changes touching more than 3 files, propose a short plan first.
- Keep `src/domain/` pure and covered by tests. Run `npm run test` and `npm run build` before saying a task is done.
- Lesson, quiz, and loaf content lives in `content/`, never hardcoded in components.
- `docs/content-review.md` lists all learner-facing copy on one page. It is generated: after any change to `content/`, run `npx vitest run -u` to regenerate it. A test fails if it is stale.
- Never edit files with PowerShell Get-Content/Set-Content or other shell redirection. Use the Edit tool, so encoding stays UTF-8.
- Small, focused commits with clear messages.
- When a decision changes (stack, rules, flow, design), update this file in the same change.
