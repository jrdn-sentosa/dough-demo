# Setup: Supabase accounts

Real accounts use Supabase (sign-in and the database). The demo user ("Continue as demo user") never touches Supabase: it works without a project, keys, or a connection, and nothing leaves the device. Until the keys below are set, the login screen shows only the demo option.

These are the steps only you can do, in order.

**Status:** steps 1 to 5, 7 and 8 are done and checked on the Vercel preview (email codes through Gmail SMTP, the environment variables, and the two-account security check). **Step 6 (Google sign-in) is postponed:** `VITE_GOOGLE_SIGNIN` stays off, so the Google button is hidden. Your project URLs used below:

- Production: `https://dough-demo.vercel.app`
- Preview links: `https://dough-demo-<something>-jrdn4.vercel.app` (for example the branch link `https://dough-demo-git-milestone-12-supabase-jrdn4.vercel.app`)
- Local: `http://localhost:5173`

> **Keys, in one rule.** The app uses only the **project URL** and the **publishable key** (`sb_publishable_...`). The **secret key** (`sb_secret_...`), the database password, and the Google client secret never go in the app, never get a `VITE_` prefix, and never go in git. `.env.local` is already in `.gitignore`.

## 1. Create the Supabase project and get the two values

1. Sign in at <https://supabase.com/dashboard> and choose **New project**.
2. Name it `dough-demo`. Pick the region closest to you. Make a strong **database password** and save it in a password manager (you need it once, in step 3).
3. Wait a minute or two while it sets up.
4. Open **Project Settings → API Keys** and copy:
   - the **Project URL** (`https://<ref>.supabase.co`). The `<ref>` is the project reference id, also shown under **Project Settings → General**.
   - the **Publishable key** (`sb_publishable_...`).
   - Do **not** copy the secret key anywhere.

## 2. `.env.local`

In the repo root, create `.env.local` (not committed):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

If you had `VITE_SUPABASE_ANON_KEY` anywhere, delete it. It was renamed to `VITE_SUPABASE_PUBLISHABLE_KEY`. Restart `npm run dev` after changing env files.

## 3. Supabase CLI: log in, link, and create the tables

The CLI runs through `npx`, so nothing is installed into the project.

```
npx supabase login
npx supabase init
npx supabase link --project-ref <ref>
npx supabase db push
```

- `login` opens a browser to approve the CLI.
- `init` creates `supabase/config.toml`. Say **no** if it offers to set up VS Code or IntelliJ settings. Commit `supabase/config.toml`.
- `link` asks for the database password from step 1.
- `db push` runs the files in `supabase/migrations/` against your project. It lists them first and asks you to confirm.

Check it worked: in the dashboard open **Table Editor**. You should see `profiles`, `loaves`, `transactions`, `lesson_progress`, `quiz_attempts`, and `user_state`, each with **RLS enabled**.

To change the schema later, add a new file with `npx supabase migration new <name>`, write the SQL, and `db push` again. Never edit a migration that has already been pushed.

## 4. Auth settings

In the dashboard, **Authentication**:

1. **Sign In / Providers → Email**: make sure the Email provider is on. Set **Email OTP Length** to **6**. Leave the expiry at its default (one hour) or shorten it.
2. **URL Configuration**:
   - **Site URL**: `https://dough-demo.vercel.app`
   - **Redirect URLs** (add each):
     - `http://localhost:5173/**`
     - `https://dough-demo.vercel.app/**`
     - `https://dough-demo-*-jrdn4.vercel.app/**` (covers every Vercel preview and branch link)

   Google sign-in sends the student back to the page they started on. If that address is not in this list, Supabase sends them to the Site URL instead, so a preview link would bounce to production.

## 5. The email code template (done)

The login screen asks for a 6-digit code, not a link. Supabase sends one of two emails depending on whether the address already has an account, so change **both** templates under **Authentication → Email Templates**:

- **Confirm signup** (first time an address signs in)
- **Magic Link** (every time after)

Set the body of each to something like this (the important part is `{{ .Token }}`, and no link):

```html
<h2>Your Dough! code</h2>
<p>Enter this code in the app to sign in:</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
<p>It expires soon. If you didn't ask for it, you can ignore this email.</p>
```

Set the subject to `Your Dough! sign-in code`.

### Email delivery: set up your own SMTP before real testers

Supabase's built-in email sender is for trying things out: it **only delivers to addresses of your own Supabase team members** and has a very low hourly limit. That is enough for you. For anyone else (testers, classmates, a demo audience) you need a custom SMTP provider:

1. Create an account with any transactional email service and verify a sending address or domain.
2. **Authentication → Emails → SMTP Settings** (or **Project Settings → Auth**, depending on the dashboard version): turn on **Enable custom SMTP** and enter the host, port, username, password, and sender address from your provider.
3. Send yourself a code from the app to check.

> **Current setup:** Currently using Gmail SMTP with an app password (testing only, daily sending limit). Switch to an email service with a verified domain before launch: only the Supabase SMTP settings change.

## 6. Google sign-in (postponed)

