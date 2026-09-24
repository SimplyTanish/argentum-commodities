alter policy "staff can read rfqs" on public.rfqs
  to authenticated
  using (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');

alter policy "staff can update rfqs" on public.rfqs
  to authenticated
  using (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com')
  with check (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');

alter policy "staff can read suppliers" on public.suppliers
  to authenticated
  using (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');

alter policy "staff can update suppliers" on public.suppliers
  to authenticated
  using (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com')
  with check (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');

alter policy "staff can read contacts" on public.contacts
  to authenticated
  using (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');

alter policy "staff can insert contacts" on public.contacts
  to authenticated
  with check (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');

alter policy "staff can update contacts" on public.contacts
  to authenticated
  using (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com')
  with check (auth.jwt() ->> 'email' = 'desk@argentumcommodities.com');