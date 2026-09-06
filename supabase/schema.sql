-- Smart Corporation CRM + Finance schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- =========================================================
-- SETTINGS (single row, editable from the Settings screen)
-- =========================================================
create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'Smart Corporation',
  currency text not null default 'USD',
  updated_at timestamptz not null default now()
);

-- =========================================================
-- TEAM MEMBERS (Natalia, Marianny, Luciana, Maru, future hires)
-- =========================================================
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  payment_type text not null check (payment_type in ('fixed_monthly','profit_share','hourly','one_time')),
  monthly_fixed_payment numeric(12,2) not null default 0,
  hourly_rate numeric(12,2) not null default 0,
  profit_share_percent numeric(5,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Actual per-month cost line for each team member. This is the source of
-- truth used in the profit calculation, so a person's pay can be changed
-- for a single month (e.g. Maru's one-time Sept 2026 $200) without ever
-- touching team_members or app code.
create table if not exists team_payments (
  id uuid primary key default gen_random_uuid(),
  team_member_id uuid not null references team_members(id) on delete cascade,
  month date not null, -- always stored as first-of-month
  amount numeric(12,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  unique (team_member_id, month)
);

-- =========================================================
-- CLIENTS
-- =========================================================
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  company_name text,
  status text not null default 'prospect' check (status in ('prospect','active','paused','closed')),
  billing_model text not null check (billing_model in ('hourly','fixed_monthly','project','other')),
  hourly_rate numeric(12,2) default 0,
  monthly_fixed_fee numeric(12,2) default 0,
  project_fee numeric(12,2) default 0,
  start_date date,
  end_date date,
  main_contact text,
  email text,
  phone text,
  service_scope text,
  assigned_team_member_id uuid references team_members(id) on delete set null,
  notes text,
  source text,
  payment_status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- HOURLY CLIENTS: time entries per client per month
-- =========================================================
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null, -- first-of-month
  hours_worked numeric(10,2) not null default 0,
  hourly_rate numeric(12,2) not null default 0,
  total_revenue numeric(14,2) generated always as (hours_worked * hourly_rate) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);

-- =========================================================
-- FIXED CLIENTS: monthly billing records
-- =========================================================
create table if not exists fixed_billing (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  month date not null, -- first-of-month
  monthly_fee numeric(12,2) not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending','invoiced','paid','overdue')),
  due_date date,
  amount_paid numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);

-- =========================================================
-- EXPENSES
-- =========================================================
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  month date not null, -- first-of-month, derived from date but stored for fast grouping
  description text not null,
  category text not null check (category in ('Team','Software','Subscriptions','Operations','Banking Fees','Contractors','Other')),
  amount numeric(12,2) not null default 0,
  recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- PROSPECTS
-- =========================================================
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  contact text,
  email text,
  phone text,
  service_interested text,
  estimated_value numeric(12,2) default 0,
  billing_model text check (billing_model in ('hourly','fixed_monthly','project','other')),
  status text not null default 'new_lead' check (status in ('new_lead','contacted','meeting_scheduled','proposal_sent','negotiation','won','lost')),
  next_follow_up date,
  notes text,
  converted_client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PROFIT DISTRIBUTIONS (saved snapshot per month, so history never
-- shifts retroactively when Settings % change later)
-- =========================================================
create table if not exists profit_distributions (
  id uuid primary key default gen_random_uuid(),
  month date not null, -- first-of-month
  total_revenue numeric(14,2) not null default 0,
  team_costs numeric(14,2) not null default 0,
  other_expenses numeric(14,2) not null default 0,
  profit_available numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (month)
);

create table if not exists profit_distribution_shares (
  id uuid primary key default gen_random_uuid(),
  profit_distribution_id uuid not null references profit_distributions(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  share_percent numeric(5,2) not null,
  amount numeric(14,2) not null
);

-- =========================================================
-- Indexes
-- =========================================================
create index if not exists idx_time_entries_month on time_entries(month);
create index if not exists idx_fixed_billing_month on fixed_billing(month);
create index if not exists idx_expenses_month on expenses(month);
create index if not exists idx_team_payments_month on team_payments(month);
create index if not exists idx_clients_status on clients(status);
create index if not exists idx_clients_billing_model on clients(billing_model);
create index if not exists idx_prospects_status on prospects(status);

-- =========================================================
-- Row Level Security: private to authenticated Smart Corporation users
-- =========================================================
alter table settings enable row level security;
alter table team_members enable row level security;
alter table team_payments enable row level security;
alter table clients enable row level security;
alter table time_entries enable row level security;
alter table fixed_billing enable row level security;
alter table expenses enable row level security;
alter table prospects enable row level security;
alter table profit_distributions enable row level security;
alter table profit_distribution_shares enable row level security;

-- Any authenticated user (i.e. anyone you invite to the Supabase project)
-- gets full read/write access. There are no public roles/policies, so
-- unauthenticated requests are rejected entirely.
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'settings','team_members','team_payments','clients','time_entries',
      'fixed_billing','expenses','prospects','profit_distributions',
      'profit_distribution_shares'
    ])
  loop
    execute format(
      'create policy "authenticated_full_access" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'');',
      t
    );
  end loop;
end $$;
