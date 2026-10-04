# Dough! build plan

Update this file at the end of every milestone: mark it done and note any changes. Rules and product details live in `CLAUDE.md`.

Each milestone ends with `npm run test`, `npm run build`, and `npm run lint` passing. Milestones that touch more than 3 files get a short sub-plan first.

## Status

| # | Milestone | Status |
|---|---|---|
| 1 | Scaffold and design system | Done |
| 2 | Domain core | Done |
| 3 | Money layer and local adapter | Done |
| 4 | Draft content and loader | Done |
| 5 | First-time flow | Done |
| 6 | Lessons and loaf quiz | Done (on branch `milestone-6-lessons-quiz`, pending preview check) |
| 7 | Saving setup and Home | To do |
| 8 | Loaf done and shelf | To do |
| 9 | Demo mode, Settings, and PWA | To do |
| 10 | Supabase | To do |
| 11 | Plaid Sandbox bank linking (stretch) | To do |

## Milestones

1. **Scaffold and design system** (done)
   - Vite, React, strict TypeScript, ESLint, Vitest, `react-router`, `react-markdown`.
   - `tokens.css`, `global.css`, self-hosted fonts, `100dvh`, safe-area padding, 390×844 phone frame.
   - Router shell. The `?demo=1` flag is remembered for the session.
   - LoafButton and SliceButton.
   - SVGs moved to `design/loaves/emergency-fund/`, `git init` run.
   - Note: `npm run test` uses `--passWithNoTests` until milestone 2 adds tests. Remove the flag then.
2. **Domain core (pure, tested)** (done)
   - Range bands as constants (essentials incl. open-ended and "Not sure"; existing savings).
   - `placement.ts`: the 5 situation answers (incl. multi-select accounts) → `monthsCovered`, starting point (loaf, target months, emergency fund counted as baked), account rules (open-HYSA step, `ef-where-to-keep` optional, investments note).
   - Target sizing (midpoint, round up to $50, `needsExactInput`, `isEstimate`) and existing-savings credit (lower bound or exact override).
   - `stages.ts`.
   - Habit suggestion (weekly or percent).
   - Quiz grading, including the test-out rule (4 of 5 or more skips videos, otherwise missed questions recommend their lessons).
   - ChooseLoaf recommendation rules: debt → Debt payoff; earned income and no retirement account → Roth IRA; otherwise Index funds. (Updated after the content review: card debt → Debt payoff; fund target under 3 months → Grow your cushion to 3 months; then Roth IRA; then Index funds. `recommendNext` takes `targetMonths` and returns `growTargetMonths`; `monthsForTarget` and `growthPercent` added.)
   - A small frontmatter parser.
   - Notes: `--passWithNoTests` removed. Habits suggest both weekly (target ÷ 12 weeks, up to $5, min $5) and 10% per paycheck. `monthsCovered` uses the target-sizing essentials figure. A baked-at-start fund shows "Already built" on the shelf with no completion month. The investment note applies to "investment account" only, not retirement accounts. Quiz gating uses `requiredPercentFor` (0 for emergency fund and Debt payoff, 80 for investing loaves).
