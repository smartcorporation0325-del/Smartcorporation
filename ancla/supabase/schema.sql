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
  voice text not null default '',
  routines text[] not null default '{}',
  profile text not null default '',
  people jsonb not null default '[]',
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

-- Cosas que la persona dijo que haría (o pidió que le recordaran), con sus palabras originales.
create table if not exists ancla_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references ancla_users(id) on delete cascade,
  remind_at timestamptz not null,
  text text not null,
  quote text not null default '',
  said_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','sent','cancelled'))
);
create index if not exists ancla_reminders_user_status on ancla_reminders (user_id, status, remind_at);

-- Qué estaba haciendo y cómo estaba en cada momento; de noche se analizan para detectar patrones.
create table if not exists ancla_observations (
  id bigint generated always as identity primary key,
  user_id uuid not null references ancla_users(id) on delete cascade,
  at timestamptz not null default now(),
  activity text not null default '',
  state text not null default 'unknown',
  note text not null default ''
);
create index if not exists ancla_observations_user_time on ancla_observations (user_id, at desc);

-- Ids de mensajes de WhatsApp ya procesados (Meta reintenta los webhooks).
create table if not exists ancla_inbound_ids (
  id text primary key,
  created_at timestamptz not null default now()
);

-- El bot entra con la service role key desde el servidor. En los proyectos nuevos de Supabase las
-- tablas no se exponen a la API automáticamente, así que se le da acceso explícito, y solo a ese rol
-- (anon y authenticated no pueden leer nada). En un Postgres sin ese rol, este bloque no hace nada.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
    grant select, insert, update, delete on
      ancla_users, ancla_items, ancla_messages, ancla_inbound_ids, ancla_reminders, ancla_observations
      to service_role;
    grant usage, select on all sequences in schema public to service_role;
  end if;
end $$;

alter table ancla_users enable row level security;
alter table ancla_items enable row level security;
alter table ancla_messages enable row level security;
alter table ancla_inbound_ids enable row level security;
alter table ancla_reminders enable row level security;
alter table ancla_observations enable row level security;

-- Si ya habías creado las tablas antes de la versión con voz y rutinas, corre esto una vez:
alter table ancla_users add column if not exists voice text not null default '';
alter table ancla_users add column if not exists routines text[] not null default '{}';
alter table ancla_users add column if not exists profile text not null default '';
alter table ancla_users add column if not exists people jsonb not null default '[]';
-- (las tablas ancla_reminders y ancla_observations de arriba ya usan 'if not exists': corre el archivo completo.)

-- Mensajes a medias (noviembre 2026): cada mensaje entrante queda 'pending' con su contenido hasta que se
-- contesta; si el servidor se reinicia a mitad de camino, se retoma. Al terminar se borran el contenido y el número.
alter table ancla_inbound_ids add column if not exists status text not null default 'done';
alter table ancla_inbound_ids add column if not exists phone text;
alter table ancla_inbound_ids add column if not exists payload jsonb;
alter table ancla_inbound_ids add column if not exists attempts int not null default 0;
create index if not exists ancla_inbound_pending on ancla_inbound_ids (created_at) where status = 'pending';
notify pgrst, 'reload schema';
