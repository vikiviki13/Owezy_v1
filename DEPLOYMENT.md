# Supabase + Vercel/Netlify deployment

## 1. Create Supabase

1. Create a project at https://database.new.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and click **Run**.
3. In **Authentication → Providers → Email**, keep Email enabled. Choose whether new users must confirm their email.
4. In the project's **Connect** panel, copy the Project URL and publishable key.

Never use the `service_role` key in this frontend. The publishable key is safe to expose because `app_data` is protected by Row Level Security; every user can access only the row matching their authenticated user ID.

## 2. Run locally

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

## 3. Configure authentication URLs

In Supabase, open **Authentication → URL Configuration**:

- Set **Site URL** to your production URL, such as `https://your-app.vercel.app`.
- Add `http://localhost:5173` and the production URL to **Redirect URLs**.
- If you use Netlify preview deployments, add the required Netlify preview URL pattern too.

## 4A. Deploy with Vercel

1. Push this source folder to GitHub and import the repository into Vercel.
2. If this folder is inside a larger repository, set Vercel's **Root Directory** to `tab-expense-tracker-source`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` under **Project Settings → Environment Variables** for Production and Preview.
4. Deploy. `vercel.json` selects the Vite build and `dist` output automatically.

## 4B. Deploy with Netlify

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
