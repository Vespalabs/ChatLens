begin;
create table if not exists public.chatlens_usage(user_id uuid primary key references auth.users(id) on delete cascade, used integer not null default 0 check(used between 0 and 3));
alter table public.chatlens_usage enable row level security;
revoke all on public.chatlens_usage from public, anon, authenticated;
grant select on public.chatlens_usage to authenticated;
drop policy if exists usage_own on public.chatlens_usage;
create policy usage_own on public.chatlens_usage for select to authenticated using(auth.uid()=user_id);
create or replace function public.chatlens_consume_analysis() returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); n integer;
begin
if uid is null then raise exception 'Sign in required'; end if;
insert into public.chatlens_usage(user_id,used) values(uid,1) on conflict(user_id) do update set used=public.chatlens_usage.used+1 where public.chatlens_usage.used<3 returning used into n;
if n is null then return -1; end if;
return 3-n;
end; $$;
revoke all on function public.chatlens_consume_analysis() from public,anon,authenticated;
grant execute on function public.chatlens_consume_analysis() to authenticated;
commit;