3. **Money layer and local adapter**
   - `src/money/`: deposits, withdrawals, balance derived from raw rows, and the demo clock.
   - `DataAdapter` interface in `src/data/` plus a `localStorage` implementation that only stores and returns raw rows.
   - Email-only fake sign-in, labeled local-only in the code and UI, replaced in milestone 10.
   - Notes (done): `DataAdapter` is async (`load`/`save`, never throw) so the Supabase adapter fits later. Adapters: `localAdapter` (`dough:v1`, takes a `StorageLike` so tests use a fake), `memoryAdapter`. `src/money/` has `clock`, `amounts`, `ledger`, `messages`, `format`. Money functions return `{ ok: true, ... } | { ok: false, code, message }` and never throw. `deposit` returns `baked` and `rebuilt`; `withdraw` returns the rebuild message; `addStarting` returns `needsConfirmation` over $10,000 (cap $100,000). Rebuild mode is derived from `firstBakedAt`/`bakedAtStart` plus balance, not stored. The local sign-in UI is milestone 5; only `src/data/session.ts` exists so far.
   - Content-review follow-up (done): loaves store `bakes` (target and date, or "Already built") and `growFromCents` instead of `firstBakedAt` and `bakedAtStart`; `LoafStatus` still exposes both as derived fields and adds `growing`, `growFromCents`, `bakes`. `setTarget(adapter, loaf, cents, { grow: true })` is the explicit "Grow your cushion" action (errors `grow-not-ready`, `grow-not-bigger`); plain `setTarget` only edits the goal. Results gain `grown`. While growing, `percent` and `stage` count the new part only. Old saved data is converted on load. Shelf labels like "1 month" come from `monthsForTarget` with the student's essentials, which are stored from milestone 5 on.
   - Milestone 9 seed: Maya's 6 weeks of past deposits need explicit dates, so add a seed-only function inside `src/money/` that takes dates. Normal deposit and withdraw never accept a date.
4. **Draft content and loader** (done)
   - `placement.json` (5 situation questions; the essentials question explains what to count, see CLAUDE.md).
   - `loaves/emergency-fund.json`, including the 4 rising tips.
   - 3 lesson `.md` files with video metadata and `.vtt` captions. No video files.
   - `quizzes/emergency-fund.json` (5 questions with lesson and timestamp links).
   - Coming-soon definitions for the other 4 loaves (Index funds, Bonds, Roth IRA, Debt payoff).
   - Everything is marked `"draft": true`, with a visible "Draft content" note for review.
   - A typed content loader using `import.meta.glob`.
   - Notes (done): loader lives in `src/content/` (`loader.ts`, `guards.ts`, `types.ts`, `review.ts`). It throws a `ContentError` at load time on malformed content. Each loaf is its own `content/loaves/<loaf>.json` with `status: built | coming-soon`. Lesson ids come from the loaf's `lessons` list; lesson video and caption URLs are built from frontmatter filenames (`/videos/<loaf>/...`). Captions (`.vtt`) are in `public/videos/emergency-fund/`; there are no MP4s. `DraftNote` component shows "Draft content, pending review". Tests check that `draft` is a boolean (not that it is true), band/account ids match the domain, quiz links land inside lessons, and the financial copy rules (no figures or rates, no brand names, FDIC and NCUA, summary length). `docs/content-review.md` is generated by a file-snapshot test: `npm run test -- -u` regenerates it, and the test fails when it is stale. No config changes were needed.
