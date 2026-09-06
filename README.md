# Smart Corporation — CRM + Financial Dashboard

A mini CRM and financial dashboard for Smart Corporation: manage clients
(hourly and fixed), prospects, team payments, expenses, and automatically
calculate the monthly profit split between Marianny and Natalia.

Built with **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase**.

## The core rule

Profit is only split between profit-share partners **after** team
payments and other business expenses are deducted from revenue. It is
never split from gross revenue. This is enforced in one place:
[`lib/finance.ts`](./lib/finance.ts), and verified by
[`scripts/test-finance.ts`](./scripts/test-finance.ts) against the exact
example from the spec:

```
Revenue:        $3,000
Luciana:          $300
Maru:              $200
Other Expenses:    $100
-----------------------
Profit Available: $2,400
Marianny (50%):   $1,200
Natalia (50%):    $1,200
```

Run it yourself:

```bash
npm run test:finance
```

## 1. Run it locally

Requirements: Node.js 20+ and a free [Supabase](https://supabase.com) project (see step 2).

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + anon key
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## 2. Connect it to Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, go to **SQL Editor** and run, in order:
   - the contents of [`supabase/schema.sql`](./supabase/schema.sql) — creates all tables, indexes, and Row Level Security policies.
   - the contents of [`supabase/seed.sql`](./supabase/seed.sql) — loads the initial team (Natalia, Marianny, Luciana, Maru), the September 2026 payments described in the spec, and a couple of demo clients so the dashboard isn't empty.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Paste both into `.env.local` (see `.env.example`).
5. Create your team's login accounts: **Authentication → Users → Add user** (email + password) for each person who needs access. There's no self-service sign-up — this is a private, invite-only tool, exactly as requested.
6. Restart `npm run dev` (or redeploy) after changing environment variables.

Row Level Security is enabled on every table: only authenticated users (the accounts you create in step 5) can read or write any data. There's no public/anonymous access at all.

### Database structure

| Table | Purpose |
|---|---|
| `settings` | Company name, currency (single row, editable in Settings) |
| `team_members` | Natalia, Marianny, Luciana, Maru, and future hires — default payment type/amount/% |
| `team_payments` | The **actual** cost per team member per month — this is what the profit calculation uses, so you can change Maru's pay for one month without touching code or her default settings |
| `clients` | All client records (hourly, fixed, project, other) |
| `time_entries` | Hours logged per hourly client per month |
| `fixed_billing` | Monthly invoice/payment status per fixed-fee client |
| `expenses` | General business expenses by category |
| `prospects` | Sales pipeline; a "Won" prospect can be converted into a `clients` row with one click |
| `profit_distributions` / `profit_distribution_shares` | A **frozen snapshot** of a month's revenue/costs/split, saved when you click "Lock in this month's distribution" on the Finances page. This is what keeps History stable even if you later change the profit-share % in Settings. |

## 3. Deploy for free (or nearly free) with Vercel

1. Push this repository to GitHub (already done if you're reading this from the repo).
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the GitHub repo.
3. In the project's **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**. Vercel's free Hobby tier is enough for a small internal tool like this — no credit card required.
5. Every future `git push` to the main branch redeploys automatically.

Supabase's free tier (500MB database, 50k monthly active users) is also
more than enough for this use case.

## How to use it day to day

- **Add Client** (Clients page): pick Hourly / Fixed Monthly / Project / Other immediately — the relevant rate field appears right away. Takes under a minute.
- **Hourly Clients**: update hours worked any time during the month; revenue recalculates instantly (hours × rate).
- **Fixed Clients**: track invoice status (Pending / Invoiced / Paid / Overdue) and amount paid per month.
- **Team**: manage who's on the team and their default pay/profit share. Use "Payments This Month" to record the actual amount for a specific month — this is how Maru's one-time September 2026 payment works, and how you'll pay her differently in October without editing any code.
- **Finances**: see the full waterfall (Revenue → − Team Costs → − Expenses → Profit Available → 50/50 split) for any month, and lock it in for History.
- **History**: every past month, locked-in distributions never move even if you later change % in Settings.
- **Prospects**: track the pipeline; mark a prospect "Won" and click "Convert to Client" to create the client record automatically.
- **Settings**: company name, currency, and each team member's default pay/percentage — no code changes needed.

## Adapting it for the future

The data model was built so growth doesn't require a rebuild:

- **More employees/partners**: add a row in Team — no schema or code change.
- **Different profit-split percentages, or more than two partners**: just add more `profit_share` team members and set their `%`; the calculation (`lib/finance.ts`) splits across however many there are, and warns on the Finances page if the percentages don't add up to 100%.
- **New client billing types**: `billing_model` already supports Hourly / Fixed Monthly / Project / Other; "Other" is a safe landing spot for anything unusual until it's worth a dedicated flow.
- **New expense categories**: edit the `category` check constraint in `supabase/schema.sql` and the `CATEGORIES` list in `app/(app)/expenses/new/page.tsx`.

## Known limitation to flag

Two `npm audit` findings remain (both "high", not "critical") that only
have a fix in Next.js 16, a breaking major upgrade not worth risking in
this delivery. This app is private and behind Supabase Auth, which limits
the practical exposure, but plan to revisit the Next.js version in the
next few months.
