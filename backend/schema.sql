create table if not exists public.entitlements (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null default 'free' check (plan in ('free','premium'))
);
alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
create policy "Read own entitlement" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
