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
  → Placement result: "Here's where you'll start" (first loaf, goal, head start)
  → Video lessons for this loaf (or "Already know this? Take the quiz first")
  → Loaf quiz
  → Saving setup: pick a habit, encourage moving money into savings
  → Home: loaf rises as money is added over time
  → Target reached: loaf done, added to the bread shelf
  → Choose a new loaf
```

First-time users go through every step in order. Returning users land on Home.

## Placement quiz

Purpose: work out where the student starts: which loaf first, how big the goal is, how much of it they already have, and which setup steps apply. **Placement is about the student's situation, not their knowledge, and assigns no level or label anywhere.** Knowledge is checked inside each loaf (see Lessons and quizzes). Frame placement as "Let's get to know your money," not a test. One question per screen with a progress bar.

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
| Not sure | starter target of $500, `isEstimate: true` (the result screen says it's an estimate they can change) |

Target = midpoint rounded up to the nearest $50.

| Existing emergency savings | Credited at |
|---|---|
| None | $0 |
| $1–$99 | $1 |
| $100–$249 | $100 |
| $250–$499 | $250 |
| $500–$999 | $500 |
| $1,000 and up | $1,000 |

When the student chooses to count existing savings, offer an optional exact amount, prefilled with the band's lower bound. If they enter one, use it instead.

### Starting point

`monthsCovered` = existing savings ÷ monthly essentials. It is internal only, never shown as a label, and stored on the profile.

| Situation | Start |
|---|---|
| Under 1 month | Emergency fund loaf, target 1 month |
| 1 to under 3 months, no card debt | Emergency fund loaf, target 3 months, existing savings counted so it starts partly risen |
| 1 to under 3 months, card debt | Emergency fund counts as baked and goes on the shelf. Recommend Debt payoff next |
| 3+ months | Emergency fund counts as baked and goes on the shelf. ChooseLoaf: card debt → Debt payoff; earned income and no retirement account → Roth IRA; otherwise Index funds |

### Account rules

- **No savings account of any kind** (no regular or high-yield savings): Saving setup includes a step about opening a high-yield savings account.
- **Has high-yield savings:** skip that step, and lesson `ef-where-to-keep` is optional, tagged "You're already doing this."
- **Has investments but under 3 months covered:** still starts with the emergency fund loaf, with a note that a cushion means never having to sell investments at a loss in an emergency.

### Placement result screen

Titled "Here's where you'll start." Shows the first loaf, the goal in dollars and months, and how far along existing savings put them.

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

The emergency fund loaf is the first loaf for students with under 3 months covered. Students who already have 3+ months (or 1 to 3 months with card debt) start with it on the shelf. In the demo, ChooseLoaf shows the other four as "Coming soon" cards, with at most one tagged "Recommended."

### Emergency fund loaf

- **Target:** 1 month of essential costs by default (3 months when they start with 1 to under 3 months covered), rounded up to the nearest $50. The student can choose 1, 3, or 6 months.
- **Ranges to numbers:** the placement quiz collects ranges, but targets and stages need dollar figures. See "Range bands" under Placement quiz.
  - Open-ended top range: lower bound, and ask the student to type an exact number.
  - "Not sure": $500 starter target, shown as an estimate they can change.
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

- Lessons are videos with captions (WebVTT) and a short text summary below. Track "watched" when the student reaches 90% of the video or taps "Mark as watched."
- **Missing video:** no fake video files. If a lesson's video file is missing, show a "Video coming soon" poster with the lesson summary and a "Mark as watched" button. Real videos are added later by filename in `public/videos/<loaf>/`.
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
- **Investment loaves (future):** require 80% to start, since understanding risk protects new investors. This check applies to everyone, including students who test out of the videos.
- **Test out (knowledge is checked inside each loaf):** before a loaf's videos, offer "Already know this? Take the quiz first."
  - 4 or more of 5 correct: the videos become optional, with copy like "You know this. Let's make it happen." Go to Saving setup.
  - Fewer: each missed question recommends its lesson (quiz questions already map to lessons). After the lessons, the student takes the quiz again, with explanations.
  - The normal path (no test-out) is unchanged: videos, then quiz.

## Saving and rising

- **Saving setup:** the student picks a habit and sees both suggestions: **weekly** = target ÷ 12 weeks (about one semester), rounded up to the nearest $5, minimum $5; **per paycheck** = 10% of each paycheck. Placement doesn't ask income type, so the student chooses. They also see the suggested account type (high-yield savings). In the demo there is no real account. Students with no savings account of any kind get an extra step about opening a high-yield savings account; students who already have one skip it.
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

- Celebration screen, then the loaf goes to the bread shelf with its completion month. A loaf counted as baked at the start (existing savings already cover the goal) shows "Already built" instead of a date, with no completion month recorded.
- ChooseLoaf recommends one next loaf using placement answers:
  - Carries credit card debt: recommend Debt payoff, with a note that paying off high-interest debt usually comes before investing.
  - Has earned income and no retirement account: recommend Roth IRA. (A Roth IRA requires earned income, so never recommend it without.) "Not sure" about accounts counts as no retirement account. The Roth IRA loaf will start with a "Check whether you already have one" step.
  - Otherwise: recommend Index funds.
- **Multiple loaves (future, not in demo):** after the emergency fund loaf is done, allow up to 2 active loaves. Each deposit is assigned to one loaf when logged.

## Money and data rules

- Store all money as **integer cents**. Format only at display time.
- Dates are ISO strings in UTC; display in the user's local time.
- Supabase tables: `profiles` (essentials range, existing savings range, `accounts`, `cardDebt`, `earnedIncome`, `monthsCovered`), `placement_results`, `loaves`, `transactions`, `lesson_progress`, `quiz_attempts`.
- Row Level Security is on for every table. Users can only read and write their own rows.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env.local`.

## Demo mode

- Turned on with `?demo=1` in the URL or `VITE_DEMO_MODE=true`.
- Shows a small "Demo" pill in the top corner.
- **Continue as demo user** on the login screen signs into a seeded account: Maya. Placement: checking and regular savings, no emergency savings at start, no retirement account. She did not test out. Lessons watched, quiz done, emergency fund loaf at 60% ($240 of $400), with about 6 weeks of past deposits so her history looks real. Earned income: yes. Credit card debt: no, so ChooseLoaf recommends the Roth IRA.
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

Content for the Index funds, Bonds, Roth IRA, and Debt payoff loaves (cards only), multiple active loaves, crews or any social features, real banking or investing, local business rewards, school single sign-on, push notifications, Apple sign-in (needs a paid Apple developer account), and native app store builds.

## How to work in this repo

- Read this file before starting. If a request conflicts with it, point out the conflict before writing code.
- The build plan is in `docs/plan.md`. Update it at the end of every milestone (mark done, note changes).
- For changes touching more than 3 files, propose a short plan first.
- Keep `src/domain/` pure and covered by tests. Run `npm run test` and `npm run build` before saying a task is done.
- Lesson, quiz, and loaf content lives in `content/`, never hardcoded in components.
- Small, focused commits with clear messages.
- When a decision changes (stack, rules, flow, design), update this file in the same change.
