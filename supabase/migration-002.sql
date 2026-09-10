-- Migration from version 1 (single election in `election_state`) to version 2 (multiple elections).
-- Safe to run more than once. Run in Supabase → SQL Editor → New query → paste → Run.

create table if not exists elections (
  id text primary key,
  name text not null default '',
  status text not null default 'open',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists app_settings (key text primary key, value text);
alter table elections enable row level security;
alter table app_settings enable row level security;

-- snapshots: add election_id (old rows get the migrated election's id below)
alter table snapshots add column if not exists election_id text;
create index if not exists snapshots_election_idx on snapshots(election_id, id desc);

-- copy the existing single election (if any) into the new table, once
do $$
declare
  old_row record;
  new_id text := 'e-migrated-v1';
begin
  if exists (select 1 from information_schema.tables where table_name = 'election_state')
     and not exists (select 1 from elections where id = new_id) then
    select * into old_row from election_state where id = 1;
    if found then
      insert into elections (id, name, status, data, created_at, updated_at)
      values (
        new_id,
        coalesce(old_row.data->'election'->>'name', ''),
        'open',
        old_row.data || jsonb_build_object('id', new_id, 'status', 'open', 'createdAt', to_jsonb(old_row.updated_at)),
        old_row.updated_at,
        old_row.updated_at
      );
      update snapshots set election_id = new_id where election_id is null;
      insert into app_settings (key, value) values ('active_election', new_id)
        on conflict (key) do update set value = excluded.value;
    end if;
  end if;
end $$;

-- old snapshots without an election (if there was no election_state row) are removed
delete from snapshots where election_id is null;
alter table snapshots alter column election_id set not null;

-- the old table is no longer used; keep it for a while as a backup, or drop it:
-- drop table election_state;
