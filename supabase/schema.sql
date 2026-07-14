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
-- Row Level Security
-- This is an internal tool without user auth, so we allow the anon key full
-- access. If you later add Supabase Auth, tighten these policies.
-- ---------------------------------------------------------------------------
alter table public.freelancers enable row level security;
alter table public.leads       enable row level security;
alter table public.clients     enable row level security;
alter table public.payments    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['freelancers','leads','clients','payments'] loop
    execute format('drop policy if exists "allow all" on public.%I;', t);
    execute format(
      'create policy "allow all" on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
