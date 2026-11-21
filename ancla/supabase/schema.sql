-- Esquema de Ancla (bot de WhatsApp para TDA).
-- Ejecutar en el SQL Editor de Supabase. El bot usa la service role key desde el servidor,
-- así que RLS queda activado sin políticas: nadie más puede leer estas tablas.

create table if not exists ancla_users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null default '',
  timezone text not null default 'America/Mexico_City',
  morning_time text not null default '08:30',
  evening_time text not null default '21:00',
  proactive boolean not null default true,
  energy text not null default 'unknown' check (energy in ('unknown','low','medium','high')),
  focus_item_id uuid,
  notes text[] not null default '{}',
  last_inbound_at timestamptz,
  last_morning_date date,
  last_evening_date date,
  checkin_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ancla_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references ancla_users(id) on delete cascade,
  kind text not null check (kind in ('task','idea','worry','appointment','note')),
  title text not null,
  first_step text not null default '',
  due text,
  estimate_minutes int,
  status text not null default 'open' check (status in ('open','started','done','dropped')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  done_at timestamptz
);
create index if not exists ancla_items_user_status on ancla_items (user_id, status);

create table if not exists ancla_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references ancla_users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists ancla_messages_user_time on ancla_messages (user_id, created_at desc);

-- Ids de mensajes de WhatsApp ya procesados (Meta reintenta los webhooks).
create table if not exists ancla_inbound_ids (
  id text primary key,
  created_at timestamptz not null default now()
);

alter table ancla_users enable row level security;
alter table ancla_items enable row level security;
alter table ancla_messages enable row level security;
alter table ancla_inbound_ids enable row level security;
