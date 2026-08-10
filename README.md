# Tab — Friend Expense & Repayment Tracker

"I paid. Remember it for me."

A mobile-first PWA for tracking money you have fronted for friends and what they have paid back. The app now supports multiple private user accounts with Supabase email/password authentication and cloud synchronization.

## What you need

- Node.js 22 or newer
- A Supabase project
- A Vercel or Netlify account for deployment

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Copy `.env.example` to `.env.local`.
4. Add your Supabase Project URL and **publishable** key to `.env.local`.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never put a Supabase `service_role` key in this frontend.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run lint
npm run build
npm run preview
```

The production site is generated in `dist/`.

## Accounts and data security

- Users can create an account and sign in with email and password.
- Supabase Auth stores passwords; the application never stores plain-text passwords.
- Each account's expense data is stored in its own `app_data` row.
- PostgreSQL Row Level Security uses `auth.uid()` so users can only access their own row.
- A per-user cloud document preserves the existing calculation engine while syncing across devices.
- Existing local-only data is imported into the first account used in that browser one time.

## Deployment

See `DEPLOYMENT.md` for the exact Supabase, Vercel, and Netlify steps, including environment variables and authentication redirect URLs.

## Features

- Dashboard with pending, paid, and received totals
- Friends, balances, and individual ledgers
- Equal or custom expense splitting
- General or expense-specific repayments
- Activity feed and date-range statements
- Groups and reusable group members
- CSV and JSON export
- Light, dark, and system themes
- Installable PWA with offline app-shell caching

## Current data model

The expense engine continues to work locally in memory for immediate UI updates. Each change is serialized to one RLS-protected Supabase JSON document per user. This is suitable for personal expense tracking and avoids a risky rewrite of the existing calculation code. A future collaborative/shared-ledger version should use normalized Supabase tables and explicit membership policies.
