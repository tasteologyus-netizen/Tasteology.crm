-- Tasteology & Co CRM — database schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run)
-- Safe to re-run: uses "if not exists" and "create or replace" where possible.

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Freelancers
-- ---------------------------------------------------------------------------
create table if not exists public.freelancers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  specialty   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Leads (pipeline). Source: 'manual' | 'calendly'. Status flow:
-- 'new' -> 'booked' -> 'quoted' -> 'won'
-- When a lead is marked 'won' the app creates a matching client row.
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text,
  phone         text,
  project_brief text,
  zoom_link     text,
  source        text not null default 'manual',
  status        text not null default 'new',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Clients (a Won lead => signed project)
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  lead_id            uuid references public.leads(id) on delete set null,
  full_name          text not null,
  email              text,
  phone              text,
  project_brief      text,
  zoom_link          text,
  total_amount       numeric(12,2) not null default 0,
  freelancer_id      uuid references public.freelancers(id) on delete set null,
  freelancer_payment numeric(12,2) not null default 0,
  freelancer_paid    boolean not null default false,
  freelancer_paid_at timestamptz,
  won_at             timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Payment milestones (First / Second / Third payment per client)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  label       text not null,
  sort_order  int  not null default 0,
  amount      numeric(12,2) not null default 0,
  is_paid     boolean not null default false,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists payments_client_id_idx on public.payments(client_id);
create index if not exists clients_freelancer_id_idx on public.clients(freelancer_id);

-- ---------------------------------------------------------------------------
-- Freelancer payment milestones (pay a freelancer in installments per project)
-- ---------------------------------------------------------------------------
create table if not exists public.freelancer_payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  label       text not null,
  sort_order  int  not null default 0,
  amount      numeric(12,2) not null default 0,
  is_paid     boolean not null default false,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists freelancer_payments_client_id_idx on public.freelancer_payments(client_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Access requires a signed-in user (Supabase Auth). Any authenticated team
-- member has full read/write access; anonymous requests are blocked.
-- Create team logins in Supabase → Authentication → Users, or via the app's
-- "Create account" screen.
-- ---------------------------------------------------------------------------
alter table public.freelancers        enable row level security;
alter table public.leads              enable row level security;
alter table public.clients            enable row level security;
alter table public.payments           enable row level security;
alter table public.freelancer_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array['freelancers','leads','clients','payments','freelancer_payments'] loop
    execute format('drop policy if exists "allow all" on public.%I;', t);
    execute format('drop policy if exists "team access" on public.%I;', t);
    execute format(
      'create policy "team access" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Table privileges
-- RLS decides which ROWS are visible, but the role still needs table-level
-- GRANTs or Postgres raises "permission denied for table". Give signed-in
-- users full access; the anon role only needs schema usage.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Apply the same defaults to any tables/sequences created later.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
