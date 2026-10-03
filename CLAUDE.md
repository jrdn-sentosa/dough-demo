# Dough! tech demo

Dough! is a mobile-first web app that teaches college students money basics and helps them act on what they learn. Each loaf is one money topic with one savings goal. The student watches short video lessons, takes a quiz, then moves money toward the goal, and the loaf rises as they save. When the target is reached, the loaf is done and they choose a new one.

This repository is a **tech demo only**. It runs as a progressive web app (PWA) that looks and feels like a native phone app. Only the first loaf, the emergency fund, is fully built.

## Non-negotiable rules

- **No real money.** Never integrate bank, payment, brokerage, or account-linking APIs (Plaid, Stripe, etc.). All deposits and withdrawals are simulated.
- **No real financial details.** Never ask for or store bank account numbers, card numbers, SSNs, or income documents. Placement answers use ranges, not exact figures, where possible.
- **All simulated money lives in `src/money/`.** No other folder creates, edits, or calculates balances directly. This keeps the fake layer replaceable.
- **No secrets in git.** Keys go in `.env.local`, which is in `.gitignore`. Only `.env.example` (with empty values) is committed.
- **Label it.** The app shows "Educational demo. Not financial advice. No real money moves." on the sign-up screen and in Settings.
- **No group or social features.** No crews, friends, leaderboards, or sharing balances.

## Stack