5. **First-time flow: Login → Placement → Result → NewLoaf**
   - Login with the disclaimer.
   - PlacementQuiz: one question per screen with a progress bar, framed as "Let's get to know your money".
   - Placement is optional (done in the domain, data, and content; this milestone builds the screens): "Skip for now" on every screen with the confirmation ("Skip" / "Keep answering"). Answers already given are kept, defaults fill the rest. Save with `savePlacement` (`src/data/profile.ts`), which stores `placementStatus` (`complete`, `partial`, `skipped`) on the profile. Result screen uses `resultSkipped` copy when skipped. Fill `{goal}` from `DEFAULT_GOAL_CENTS` with `fillTemplate` and `formatCents`.
   - PlacementResult, titled "Here's where you'll start": first loaf, goal in dollars and months, head start.
   - NewLoaf: editable target (1, 3, or 6 months), count-existing-savings choice with optional exact amount, note that the $1,000 starter goal is a default for "Not sure" or skipped essentials (`isDefault`), not an estimate of their essentials.
   - Branch for students whose emergency fund starts baked: optional "Understand what you've built" review, then ChooseLoaf.
   - Placement Q3 (accounts, multi-select): "None of these" and "Not sure" each clear the other choices when picked. Picking a real account clears them too.
   - Store the student's essentials figure on the profile (cents). The shelf and ChooseLoaf need it to turn a bake's target into months.
   - Notes (done): `DataProvider` (`src/app/`) loads app data once and exposes `adapter`, `data`, and `refresh()`; tests pass an in-memory adapter. The route guard is a pure function, `guardRedirect` in `src/app/guard.ts`: no user → `/login`, no profile → `/placement`, no loaf → `/placement/result`, otherwise Home; a fund that starts baked goes on to `/choose-loaf` (a placeholder until milestone 8). The guard makes that decision from state, so it doesn't depend on the timing of `refresh()` and `navigate()`. Routes: `/login`, `/placement`, `/placement/result`, `/new-loaf`, `/built-review`, `/choose-loaf`, `/`. Login follows `docs/mockups/login.html`. Google sign-in is not rendered at all until milestone 10 wires it up. "Continue as demo user" is always shown and signs in a plain demo user (`signInDemo`) until Maya's seed exists in milestone 9. `LoafButton`'s score marks and padding now match the mockup everywhere; `.slice-button--tall` is the login-only taller slice. New: `ChoiceGroup` (radios or checkboxes styled as slice buttons, reused by the quiz in milestone 6) and `ProgressBar`. New pure code: `src/domain/placementInput.ts` (`toggleAccount`, `answersFromSelections`, `bakedStartTargetCents`), `src/money/parse.ts` (dollars to cents), and `src/money/newLoaf.ts` (`createFirstLoaf` checks everything first, so an unconfirmed over-$10,000 entry writes nothing). Screen copy for the result and new-loaf screens is in `content/placement.json` (`result` and `newLoaf`, covered by `docs/content-review.md`). A fund that starts baked is recorded with its target at the biggest of 1 or 3 months the savings cover (the starter goal when essentials are unknown), as an "Already built" bake. Typed exact essentials or savings are kept on the profile. Screen tests (`@testing-library/react`, `user-event`, `jsdom`) cover the guard, skip with answers kept, Q3's clearing rules, and the over-$10,000 confirmation. Follow-up: existing savings now count by default for everyone (`countSavingsByDefault` is true whenever the fund isn't baked and any savings were reported, whatever the months covered), and the student can uncheck the box. The content-review snapshot is regenerated with `npx vitest run -u` (`npm run test -- -u` doesn't work in PowerShell). Not checked in a real browser yet: the screens are covered by tests only.
6. **Lessons and loaf quiz**
   - VideoPlayer: `playsinline`, captions, "watched" at 90% or via "Mark as watched".
   - "Video coming soon" poster when the video file is missing.
   - Lesson screen with the `react-markdown` summary and LessonRow.
   - QuizQuestion (radio inputs styled as slice buttons).
   - LoafQuiz: score, explanation for every wrong answer, retries, links back to lesson and timestamp.
   - "Already know this? Take the quiz first" test-out: 4 of 5 or more makes videos optional ("You know this. Let's make it happen.") and goes to Saving setup. Fewer recommends the lessons for missed questions, then a retake with explanations. Normal path unchanged.
   - `ef-where-to-keep` is optional ("You're already doing this") for students with high-yield savings.
   - Mastery and shuffling (done, follow-up on the same branch): `src/domain/mastery.ts` (`bestScore`, `isMastered`, `isMasteryScore`, `MASTERY_PERCENT` = 80) and `src/domain/shuffle.ts` (`shuffle`, `shuffleQuiz`), both pure with tests. Questions and choices are shuffled on every attempt in both modes; choices have fixed string ids in `content/quizzes/emergency-fund.json` (for example `car-repair`, `insured`) and `answer` is a choice id, so saved `answers` (question id to choice id), grading, `missedLessons`, and the rewatch links never depend on order or wording. The loader rejects duplicate choice ids and unknown answer ids, and a content test checks both. Attempts saved with index ids by the first version are dropped on load (demo data). Best normal-quiz score is computed from `quizAttempts` (nothing stored); test-out attempts never count. 4 out of 5 shows a "Mastered" badge on the lessons list and "You mastered this loaf's lessons." on the end screen; below 4 the end screen keeps the explanations and adds the "Get 4 out of 5" line. No pass requirement and no cooldown for the emergency fund quiz. Copy is under `flow` in `content/loaves/emergency-fund.json` and in `docs/content-review.md`.
   - Later (not built now): the Home milestone should show mastery on the loaf itself, for example a golden finish on the crust. Investing loaves keep the 4-out-of-5 pass requirement before starting, with no cooldown.
   - Notes (done): new `src/domain/lessons.ts` (`lessonPlan`, `nextLessonId`, `savingUnlocked`, `reachedWatchThreshold`) with tests. `AppData` gains `lessonProgress` and `quizAttempts` (old saved data loads with empty lists; `src/data/progress.ts` has `markLessonWatched` and `recordQuizAttempt`, dates from the demo clock). Screens: `/lessons` (Lessons), `/lessons/:lessonId?t=` (Lesson), `/quiz` and `/quiz?mode=test-out` (LoafQuiz), and a `/saving-setup` placeholder until milestone 7. Components: `VideoPlayer` (`playsInline`, captions, 90% or ended, `onError` poster), `LessonRow` (collapsed rows are native `<details>`), `QuizQuestion`; `ChoiceGroup` gained `disabled`, `status` and `statusText` (defaults unchanged). Screen copy is in `content/loaves/emergency-fund.json` under `flow` and appears in `docs/content-review.md`. Changes from the plan: the normal quiz uses a "Check answer" button (choices stay changeable until then); the test-out quiz has no feedback at all and its end screen shows only the score and lessons to review; `vercel.json` rewrites page routes only, so missing files 404 (tested in `src/vercelConfig.test.ts`). Guard: a new loaf is held on `/lessons` until a normal quiz or passing test-out; a failed test-out doesn't unlock Saving setup. "Rewatch this part" vs "Read the summary" depends on a HEAD probe for a real `video/*` reply. Not checked in a real browser or on the Vercel preview yet: covered by tests only.
