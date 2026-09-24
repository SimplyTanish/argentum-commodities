-- ============================================================
-- ARGENTUM COMMODITIES — Supabase schema
-- RFQs · Suppliers · Contacts + RLS + Realtime
-- ============================================================

-- ---------- RFQs from buyers ----------
create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  company_name text not null,
  contact_person text not null,
  phone text not null,
  email text,

  commodity text not null,
  purity text,
  quantity numeric,
  delivery_city text,
  required_date date,
  notes text,

  status text not null default 'Pending',
  assigned_suppliers uuid[] default '{}'
);

comment on column public.rfqs.status is 'Pending | Verified | Quoting | Negotiating | Won | Lost';

-- ---------- Supplier registrations ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  company_name text not null,
  gst text,
  contact_person text not null,
  phone text not null,
  email text,

  commodity text,
  moq text,
  cities text,
  notes text,

  verified boolean not null default false
);

-- ---------- Internal CRM contacts ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  company_name text,
  person text,
  phone text,
  email text,

  type text,      -- 'Buyer' or 'Supplier'
  city text,
  remarks text
);

-- ---------- RLS ----------
alter table public.rfqs enable row level security;
alter table public.suppliers enable row level security;
alter table public.contacts enable row level security;

-- Public site: anyone may submit a buyer enquiry (insert only).
create policy "public can insert rfqs"
  on public.rfqs for insert
  to anon, authenticated
  with check (true);

-- Public site: anyone may register as a supplier (insert only).
create policy "public can insert suppliers"
  on public.suppliers for insert
  to anon, authenticated
  with check (true);

-- Staff (any authenticated user — internal project, signups locked):
-- full read/write on all three tables.
create policy "staff can read rfqs"
  on public.rfqs for select to authenticated using (true);
create policy "staff can update rfqs"
  on public.rfqs for update to authenticated using (true);

create policy "staff can read suppliers"
  on public.suppliers for select to authenticated using (true);
create policy "staff can update suppliers"
  on public.suppliers for update to authenticated using (true);

create policy "staff can read contacts"
  on public.contacts for select to authenticated using (true);
create policy "staff can insert contacts"
  on public.contacts for insert to authenticated with check (true);
create policy "staff can update contacts"
  on public.contacts for update to authenticated using (true);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.rfqs;
alter publication supabase_realtime add table public.suppliers;
alter publication supabase_realtime add table public.contacts;

grant usage on schema public to anon, authenticated;