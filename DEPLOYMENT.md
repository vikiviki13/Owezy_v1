# Supabase + Vercel/Netlify deployment

## 1. Create Supabase

1. Create a project at https://database.new.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and click **Run**. This creates the app data, RLS, App Lock, WebAuthn credential, unlock-session, action-bound reauthentication, atomic rate-limit, and security-alert tables. Do not run `security_enforcement.sql` yet; it is the final rollout step.
3. In **Authentication → Providers → Email**, keep Email enabled and require email confirmation for production accounts. Enable leaked-password protection and configure Supabase Auth rate limits/CAPTCHA according to the expected traffic.
4. In the project's **Connect** panel, copy the Project URL and publishable key.

Never use the `service_role` key in this frontend. The publishable key is safe to expose. After the final enforcement step, private data is available only through the authenticated Edge Function, which checks App Lock before accessing it with the service role.

## 2. Deploy the security Edge Function

App Lock deliberately does not verify PINs or WebAuthn responses in the browser. The `security` Supabase Edge Function performs Argon2id PIN hashing, action-bound password reauthentication, challenge generation, origin/RP validation, WebAuthn verification, atomic lockout/rate-limit enforcement, private-data authorization, and security-event/alert recording. Its exact dependencies are frozen in `supabase/functions/security/deno.lock`.

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

After the function deployment succeeds, deploy the updated frontend. Confirm that an account can load its data, lock/unlock the app, and import a confirmed contact. **Only then** open the SQL Editor again and run `supabase/security_enforcement.sql`. That final script revokes direct browser access to `app_data`, `friends`, and security events, making the Edge Function the App Lock enforcement boundary.

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
- Add `http://localhost:5173` and the production URL to **Redirect URLs**.
- If you use Netlify preview deployments, add the required Netlify preview URL pattern too.

## 5. Deploy with Vercel

1. Push this source folder to GitHub and import the repository into Vercel.
2. If this folder is inside a larger repository, set Vercel's **Root Directory** to `owezy-source`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Project Settings → Environment Variables** for Production and Preview.
4. Deploy. `vercel.json` selects the Vite build and `dist` output automatically.
5. Copy the final `https://your-app.vercel.app` URL, add it to `WEBAUTHN_ALLOWED_ORIGINS`, set it as `WEBAUTHN_RP_ID`, and redeploy the `security` function using the commands above.
6. Confirm Vercel is serving the security headers from `vercel.json`, including CSP, HSTS, frame protection, and Permissions Policy.

## 6. Security verification

After deployment:

1. Create an account and sign in.
2. Open **Profile → Security → App Lock**.
3. Complete Device Security setup if supported, create the required 6-digit fallback PIN, and choose the 5-minute auto-lock default.
4. Lock and reopen the app. Confirm `/unlock` appears before any financial screen or cloud-data request.
5. Test PIN fallback, five failed PIN attempts, concurrent incorrect PIN attempts, cancellation of the OS authentication prompt, background timeout, refresh, PIN change, device enrollment/removal, password-based recovery, export re-authentication, and offline/logout cleanup.
6. Verify with two separate test accounts that a direct PostgREST request to `app_data` or `friends` is denied after `security_enforcement.sql` is applied, while normal in-app access succeeds only after App Lock is unlocked.
7. Review `security_alerts` and `security_events` in the Supabase SQL Editor using an operator/service-role context. Forward alerts to your organization’s monitoring system before public launch; the application never exposes alert records to browser clients.

Device Security requires HTTPS in production. `http://localhost` is the browser-supported development exception.

## 7. Netlify alternative

1. Push this source folder to GitHub and import the repository into Netlify.
2. If this folder is inside a larger repository, set the **Base directory** to `owezy-source`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Site configuration → Environment variables**.
4. Deploy. `netlify.toml` runs the build and publishes `dist` automatically.

## Data behavior

- Supabase Auth provides email/password accounts.
- Every account has one private `app_data` JSON document.
- RLS prevents users from reading or changing any other account's document; the final enforcement script additionally removes direct browser table access.
- Older browser-only data is never attached automatically. The user must explicitly confirm import into the signed-in account or discard it.
- Current-session data is tab-scoped and is cleared when App Lock engages or the user signs out. Contact drafts are user-bound, expire after 30 minutes, and are never uploaded until confirmed.
- Changes update in memory immediately and are uploaded to Supabase in order through the security Edge Function.