7. **Saving setup and Home**
   - SavingSetup: habit and the high-yield savings suggestion, plus an open-a-high-yield-account step for students with no savings account.
   - Home: LoafIllustration with stage animation, ProgressBar (`role="progressbar"`), and the separate emergency-fund total.
   - "$15 this week, not logged yet" habit line (in-app only).
   - "I moved money to savings" deposit.
   - Withdrawal with the supportive message and shrinking loaf.
   - Stage-unlocked tips.
8. **Loaf done and shelf**
   - LoafComplete celebration. When `baked: true` comes with `rebuilt: true` (a rebuild, not the first bake), use different copy: "You rebuilt your fund". The shelf keeps every bake: a grown fund shows "1 month" and "3 months". When `grown: true` (a fund reaching its grown target), use "Your cushion is at 3 months" copy.
   - Shelf with completion months and outlines.
   - When `recommendNext` returns `needsPersonalization`, ChooseLoaf shows `personalizePrompt` (opens placement) instead of a recommendation, and every loaf stays choosable. "Grow your cushion" with `growNeedsEssentials` first asks `growOption.askEssentials`, then calls `changeGoal` with `growGoal(...)`.
   - ChooseLoaf with Coming-soon cards (including Debt payoff), the debt note, and the "Grow your cushion to 3 months" option (content in `emergency-fund.json` `growOption`; it calls `setTarget` with `grow: true`).
   - Home while growing: dough-ball start, progress on the new part, and the full fund total shown separately ("$400 of $1,200").
9. **Demo mode, Settings, and PWA**
   - Demo pill, Maya seed, Start fresh, Skip a week, and Reset.
   - Settings with the disclaimer.
   - Settings, "Retake the quiz": `questionsToAsk(hasTransactions)` drops the existing-savings question when the loaf has transactions; prefill with `answersFromProfile`; save with `retakePlacement`, which updates the profile only and returns `suggestedTargetCents` for "Update your goal to {amount}?" (never applied silently).
   - Settings, "Change your goal": 1, 3, or 6 months, or a typed amount, through `changeGoal` in `src/money/`.
   - `vite-plugin-pwa`: manifest, icons, and caching (videos cached after first play).
   - Verify offline via `npm run preview`.
   - Accessibility and contrast pass.
