# HomeMint

A calmer place for your family's money. Built with Next.js 16, React 19, TypeScript, Supabase Auth/Postgres, and a responsive custom interface. Ready for Vercel, with INR as the default currency.

## What works

- Dashboard with monthly spending, household budgets, category breakdowns, and savings goals.
- Add, edit, delete, search, and filter expenses; export the selected month and filters as CSV.
- Shared or private expenses, enforced in PostgreSQL with row-level security.
- Equal splits with exact paisa rounding, or custom amounts; net balances for each household member.
- Monthly category budgets and manually tracked savings goals, editable by the owner.
- Email/password signup, verification, login, password reset, and sign out using Supabase.
- Household creation and email-bound invitation links that expire after 7 days.
- Household name, currency, and income settings.
- Clearly labeled demo with browser-local persistence. Demo records never migrate into a real account.
- Responsive desktop/mobile layouts, keyboard-accessible dialogs, and reduced-motion support.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On Windows, use `Copy-Item .env.example .env.local` if you need to create the environment file. An ignored `.env.local` is already configured in this working copy; do not overwrite it unnecessarily.

Open http://localhost:3000. Without Supabase environment variables, the app runs as an interactive demo.

## Supabase setup

1. For a **new, empty** Supabase project, run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) in the SQL Editor. It creates the tables, functions, validation trigger, and access policies atomically when run inside a transaction. Do not rerun it on an existing schema without reviewing its state. The provided project appears to already expose the `households` table and `household_members` function; their definitions have not been verified with administrative access.
2. In **Authentication → Providers**, enable email/password authentication and email confirmation.
3. In **Authentication → URL Configuration**, set the site URL to `https://home-mint.vercel.app`. Allow `http://localhost:3000/**` and `https://home-mint.vercel.app/**` as redirect URLs. Add your exact preview domain when testing account links on a Vercel preview.
4. Set these public client environment variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://xosxxzhpbovhwqbbcxnc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your public publishable key>
```

Use the public publishable key; never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable. The application uses browser-side Supabase authentication; database RLS protects data independently of the UI.

5. For production signup/reset emails, configure an SMTP provider in Supabase. Invitation links themselves are manually shared, so the app does not send invitation emails.
6. Create the first account, verify its email, then create a household. Invite a second verified account and verify the shared/private behavior before entering real financial information.

## Deploy on Vercel

1. Push this implementation to `aparnajibin111/HomeMint`.
2. Import that repository into the Vercel project intended for `home-mint.vercel.app`. Framework: **Next.js**. Root directory: repository root. Build command: `npm run build`. Use Node.js 22.
3. Add the two environment variables above to the Vercel project's Production environment (and Preview if needed). Local `.env.local` files are deliberately not committed or uploaded by Git.
4. Deploy/redeploy so the public environment variables are included in the client build.
5. Confirm the deployed domain is allowed in Supabase Auth's redirect configuration.

The supplied Vercel URL returned `DEPLOYMENT_NOT_FOUND` during setup. No production deployment has been made from this workspace.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npx playwright test
```

Domain tests cover exact splits, invalid allocations, private expense validation, and net balances. Database tests run the real SQL migration in an isolated PostgreSQL-compatible PGlite instance and verify RLS, owner permissions, invitation identity/expiry/single-use, invalid splits, and anonymous access. Playwright covers desktop and mobile navigation, overflow, expense persistence/edit/delete, custom splits, budget/goal edits, search, month filtering, and CSV downloads. GitHub Actions runs these checks.

## Current scope

- One household per account. The schema enforces this to keep household membership and onboarding unambiguous.
- A household has one currency. Currency changes are blocked in the UI after financial records exist; no currency conversion is performed.
- Budgets are recurring category limits, not historical monthly snapshots. Changing a limit affects comparisons for all months.
- The person who adds an expense is its payer. Only that person can edit or delete it, even when it is shared.
- Owners manage budgets, savings goals, household settings, and invitations. Members can view shared plans and manage their own expenses.
- Savings and income are manually entered. The app does not connect to bank accounts or move money.
- Recurring expenses are labeled reminders; they are not automatically posted or charged.
- Split balances are informative; payment settlement recording is not implemented yet.
- Membership removal, multiple households, income ledgers, automatic recurring entries, push notifications, and scheduled reports are future enhancements.
- Financial data is never served by a public server endpoint; all database reads/writes require Supabase authentication and RLS. Demo data is fictional and stays in local browser storage.

## Main files

- `components/homemint.tsx`: dashboard, navigation, forms, authentication, and household workflows.
- `app/globals.css`: responsive design system and layouts.
- `lib/domain.ts`: data types, money formatting, split validation, balances, and demo data.
- `lib/supabase.ts`: public client and household data loader.
- `supabase/migrations/001_initial.sql`: complete schema and authorization rules.
- `tests/`: domain, database authorization, and browser tests.
