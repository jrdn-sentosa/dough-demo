# Dough! build plan

Update this file at the end of every milestone: mark it done and note any changes. Rules and product details live in `CLAUDE.md`.

Each milestone ends with `npm run test`, `npm run build`, and `npm run lint` passing. Milestones that touch more than 3 files get a short sub-plan first.

## Status

| # | Milestone | Status |
|---|---|---|
| 1 | Scaffold and design system | Done |
| 2 | Domain core | To do |
| 3 | Money layer and local adapter | To do |
| 4 | Draft content and loader | To do |
| 5 | First-time flow | To do |
| 6 | Lessons and loaf quiz | To do |
| 7 | Saving setup and Home | To do |
| 8 | Loaf done and shelf | To do |
| 9 | Demo mode, Settings, and PWA | To do |
| 10 | Supabase | To do |

## Milestones

1. **Scaffold and design system** (done)
   - Vite, React, strict TypeScript, ESLint, Vitest, `react-router`, `react-markdown`.
   - `tokens.css`, `global.css`, self-hosted fonts, `100dvh`, safe-area padding, 390×844 phone frame.
   - Router shell. The `?demo=1` flag is remembered for the session.
   - LoafButton and SliceButton.
   - SVGs moved to `design/loaves/emergency-fund/`, `git init` run.
   - Note: `npm run test` uses `--passWithNoTests` until milestone 2 adds tests. Remove the flag then.
2. **Domain core (pure, tested)**
   - `placement.ts`: scoring and levels.
   - Target sizing from the essentials range (see decisions below).
   - Existing-savings range → starting stage.
   - `stages.ts`.
   - Habit suggestion (weekly or percent).
   - Quiz grading.
   - ChooseLoaf recommendation rules, including the debt case.
   - A small frontmatter parser.
3. **Money layer and local adapter**
   - `src/money/`: deposits, withdrawals, balance derived from raw rows, and the demo clock.
   - `DataAdapter` interface in `src/data/` plus a `localStorage` implementation that only stores and returns raw rows.
   - Email-only fake sign-in, labeled local-only in the code and UI, replaced in milestone 10.
4. **Draft content and loader**
   - `placement.json` (9 questions).
   - `loaves/emergency-fund.json`, including the 4 rising tips.
   - 3 lesson `.md` files with video metadata and `.vtt` captions. No video files.
   - `quizzes/emergency-fund.json` (5 questions with lesson and timestamp links).
   - Coming-soon definitions for the other 3 loaves.
   - Everything is marked `"draft": true`, with a visible "Draft content" note for review.
   - A typed content loader using `import.meta.glob`.
5. **First-time flow: Login → Placement → Result → NewLoaf**
   - Login with the disclaimer.
   - PlacementQuiz: one question per screen with a progress bar, framed as "Let's get to know your money".
   - PlacementResult.
   - NewLoaf: editable target (1, 3, or 6 months) and the count-existing-savings choice.
6. **Lessons and loaf quiz**
   - VideoPlayer: `playsinline`, captions, "watched" at 90% or via "Mark as watched".
   - "Video coming soon" poster when the video file is missing.
   - Lesson screen with the `react-markdown` summary and LessonRow.
   - QuizQuestion (radio inputs styled as slice buttons).
   - LoafQuiz: score, explanation for every wrong answer, retries, links back to lesson and timestamp.
   - "Refresher" tags for Home bakers. Head baker skip.
7. **Saving setup and Home**
   - SavingSetup: habit and the high-yield savings suggestion.
   - Home: LoafIllustration with stage animation, ProgressBar (`role="progressbar"`), and the separate emergency-fund total.
   - "$15 this week, not logged yet" habit line (in-app only).
   - "I moved money to savings" deposit.
   - Withdrawal with the supportive message and shrinking loaf.
   - Stage-unlocked tips.
8. **Loaf done and shelf**
   - LoafComplete celebration.
   - Shelf with completion months and outlines.
   - ChooseLoaf with Coming-soon cards and the debt note.
9. **Demo mode, Settings, and PWA**
   - Demo pill, Maya seed, Start fresh, Skip a week, and Reset.
   - Settings with the disclaimer.
   - `vite-plugin-pwa`: manifest, icons, and caching (videos cached after first play).
   - Verify offline via `npm run preview`.
   - Accessibility and contrast pass.
10. **Supabase**
    - Schema for `profiles`, `placement_results`, `loaves`, `transactions`, `lesson_progress`, and `quiz_attempts`, with RLS on every table.
    - Supabase adapter behind the same `DataAdapter` interface, plus email and Google auth.
    - Remove the fake local sign-in.
    - Add `.env.example` values and update CLAUDE.md.

## Decisions

- **Ranges to numbers.** Target uses the midpoint of the chosen essentials range, rounded up to the nearest $50. For the open-ended top range, use its lower bound and ask for an exact number. The target is always editable on "Your new loaf". Existing savings use the range's lower bound, so the loaf never shows more progress than the student has.
- **Placeholder videos.** No fake video files. A missing video shows a "Video coming soon" poster, the lesson summary, and "Mark as watched". Real videos are added later by filename.
- **Maya's seed.** Home baker, lessons watched, quiz done, emergency fund loaf at $240 of $400, about 6 weeks of past deposits, earned income yes, credit card debt no (so ChooseLoaf recommends Roth IRA).
- **Adapter and balances.** The data adapter only stores and returns raw transaction rows. `src/money/` derives every balance.
- **Dependencies.** `react-router` and `react-markdown` are approved. Frontmatter uses an in-house parser.
- **Content scope.** Full content only for the emergency fund loaf, all marked as draft. Other loaves are "Coming soon" cards.
- **Habit nudge.** In-app only, no notifications.
- **Local auth.** Email-only fake sign-in, clearly local-only, replaced in milestone 10.
