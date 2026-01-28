-- 002_next_level.sql
-- Run this in Supabase SQL editor (once) to add the new “fast win” features.

-- 1) Orders: pinned + internal notes + customer last viewed
alter table if exists public.orders
  add column if not exists pinned boolean not null default false,
  add column if not exists internal_note text null,
  add column if not exists customer_last_viewed_at timestamptz null;

-- 2) Standardize statuses
update public.orders set status = 'open' where status is null or status = 'draft';
update public.orders set status = 'rejected' where status = 'changes_requested';

alter table if exists public.orders drop constraint if exists orders_status_check;
alter table if exists public.orders
  add constraint orders_status_check check (status in ('open','proof_sent','approved','approved_with_notes','rejected'));

-- 3) Proof files: primary flag (for “main preview”)
alter table if exists public.proof_files
  add column if not exists is_primary boolean not null default false;

-- 4) Order events timeline
create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  type text not null,
  actor_type text not null,
  message text null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists order_events_order_id_created_at_idx
  on public.order_events(order_id, created_at desc);

-- 5) Helpful indexes for admin list
create index if not exists orders_pinned_created_at_idx
  on public.orders(pinned desc, created_at desc);
