begin;
create table if not exists public.chatlens_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (char_length(trim(full_name)) between 1 and 120),
 birthday date check (birthday <= current_date),
 country text check (char_length(country)<=100),
 marketing_consent boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.chatlens_profiles enable row level security;
revoke all on public.chatlens_profiles from public, anon, authenticated;
grant select on public.chatlens_profiles to authenticated;
grant insert (user_id,full_name,birthday,country,marketing_consent), update (full_name,birthday,country,marketing_consent) on public.chatlens_profiles to authenticated;
grant all on public.chatlens_profiles to service_role;
drop policy if exists profile_read_own on public.chatlens_profiles;
create policy profile_read_own on public.chatlens_profiles for select to authenticated using (auth.uid()=user_id);
drop policy if exists profile_insert_own on public.chatlens_profiles;
create policy profile_insert_own on public.chatlens_profiles for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists profile_update_own on public.chatlens_profiles;
create policy profile_update_own on public.chatlens_profiles for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
commit;