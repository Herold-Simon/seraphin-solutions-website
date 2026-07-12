-- =====================================================================
-- Produktmodus-Schema (Phase C)
--
-- Kontobezogene Tabellen fuer Produkte, Produktkategorien und deren
-- Zuordnungen. Die Desktop-App seedet/aktualisiert die Daten (source='device'),
-- die Website macht CRUD (source='web'). Exportierte Web-Versionen lesen live
-- ueber den Anon-Key (nur SELECT). Konfliktloesung: Last-Writer-Wins ueber
-- updated_at; Loeschungen werden per Soft-Delete (deleted=true) synchronisiert.
--
-- In der Supabase-SQL-Konsole ausfuehren.
-- =====================================================================

-- Konto-Flag: aktiviert den Produktmodus fuer dieses Konto.
alter table public.accounts
  add column if not exists product_mode boolean not null default false;

-- ---------------------------------------------------------------------
-- Produkte (kontobezogen)
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  product_id text not null,
  title text default '',
  per_language jsonb default '{}'::jsonb,      -- { langId: { title } }
  keywords jsonb default '[]'::jsonb,
  image text,                                   -- Base64 (wie Label-Icons)
  route_id text,                                -- verknuepfte Route (null = keine)
  is_placeholder boolean not null default false,
  "order" integer not null default 0,
  source text not null default 'device',        -- 'device' | 'web'
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (account_id, product_id)
);
create index if not exists products_account_idx on public.products(account_id);

-- ---------------------------------------------------------------------
-- Produktkategorien (kontobezogen)
-- ---------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id text not null,
  title text default '',
  per_language jsonb default '{}'::jsonb,        -- { langId: { title } }
  keywords jsonb default '[]'::jsonb,
  image text,                                     -- Base64
  "order" integer not null default 0,
  source text not null default 'device',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (account_id, category_id)
);
create index if not exists product_categories_account_idx on public.product_categories(account_id);

-- ---------------------------------------------------------------------
-- Zuordnung Produkt <-> Produktkategorie (many-to-many, kontobezogen)
-- ---------------------------------------------------------------------
create table if not exists public.product_category_assignments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  product_id text not null,
  category_id text not null,
  "order" integer not null default 0,
  source text not null default 'device',
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (account_id, product_id, category_id)
);
create index if not exists product_category_assignments_account_idx
  on public.product_category_assignments(account_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- Anon-Key darf NUR lesen (die exportierte Web-Version filtert nach account_id).
-- Schreibzugriff laeuft ausschliesslich ueber die API mit dem Service-Role-Key,
-- der RLS umgeht. Kein INSERT/UPDATE/DELETE-Policy fuer anon => kein Schreibzugriff.
-- ---------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_category_assignments enable row level security;

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (true);

drop policy if exists "product_categories_public_read" on public.product_categories;
create policy "product_categories_public_read" on public.product_categories for select using (true);

drop policy if exists "product_category_assignments_public_read" on public.product_category_assignments;
create policy "product_category_assignments_public_read" on public.product_category_assignments for select using (true);
