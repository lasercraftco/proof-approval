-- Proof Approval App (MVP) schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text,
  customer_email text not null,
  sku text,
  quantity integer,
  status text not null default 'draft' check (status in (
    'draft',
    'open',
    'proof_sent',
    'approved',
    'approved_with_notes',
    'changes_requested'
  )),
  customer_last_activity_at timestamptz,
  customer_decision_at timestamptz,
  reminder_count integer not null default 0,
  last_reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Admin-configurable settings (single row id='default')
create table if not exists app_settings (
  id text primary key,
  company_name text not null default 'The Lasercraft Company',
  accent_color text not null default '#1d3161',
  logo_data_url text,
  email_from_name text not null default 'The Lasercraft Company',
  email_from_email text not null default 'proofs@thelasercraft.co',
  staff_notify_email text not null default 'proofs@thelasercraft.co',
  templates jsonb not null default '{}'::jsonb,
  reminder_config jsonb not null default '{"enabled": true, "first_reminder_days": 3, "second_reminder_days": 7, "max_reminders": 2}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into app_settings(id) values ('default')
on conflict (id) do nothing;

create table if not exists proof_versions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  version_number integer not null,
  staff_note text,
  created_at timestamptz not null default now(),
  unique(order_id, version_number)
);

create table if not exists proof_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references proof_versions(id) on delete cascade,
  original_path text not null,
  preview_path text not null,
  filename text not null,
  mime_type text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  author_type text not null check (author_type in ('customer','staff')),
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  file_path text not null,
  filename text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  actor_type text not null check (actor_type in ('customer','staff','system')),
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_versions_order on proof_versions(order_id, version_number desc);
create index if not exists idx_files_version on proof_files(version_id, sort_order asc);
create index if not exists idx_messages_thread on messages(thread_id, created_at asc);
create index if not exists idx_audit_order on audit_events(order_id, created_at desc);