- React + TypeScript (strict mode) + Vite
- `vite-plugin-pwa` for the manifest and service worker
- Supabase for auth (email and Google) and the database
- Plain CSS with CSS variables for design tokens (no UI kit)
- Fonts self-hosted with `@fontsource-variable/fraunces` and `@fontsource-variable/dm-sans` so the app works offline
- Native HTML `<video>` with WebVTT captions for lessons
- `react-router` for routing (so the phone's back button and deep links like `?demo=1` work)
- `react-markdown` for lesson summaries. Frontmatter is parsed by a small in-house function, not gray-matter.
- Vitest for unit tests

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
                Shelf, Settings
  components/   LoafButton, SliceButton, LoafIllustration, ProgressBar,
                VideoPlayer, QuizQuestion, LessonRow
  domain/       pure logic: placement scoring, targets, stages,
                recommendations, quiz grading (no React, no Supabase)
  money/        simulated deposits and withdrawals, demo clock
  data/         the only code that talks to Supabase
  styles/       tokens.css, global.css
content/
  placement.json            placement quiz questions and scoring
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
  → Placement quiz (about 2 minutes)
  → Placement result: level + "Your new loaf" (emergency fund)
  → Video lessons for this loaf
  → Loaf quiz
  → Saving setup: pick a habit, encourage moving money into savings
  → Home: loaf rises as money is added over time
  → Target reached: loaf done, added to the bread shelf
  → Choose a new loaf
```

First-time users go through every step in order. Returning users land on Home.

## Placement quiz

Purpose: set the student's level, size their first goal, and decide which loaf to recommend next. Frame it as "Let's get to know your money," not a test. One question per screen with a progress bar.

- **5 knowledge questions** (multiple choice): what an emergency fund is for, interest on savings, what an index fund is, stocks vs bonds risk, what a Roth IRA is.
- **4 situation questions** (ranges or yes/no): monthly essential costs, money already set aside for emergencies, earned income from a job (yes/no), carrying credit card debt month to month (yes/no).

Levels from the knowledge score:

| Score | Level | Effect |
|---|---|---|
| 0–2 | Apprentice | All lessons shown normally |
| 3–4 | Home baker | Lessons tagged "Refresher" but still shown |
| 5 | Head baker | May skip the emergency fund videos and go straight to the loaf quiz |

Scoring and recommendations live in `src/domain/placement.ts` with unit tests.

## Loaves

Each loaf is a topic, a goal, a bread type, a set of video lessons, a quiz, and short tips that appear while it rises.

| Loaf | Bread | Why that bread | Demo status |
|---|---|---|---|
| Emergency fund | Sandwich loaf | The everyday staple you always keep on hand | **Fully built, required first** |
| Index funds | Braided loaf | Many strands woven into one: diversification | Coming soon |
| Bonds | Rye loaf | Dense and steady, rises slowly | Coming soon |
| Roth IRA | Sourdough | Long, slow growth over decades | Coming soon |

The emergency fund loaf is always the first loaf. In the demo, ChooseLoaf shows the other three as "Coming soon" cards, with at most one tagged "Recommended."

### Emergency fund loaf

- **Target:** defaults to 1 month of essential costs from the placement quiz, rounded up to the nearest $50. The student can raise it to 3 or 6 months.
- **Existing savings:** if the student already has money set aside, ask whether to count it. If yes, the loaf starts at the matching stage. If it already meets the target, suggest a bigger target instead of finishing instantly.
- **Video lessons (3, each under 2 minutes):**
  1. What an emergency fund is for
  2. How much you need
  3. Where to keep it: high-yield savings
- **Loaf quiz:** 5 questions on those videos.
- **While it rises (short text tips, unlocked by stage):** Shape "Why small deposits add up", Proof "Make it automatic", Bake "When it's the right time to use it", Baked "Choosing your next loaf".

## Lessons and quizzes

- Lessons are videos with captions (WebVTT) and a short text summary below. Track "watched" when the student reaches 90% of the video or taps "Mark as watched."
- Each loaf quiz question has 3–4 choices, one correct answer, an explanation, and a link back to the lesson and timestamp that covers it.
- Quiz format in `content/quizzes/<loaf>.json`:

```
{
  "id": "ef-q1",
  "question": "What is an emergency fund for?",
  "choices": ["A spring break trip", "A surprise car repair", "New textbooks"],
  "answer": 1,
  "explain": "It's for urgent costs you couldn't plan for.",
  "lesson": "ef-what-its-for",
  "timestamp": 34
}
```

- **Emergency fund quiz:** completing it unlocks Saving setup. It does not require a passing score, because the real goal is getting the student to save. Show the score, explain every wrong answer, and allow retries.
- **Investment loaves (future):** require 80% to start, since understanding risk protects new investors.

## Saving and rising

- **Saving setup:** the student picks a habit, either a fixed weekly amount or a percent of each paycheck for irregular income, and sees the suggested account type (high-yield savings). In the demo there is no real account.
- **Adding money:** "I moved money to savings" logs a simulated deposit.
- **Progress** = money added to this loaf ÷ this loaf's target.

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

- Emergency withdrawals are always allowed, instantly.
- The loaf shrinks to the stage that matches the new balance.
- The message is supportive, never guilt: "You used your fund for what it's for. Let's rebuild." Never use words like "failed," "lost," or "broke your streak."

## Loaf done and choosing the next loaf

- Celebration screen, then the loaf goes to the bread shelf with its completion month.
- ChooseLoaf recommends one next loaf using placement answers:
  - Carries credit card debt: show a note that paying off high-interest debt usually comes before investing. Recommend nothing else.
  - Has earned income: recommend Roth IRA. (A Roth IRA requires earned income, so never recommend it without.)
  - Otherwise: recommend Index funds.
- **Multiple loaves (future, not in demo):** after the emergency fund loaf is done, allow up to 2 active loaves. Each deposit is assigned to one loaf when logged.

## Money and data rules

- Store all money as **integer cents**. Format only at display time.
- Dates are ISO strings in UTC; display in the user's local time.
- Supabase tables: `profiles` (level, essentials range, earned income, credit card debt), `placement_results`, `loaves`, `transactions`, `lesson_progress`, `quiz_attempts`.
- Row Level Security is on for every table. Users can only read and write their own rows.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`.

## Demo mode

- Turned on with `?demo=1` in the URL or `VITE_DEMO_MODE=true`.
- Shows a small "Demo" pill in the top corner.
- **Continue as demo user** on the login screen signs into a seeded account: Maya, Home baker level, lessons watched, quiz done, emergency fund loaf at 60% ($240 of $400).
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

Don't use red as a main color. It reads as loss or debt. For wrong quiz answers, use `--crust` text with an explanation, not red.

### Type

- Display: Fraunces with `font-variation-settings: 'SOFT' 100`, weight 700. Wordmark, screen titles, big numbers.
- Body: DM Sans, 400 to 700.
- Sentence case for all labels and buttons.

### Buttons

- **Loaf button** (main action, one per screen): background `--crust`, white text 18px bold, height 62px, `border-radius: 70px 70px 16px 16px / 38px 38px 16px 16px`, `border-bottom: 5px solid var(--deep-crust)`, three small slanted cream score marks near the top. Pressed: move down 3px and shrink the bottom border to 2px.
- **Slice button** (secondary, quiz answer choices): background `--crumb`, 3px `--toast-edge` border, `border-radius: 46px 46px 14px 14px / 32px 32px 14px 14px`.
- Third-party sign-in buttons must follow Apple's and Google's branding rules. Use their official assets.

### Illustrations

Use the SVGs in `design/loaves/`. Each bread type gets its own five stages. Animate stage changes gently (scale and crossfade, under 400ms). Respect `prefers-reduced-motion`.

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

## Out of scope for the demo

Content for the Index funds, Bonds, and Roth IRA loaves (cards only), multiple active loaves, crews or any social features, real banking or investing, local business rewards, school single sign-on, push notifications, Apple sign-in (needs a paid Apple developer account), and native app store builds.

## How to work in this repo

- Read this file before starting. If a request conflicts with it, point out the conflict before writing code.
- For changes touching more than 3 files, propose a short plan first.
- Keep `src/domain/` pure and covered by tests. Run `npm run test` and `npm run build` before saying a task is done.
- Lesson, quiz, and loaf content lives in `content/`, never hardcoded in components.
- Small, focused commits with clear messages.
- When a decision changes (stack, rules, flow, design), update this file in the same change.
