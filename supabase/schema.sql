-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).
create table if not exists election_state (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists snapshots (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  note text not null default '',
  data jsonb not null
);
-- The app talks to the database only from the server with the service-role key,
-- so lock the tables for everyone else.
alter table election_state enable row level security;
alter table snapshots enable row level security;
