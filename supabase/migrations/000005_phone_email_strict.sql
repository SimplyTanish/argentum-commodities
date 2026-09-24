-- ============================================================
-- ARGENTUM — 10-digit-only phone + stricter email domain.
-- India-only market: no +91 / 12-digit numbers are accepted.
-- Email must be a real-looking domain (not a placeholder).
-- ============================================================

alter table public.rfqs
  drop constraint rfqs_phone_format,
  drop constraint rfqs_email_format,
  add constraint rfqs_phone_format check (phone ~ '^[6-9][0-9]{9}$'),
  add constraint rfqs_email_format check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$');

alter table public.suppliers
  drop constraint suppliers_phone_format,
  drop constraint suppliers_email_format,
  add constraint suppliers_phone_format check (phone ~ '^[6-9][0-9]{9}$'),
  add constraint suppliers_email_format check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$');

alter table public.contacts
  drop constraint contacts_email_format,
  drop constraint contacts_phone_format,
  add constraint contacts_email_format check (email is null or email = '' or email ~* '^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$'),
  add constraint contacts_phone_format check (phone is null or phone = '' or phone ~ '^[6-9][0-9]{9}$');