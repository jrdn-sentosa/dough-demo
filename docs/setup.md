# Setup: Supabase accounts

Real accounts use Supabase (sign-in and the database). The demo user ("Continue as demo user") never touches Supabase: it works without a project, keys, or a connection, and nothing leaves the device. Until the keys below are set, the login screen shows only the demo option.

These are the steps only you can do, in order. Your project URLs used below:

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

## 5. The email code template

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

## 6. Google sign-in

1. Open <https://console.cloud.google.com/>, create a project (or pick one), then go to **APIs & Services → OAuth consent screen** (shown as **Google Auth Platform** in newer consoles).
2. **Branding / App information**: app name `Dough!`, your support email.
3. **Audience**: choose **External**. While the status is **Testing**, only the **test users** you list (add your own Google address) can sign in. To let anyone sign in, choose **Publish app**. The app only asks for the basic profile and email, so Google does not need to review it.
4. **Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**): type **Web application**.
   - **Authorized redirect URIs**: `https://<ref>.supabase.co/auth/v1/callback`
   - (Authorized JavaScript origins can stay empty. Redirects are handled by Supabase.)
5. Copy the **Client ID** and **Client secret**.
6. In Supabase, **Authentication → Sign In / Providers → Google**: turn it on and paste the Client ID and secret. That secret lives only in the Supabase dashboard.
7. Do **not** add your Vercel addresses to Google. Only Supabase's callback address goes there. The Vercel addresses go in Supabase's **Redirect URLs** (step 4).

The Google button uses Google's four-color "G" and a white button with a thin grey border, as in Google's sign-in branding guidelines. If you later publish the app, give it a quick look against <https://developers.google.com/identity/branding-guidelines>.

## 7. Vercel environment variables

In the Vercel dashboard, open the `dough-demo` project → **Settings → Environment Variables**:

1. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for **Production** and **Preview** (and Development if you use `vercel dev`). For Preview choose **All Preview Branches**.
2. If `VITE_SUPABASE_ANON_KEY` exists, delete it.
3. **Redeploy.** Vite bakes these values in when it builds, so a deployment made before you added them still shows only the demo option. Use **Deployments → ⋯ → Redeploy** on the branch you want to test, or push a new commit.

## 8. Check Row Level Security (once)

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

- **Demo user**: unchanged. Data stays in this browser. Signing in to a real account does not copy it over.
- **Offline**: if a signed-in student loses their connection, their loaf stays readable (the app keeps a read-only copy in this browser, removed on sign out) and a banner says changes can't be saved right now. There is no offline syncing: anything done while offline is not kept.
- **Two devices at the same time**: "last save wins" for loaf and `user_state` rows (habit, seen tips, streak unlocks, and so on). Transactions are insert-only with random ids, so deposits and withdrawals are never lost. This is fine for the demo.
- **Sign out**: Settings → **Sign out** (real accounts only).

## Restoring a paused project before a demo

Free Supabase projects **pause after about a week without activity**. A paused project makes sign-in and data fail (the app shows its offline message), but nothing is lost.

1. Open <https://supabase.com/dashboard> and select the project. It says **Project paused**.
2. Choose **Restore project** and wait a few minutes until it says it is healthy.
3. Reload the app and sign in again.

Do this at least a few minutes before a demo, and open the app once to check. Paused projects are kept for a limited time (about 90 days on the free plan). After that the data can only be downloaded, not restored, so don't leave it paused for months.

## Troubleshooting

- **No code arrives**: check spam; with the built-in sender, the address must belong to your Supabase team; check the template contains `{{ .Token }}` in both templates (step 5); look under **Authentication → Logs**.
- **"That code didn't work"**: codes expire and only the newest one works. Ask for a new code.
- **Google sends me to the wrong site or shows `redirect_uri_mismatch`**: a mismatch in step 4 (Supabase Redirect URLs) or step 6 (Google redirect URI must be exactly Supabase's `/auth/v1/callback`).
- **Login shows only "Continue as demo user" on Vercel**: the env vars are missing for that environment, or the deployment is older than the variables (step 7).
- **Signed in but everything is empty**: the migration has not been pushed (step 3), or you are looking at the demo user's local data.