10. **Supabase**
    - Schema for `profiles`, `placement_results`, `loaves`, `transactions`, `lesson_progress`, and `quiz_attempts`, with RLS on every table.
    - Supabase adapter behind the same `DataAdapter` interface, plus email and Google auth.
    - Remove the fake local sign-in. Wire up the Google button (official asset) and show it only then, when Supabase is configured. Until now it is not rendered.
    - Add `.env.example` values and update CLAUDE.md.
    - The `transactions` table includes the `source` column (`manual`, `plaid`, `seed`).
11. **Plaid Sandbox bank linking (stretch, after Supabase)**
    - Sandbox only. Never development or production keys.
    - Plaid secret and access tokens live only in Supabase server functions, never in the browser or git. Ask before adding the Plaid Link dependency.
    - Read only: the student picks one savings account as their emergency fund. Balance data only. Never move money.
    - Linking creates the loaf's `starting` transaction from the current balance. Later balance changes become `deposit` or `withdrawal` rows through `src/money/` (`source: 'plaid'`), so loaf logic doesn't change.
    - Check balances when the app opens, not on a timer.
    - Manual "I moved money" logging stays. Linking is optional.
    - UI states: "New deposits can take a day to appear" and "Reconnect your bank."
    - Sub-plan first (it touches many files). Update CLAUDE.md as decisions firm up.

## Decisions

- **Ranges to numbers.** Bands are listed in CLAUDE.md. Target uses the midpoint of the chosen essentials range, rounded up to the nearest $50. "$1,500 and up" uses its lower bound with `needsExactInput`. Essentials "Not sure" (or skipped) are unknown, never guessed: the loaf starts at a $1,000 starter goal (`DEFAULT_GOAL_CENTS`) flagged `isDefault`, existing savings count toward it, and `monthsCovered` is not computed. The target is always editable on "Your new loaf". Existing savings use the band's lower bound, so the loaf never shows more progress than the student has, unless the student types an exact amount.
- **No levels, no knowledge questions in placement.** Placement covers situation only: essentials, savings, accounts, card debt, earned income. It sets the starting point and `monthsCovered` (internal, never shown). Knowledge is checked inside each loaf via the test-out quiz. The 80% check before investing loaves applies to everyone.
- **Maya's placement.** Checking and regular savings, no emergency savings at start, earned income yes, no card debt, did not test out.
- **Placeholder videos.** No fake video files. A missing video shows a "Video coming soon" poster, the lesson summary, and "Mark as watched". Real videos are added later by filename.
- **Maya's seed.** Home baker, lessons watched, quiz done, emergency fund loaf at $240 of $400, about 6 weeks of past deposits, earned income yes, credit card debt no. Her target is under 3 months, so ChooseLoaf recommends growing the cushion first, then Roth IRA.
- **Adapter and balances.** The data adapter only stores and returns raw transaction rows. `src/money/` derives every balance.
- **Dependencies.** `react-router` and `react-markdown` are approved. Frontmatter uses an in-house parser.
- **Content scope.** Full content only for the emergency fund loaf, all marked as draft. Other loaves are "Coming soon" cards.
- **Habit nudge.** In-app only, no notifications.
- **Plaid (stretch).** The "no real bank connections" rule now allows Plaid in Sandbox mode only, in milestone 11. It is read-only and creates ordinary transaction rows. Until then, no Plaid code, packages, or keys.
- **Transaction source.** Every transaction has a `source` (`manual`, `plaid`, `seed`), default `manual`. Added in milestone 3's follow-up. Old saved rows without it load as `manual`. Milestone 9's Maya seed uses `seed`.
- **Optional placement.** Every placement answer is optional (undefined means unknown). `placementStatus` is `complete`, `partial` or `skipped`, stored on the profile (`profile` on `AppData`, null until placement is answered or skipped). Unknown card debt, earned income or accounts never lead to a Roth IRA recommendation or skip the debt check: ChooseLoaf shows a personalization prompt instead. Grow your cushion still works.
- **Local auth.** Email-only fake sign-in, clearly local-only, replaced in milestone 10.
