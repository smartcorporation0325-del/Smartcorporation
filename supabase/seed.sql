-- Initial data for Smart Corporation.
-- Safe to re-run: uses upserts / guards so it won't duplicate rows.

-- Settings (single row)
insert into settings (company_name, currency)
select 'Smart Corporation', 'USD'
where not exists (select 1 from settings);

-- Team members
insert into team_members (name, role, payment_type, monthly_fixed_payment, profit_share_percent, active)
select 'Natalia', 'Partner', 'profit_share', 0, 50, true
where not exists (select 1 from team_members where name = 'Natalia');

insert into team_members (name, role, payment_type, monthly_fixed_payment, profit_share_percent, active)
select 'Marianny', 'Partner', 'profit_share', 0, 50, true
where not exists (select 1 from team_members where name = 'Marianny');

insert into team_members (name, role, payment_type, monthly_fixed_payment, profit_share_percent, active)
select 'Luciana', 'Team Member', 'fixed_monthly', 300, 0, true
where not exists (select 1 from team_members where name = 'Luciana');

insert into team_members (name, role, payment_type, monthly_fixed_payment, profit_share_percent, active)
select 'Maru', 'Team Member', 'one_time', 0, 0, true
where not exists (select 1 from team_members where name = 'Maru');

-- Luciana's recurring $300/month payment for September 2026
insert into team_payments (team_member_id, month, amount, note)
select id, '2026-09-01', 300, 'Recurring fixed monthly payment'
from team_members where name = 'Luciana'
on conflict (team_member_id, month) do nothing;

-- Maru's one-time $200 payment, specifically for September 2026
insert into team_payments (team_member_id, month, amount, note)
select id, '2026-09-01', 200, 'One-time payment for September 2026'
from team_members where name = 'Maru'
on conflict (team_member_id, month) do nothing;

-- =========================================================
-- Demo data (safe to delete later): a couple of clients so the
-- dashboard/charts aren't empty on first login.
-- =========================================================
insert into clients (client_name, company_name, status, billing_model, hourly_rate, main_contact, email, service_scope, source, payment_status)
select 'Carlos Reyes', 'Reyes Logistics', 'active', 'hourly', 35, 'Carlos Reyes', 'carlos@reyeslogistics.com', 'Ops consulting', 'Referral', 'current'
where not exists (select 1 from clients where client_name = 'Carlos Reyes');

insert into clients (client_name, company_name, status, billing_model, monthly_fixed_fee, main_contact, email, service_scope, source, payment_status)
select 'Ana Torres', 'Torres Boutique', 'active', 'fixed_monthly', 500, 'Ana Torres', 'ana@torresboutique.com', 'Social media management', 'Website', 'current'
where not exists (select 1 from clients where client_name = 'Ana Torres');

-- Demo hourly hours for September 2026
insert into time_entries (client_id, month, hours_worked, hourly_rate)
select id, '2026-09-01', 40, 35 from clients where client_name = 'Carlos Reyes'
on conflict (client_id, month) do nothing;

-- Demo fixed billing for September 2026
insert into fixed_billing (client_id, month, monthly_fee, payment_status, due_date, amount_paid)
select id, '2026-09-01', 500, 'paid', '2026-09-05', 500 from clients where client_name = 'Ana Torres'
on conflict (client_id, month) do nothing;

-- Demo expense
insert into expenses (date, month, description, category, amount, recurring, notes)
select '2026-09-03', '2026-09-01', 'Bank wire fees', 'Banking Fees', 100, false, 'Demo data'
where not exists (select 1 from expenses where description = 'Bank wire fees' and month = '2026-09-01');

-- Demo prospect
insert into prospects (company, contact, email, service_interested, estimated_value, billing_model, status, next_follow_up, notes)
select 'Nova Fitness', 'Diego Marin', 'diego@novafitness.com', 'Brand strategy', 1500, 'project', 'proposal_sent', '2026-09-15', 'Demo data'
where not exists (select 1 from prospects where company = 'Nova Fitness');