> **Postponed.** Not set up yet. `VITE_GOOGLE_SIGNIN` is off, so the login screen shows no Google button. Do this step whenever you want Google sign-in, then turn the flag on as described at the end.

1. Open <https://console.cloud.google.com/>, create a project (or pick one), then go to **APIs & Services → OAuth consent screen** (shown as **Google Auth Platform** in newer consoles).
2. **Branding / App information**: app name `Dough!`, your support email.
3. **Audience**: choose **External**. While the status is **Testing**, only the **test users** you list (add your own Google address) can sign in. To let anyone sign in, choose **Publish app**. The app only asks for the basic profile and email, so Google does not need to review it.
4. **Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**): type **Web application**.
   - **Authorized redirect URIs**: `https://<ref>.supabase.co/auth/v1/callback`
   - (Authorized JavaScript origins can stay empty. Redirects are handled by Supabase.)
5. Copy the **Client ID** and **Client secret**.
6. In Supabase, **Authentication → Sign In / Providers → Google**: turn it on and paste the Client ID and secret. That secret lives only in the Supabase dashboard.
7. Do **not** add your Vercel addresses to Google. Only Supabase's callback address goes there. The Vercel addresses go in Supabase's **Redirect URLs** (step 4).

8. Show the button: it stays hidden until you turn it on. Once Google is enabled in Supabase (step 6), set `VITE_GOOGLE_SIGNIN=true` in `.env.local` (restart `npm run dev`) and in Vercel's environment variables for Production and Preview (step 7), then redeploy. Leave it empty or unset to keep the button hidden. It also needs Supabase to be configured.

The Google button uses Google's four-color "G" and a white button with a thin grey border, as in Google's sign-in branding guidelines. If you later publish the app, give it a quick look against <https://developers.google.com/identity/branding-guidelines>.

## 7. Vercel environment variables (done)

In the Vercel dashboard, open the `dough-demo` project → **Settings → Environment Variables**:

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (and `VITE_GOOGLE_SIGNIN=true` once step 6 is done) for **Production** and **Preview** (and Development if you use `vercel dev`). For Preview choose **All Preview Branches**.
2. Add `VITE_APP_URL` = `https://dough-demo.vercel.app` for **Production** and **Preview** (All Preview Branches). It is the address on share cards and in the share link, so a card made on a preview link or a local run still points to the real app. Leave it empty (or unset, as in `.env.local`) and the share link uses the address of the page the student is on. The same happens if the value isn't a web address (it needs `https://`), and the browser console warns with the bad value. It is only a public address, not a secret.
3. If `VITE_SUPABASE_ANON_KEY` exists, delete it.
4. **Redeploy.** Vite bakes these values in when it builds, so a deployment made before you added them still shows only the demo option. Use **Deployments → ⋯ → Redeploy** on the branch you want to test, or push a new commit.

## 8. Check Row Level Security (once, done)

Row Level Security makes sure one student can never see or change another student's rows. Tests can't check this, so do it by hand once after the first push.

1. In the app, sign in with two different accounts (for example two email addresses) and finish placement on each, so both have rows.
2. In the dashboard open **Authentication → Users** and copy each user's **UID**. Call them `A` and `B`.
3. Open the **SQL Editor** and run this, with the real ids:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UID of A>","role":"authenticated"}', true);

-- A can see A's rows: expect a number above 0
select count(*) from public.loaves where user_id = '<UID of A>';
-- A cannot see B's rows: expect 0
select count(*) from public.loaves where user_id = '<UID of B>';
select count(*) from public.profiles where user_id = '<UID of B>';
select count(*) from public.transactions where user_id = '<UID of B>';
rollback;
```

4. Run this one separately. It should **fail** with `new row violates row-level security policy`:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<UID of A>","role":"authenticated"}', true);
insert into public.user_state (user_id) values ('<UID of B>');
rollback;
```

5. And this one, which should fail with `permission denied`, because signed-out visitors get nothing:

```sql
begin;
set local role anon;
select * from public.profiles;
rollback;
```

If any of these behave differently, stop and tell me before anyone else signs in.

## What to expect in the app

- **Demo user**: Maya (see "Demo tools"). Data stays in this browser. Signing in to a real account does not copy it over.
- **Offline**: if a signed-in student loses their connection, their loaf stays readable (the app keeps a read-only copy in this browser, removed on sign out) and a banner says changes can't be saved right now. There is no offline syncing: anything done while offline is not kept.
- **Two devices at the same time**: "last save wins" for loaf and `user_state` rows (habit, seen tips, streak unlocks, and so on). Transactions are insert-only with random ids, so deposits and withdrawals are never lost. This is fine for the demo.
- **Sign out**: Settings → **Sign out** for real accounts, or **Exit demo** for the demo user. Exiting the demo keeps the demo loaf on this device, so "Continue as demo user" picks it up again.

## Restoring a paused project before a demo

Free Supabase projects **pause after about a week without activity**. A paused project makes sign-in and data fail (the app shows its offline message), but nothing is lost.

