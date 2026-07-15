-- Multi-freelancer support: a project (client) can be assigned to 2+ freelancers.
-- Run once in Supabase → SQL Editor.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Assignments join table (client ↔ freelancers, each with their own fee)
-- ---------------------------------------------------------------------------
create table if not exists public.client_freelancers (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  freelancer_id  uuid not null references public.freelancers(id) on delete cascade,
  fee            numeric(12,2) not null default 0,
  created_at     timestamptz not null default now(),
  unique (client_id, freelancer_id)
);

create index if not exists client_freelancers_client_id_idx
  on public.client_freelancers(client_id);
create index if not exists client_freelancers_freelancer_id_idx
  on public.client_freelancers(freelancer_id);

-- ---------------------------------------------------------------------------
-- Payment milestones belong to a specific freelancer on the project
-- ---------------------------------------------------------------------------
alter table public.freelancer_payments
  add column if not exists freelancer_id uuid references public.freelancers(id) on delete set null;

create index if not exists freelancer_payments_freelancer_id_idx
  on public.freelancer_payments(freelancer_id);

-- ---------------------------------------------------------------------------
-- Migrate existing single-freelancer data into the join table
-- ---------------------------------------------------------------------------
insert into public.client_freelancers (client_id, freelancer_id, fee)
select c.id, c.freelancer_id, coalesce(c.freelancer_payment, 0)
from public.clients c
where c.freelancer_id is not null
  and not exists (
    select 1 from public.client_freelancers cf
    where cf.client_id = c.id and cf.freelancer_id = c.freelancer_id
  );

-- Tag existing payment rows with the client's legacy freelancer
update public.freelancer_payments fp
set freelancer_id = c.freelancer_id
from public.clients c
where fp.client_id = c.id
  and fp.freelancer_id is null
  and c.freelancer_id is not null;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.client_freelancers enable row level security;

drop policy if exists "team access" on public.client_freelancers;
create policy "team access" on public.client_freelancers
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on public.client_freelancers to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
