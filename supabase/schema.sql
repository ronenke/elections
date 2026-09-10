-- Full schema (fresh install). Run once in Supabase → SQL Editor → New query → Run.
-- If you installed version 1 (tables election_state + snapshots) run migration-002.sql instead.

create table if not exists elections (
  id text primary key,
  name text not null default '',
  status text not null default 'open',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists snapshots (
  id bigserial primary key,
  election_id text not null references elections(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text not null default '',
  data jsonb not null
);
create index if not exists snapshots_election_idx on snapshots(election_id, id desc);

create table if not exists app_settings (
  key text primary key,
  value text
);

-- The app talks to the database only from the server with the service-role key; lock everything else out.
alter table elections enable row level security;
alter table snapshots enable row level security;
alter table app_settings enable row level security;
