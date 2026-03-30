-- Statistik-E-Mail-Berichte (Account-Einstellungen + Cron)
-- In Supabase SQL Editor ausführen oder als Migration anwenden.

create table if not exists public.statistics_email_reports (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  emails text[] not null default '{}',
  send_interval_days integer not null default 7,
  period_days integer not null default 7,
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint statistics_email_reports_send_interval_days_check
    check (send_interval_days >= 1 and send_interval_days <= 365),
  constraint statistics_email_reports_period_days_check
    check (period_days >= 1 and period_days <= 365),
  constraint statistics_email_reports_admin_unique unique (admin_user_id)
);

create index if not exists idx_statistics_email_reports_next_run
  on public.statistics_email_reports (next_run_at)
  where enabled = true;

comment on table public.statistics_email_reports is 'Gebäudenavi: E-Mail-Berichte zu Video-Aufrufen je Admin-Account';
