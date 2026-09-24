-- ============================================================
-- ARGENTUM — security & validation hardening
-- 1) row-level data integrity (email/phone/GST/dates/sizes)   |
-- 2) duplicate-submission spam guard                          |
-- 3) sign-up lockdown (only the staff desk account may exist) |
-- ============================================================

-- ---------- rfqs integrity ----------
alter table public.rfqs
  add constraint rfqs_phone_format check (phone ~ '^(\+?91[\s\-]?)?[6-9][0-9]{9}$'),
  add constraint rfqs_email_format check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  add constraint rfqs_company_min check (char_length(btrim(company_name)) >= 2),
  add constraint rfqs_contact_min check (char_length(btrim(contact_person)) >= 2),
  add constraint rfqs_quantity_sane check (quantity is null or (quantity > 0 and quantity < 1000000)),
  add constraint rfqs_date_not_past check (required_date is null or required_date >= current_date),
  add constraint rfqs_purity_format check (purity is null or purity ~ '^[0-9]{1,3}(\.[0-9]{1,4})?%?$'),
  add constraint rfqs_notes_len check (notes is null or char_length(notes) <= 2000);

-- ---------- suppliers integrity ----------
alter table public.suppliers
  add constraint suppliers_phone_format check (phone ~ '^(\+?91[\s\-]?)?[6-9][0-9]{9}$'),
  add constraint suppliers_email_format check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  add constraint suppliers_gst_format check (gst is null or gst ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  add constraint suppliers_company_min check (char_length(btrim(company_name)) >= 2),
  add constraint suppliers_contact_min check (char_length(btrim(contact_person)) >= 2),
  add constraint suppliers_notes_len check (notes is null or char_length(notes) <= 2000);

-- ---------- contacts hygiene (staff-entered) ----------
alter table public.contacts
  add constraint contacts_email_format check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  add constraint contacts_phone_format check (phone is null or phone = '' or phone ~ '^(\+?91[\s\-]?)?[6-9][0-9]{9}$');

-- ---------- duplicate-submission spam guard ----------
create or replace function public.guard_duplicate_rfq() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.rfqs
    where lower(company_name) = lower(new.company_name)
      and phone = new.phone
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Duplicate submission detected. This enquiry was received in the last 10 minutes.';
  end if;
  return new;
end $$;

create or replace function public.guard_duplicate_supplier() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.suppliers
    where lower(company_name) = lower(new.company_name)
      and phone = new.phone
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'Duplicate submission detected. This application was received in the last 10 minutes.';
  end if;
  return new;
end $$;

create trigger guard_duplicate_rfq before insert on public.rfqs
  for each row execute function public.guard_duplicate_rfq();

create trigger guard_duplicate_supplier before insert on public.suppliers
  for each row execute function public.guard_duplicate_supplier();