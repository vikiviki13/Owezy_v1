# Supabase + Vercel/Netlify deployment

## 1. Create Supabase

1. Create a project at https://database.new.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and click **Run**. This creates the app data, RLS, App Lock, WebAuthn credential, unlock-session, challenge, and security-activity tables.
3. In **Authentication → Providers → Email**, keep Email enabled. Choose whether new users must confirm their email.
4. In the project's **Connect** panel, copy the Project URL and publishable key.

Never use the `service_role` key in this frontend. The publishable key is safe to expose because `app_data` is protected by Row Level Security; every user can access only the row matching their authenticated user ID.

## 2. Deploy the security Edge Function

App Lock deliberately does not verify PINs or WebAuthn responses in the browser. The `security` Supabase Edge Function performs Argon2id PIN hashing, challenge generation, origin/RP validation, WebAuthn verification, lockout enforcement, and security-event recording.

Install and authenticate the Supabase CLI, then link this folder to the project:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set the allowed app origins and production WebAuthn RP ID. Values in `WEBAUTHN_ALLOWED_ORIGINS` must be exact origins with no trailing slash:

```bash
supabase secrets set WEBAUTHN_ALLOWED_ORIGINS=http://localhost:5173,https://your-app.vercel.app
supabase secrets set WEBAUTHN_RP_ID=your-app.vercel.app
supabase functions deploy security
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Never add the service-role key to Vercel or any `VITE_` environment variable.

WebAuthn credentials are bound to an RP ID. If you later move to a custom domain, add its exact origin, update `WEBAUTHN_RP_ID`, redeploy the function, and register Device Security again on the new domain. Preview deployment origins can be added explicitly, but they use credentials scoped to their own host unless they are subdomains of the configured RP ID.

## 3. Run locally

Copy `.env.example` to `.env.local` and replace both placeholder values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Then run:

```bash
npm install
npm run dev
```

## 4. Configure authentication URLs

In Supabase, open **Authentication → URL Configuration**:

- Set **Site URL** to your production URL, such as `https://your-app.vercel.app`.
- Add `http://localhost:5173/reset-password` and `https://your-app.vercel.app/reset-password` to **Redirect URLs** for password recovery.
- Keep the production origin itself in **Redirect URLs** for sign-up email confirmation.
- If you use Netlify preview deployments, add the required Netlify preview URL pattern too.

## 5. Deploy with Vercel

1. Push this source folder to GitHub and import the repository into Vercel.
2. If this folder is inside a larger repository, set Vercel's **Root Directory** to `tab-expense-tracker-source`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Project Settings → Environment Variables** for Production and Preview.
4. Deploy. `vercel.json` selects the Vite build and `dist` output automatically.
5. Copy the final `https://your-app.vercel.app` URL, add it to `WEBAUTHN_ALLOWED_ORIGINS`, set it as `WEBAUTHN_RP_ID`, and redeploy the `security` function using the commands above.

## 6. Security verification

After deployment:

1. Create an account and sign in.
2. Open **Profile → Security → App Lock**.
3. Complete Device Security setup if supported, create the required 6-digit fallback PIN, and choose the 5-minute auto-lock default.
4. Lock and reopen the app. Confirm `/unlock` appears before any financial screen or cloud-data request.
5. Test PIN fallback, five failed PIN attempts, cancellation of the OS authentication prompt, background timeout, refresh, PIN change, device removal, recovery, export re-authentication, and logout cleanup.

Device Security requires HTTPS in production. `http://localhost` is the browser-supported development exception.

## 7. Netlify alternative

1. Push this source folder to GitHub and import the repository into Netlify.
2. If this folder is inside a larger repository, set the **Base directory** to `tab-expense-tracker-source`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Site configuration → Environment variables**.
4. Deploy. `netlify.toml` runs the build and publishes `dist` automatically.

## Data behavior

- Supabase Auth provides email/password accounts.
- Every account has one private `app_data` JSON document.
- RLS prevents users from reading or changing any other account's document.
- The first account used in a browser imports the old local-only data once, if it exists.
- Changes update locally immediately and are uploaded to Supabase in order.