1. Open <https://supabase.com/dashboard> and select the project. It says **Project paused**.
2. Choose **Restore project** and wait a few minutes until it says it is healthy.
3. Reload the app and sign in again.

Do this at least a few minutes before a demo, and open the app once to check. Paused projects are kept for a limited time (about 90 days on the free plan). After that the data can only be downloaded, not restored, so don't leave it paused for months.

## Install the app on a phone

Dough! is a progressive web app, so it installs from the browser. There is no app store. Use the Vercel production link (`https://dough-demo.vercel.app`) or a preview link. The installed app opens full screen, with the app icon, and the loaf, lessons and quizzes keep working without a connection. Signed-in students still need a connection to save changes.

**iPhone (Safari only):**

1. Open the link in **Safari**. Other iPhone browsers can't install web apps.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**.
4. Keep the name "Dough!" and tap **Add**. The icon appears on the home screen. Open the app from there.

**Android (Chrome):**

1. Open the link in **Chrome**.
2. Tap the **⋮** menu in the top right.
3. Tap **Install app** (on some phones it reads **Add to Home screen**), then **Install**. Chrome may also show an "Install" banner by itself.
4. Open Dough! from the home screen or app drawer.

**New versions:** when a new version is deployed, an open app shows a calm "New version available" message with **Refresh** and **Not now**. Nothing is lost: everything is already saved. If the message is dismissed, it comes back the next time the app opens.

**If an install looks stale:** close the app completely and open it again. On iPhone, a very old install can be removed (hold the icon, **Remove App**) and added again.

## Replace the placeholder app icon

The current icon is the Dough! character on the app's crust brown. There are **two source files** and **one command** that makes every size from them:

- `design/icon/icon.svg` makes the regular icons and the apple-touch icon. The artwork is about **85% of the width**, because these are shown whole or with rounded corners.
- `design/icon/icon-maskable.svg` makes the maskable icon only. Android crops it to its own shape (a circle, a rounded square, a teardrop), so the artwork's farthest point from the centre must be **at most 36% of the size** (a margin inside the 40% safe zone).

(`design/icon/icon-original.svg` is the untouched original, kept for reference. `design/icon/preview.html` shows every crop with the source it uses: open it in a browser.)

To use a different logo:

1. Make the logo as an **SVG, a full-bleed square** (the background fills the whole square, with no rounded corners and no transparency), with the artwork centred.
2. Save it twice, with the sizes above: artwork about 85% of the width in `design/icon/icon.svg`, and the same artwork scaled down so its farthest point is at most 36% of the size from the centre in `design/icon/icon-maskable.svg`. Keep the file names and paths.
3. Open `design/icon/preview.html` and check the crops.
4. Run:

   ```
   npm run icons
   ```

   It rewrites everything in `public/icons/`: `icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png` (180×180) and `favicon-32.png`.
5. If the logo's background is not the placeholder's crust brown, change the `background` colour on the `flatten` line in `scripts/generate-icons.mjs` to match (it only fills any transparent corners).
6. Run `npm run test` (tests check every icon exists at the right size, and measure how much of the icon the artwork covers) and `npm run build`.
7. Commit `design/icon/icon.svg`, `design/icon/icon-maskable.svg` and `public/icons/`, then deploy.
8. To see the new icon on a phone, **remove the installed app and add it again** (see "Install the app on a phone"). Phones keep the old icon until then. Browsers can also cache the tab icon for a while.

## Demo tools

- Add `?demo=1` to the link to turn on the demo tools: the **Demo** pill, **Skip a week** and **Skip a week without saving** on Home, and **Reset demo** and **Start fresh demo** in Settings. **Start fresh demo** is also on the login screen.
- **Continue as demo user** signs in as **Maya** on a new device: an emergency fund at $240 of $400 and a 6-week saving streak. The three breads that streak earned are already marked as seen, so opening the demo doesn't show unlock messages. Her next bread (pretzel, at 8 weeks) shows normally after two **Skip a week** taps.
- **Reset demo** puts Maya back as she started. **Start fresh demo** clears the demo and starts at the placement quiz, like a first-time student. Both only touch the demo on this device. They never appear for a real account, and the app refuses to run them for one.

## Troubleshooting

- **The install option doesn't appear**: use the real link (not a private window), on Safari (iPhone) or Chrome (Android). The app must be served over `https`, which Vercel links are.
- **No code arrives**: check spam; with the built-in sender, the address must belong to your Supabase team; check the template contains `{{ .Token }}` in both templates (step 5); look under **Authentication → Logs**.
- **"That code didn't work"**: codes expire and only the newest one works. Ask for a new code.
- **Google sends me to the wrong site or shows `redirect_uri_mismatch`**: a mismatch in step 4 (Supabase Redirect URLs) or step 6 (Google redirect URI must be exactly Supabase's `/auth/v1/callback`).
- **Login shows only "Continue as demo user" on Vercel**: the env vars are missing for that environment, or the deployment is older than the variables (step 7).
- **Signed in but everything is empty**: the migration has not been pushed (step 3), or you are looking at the demo user's local data.
