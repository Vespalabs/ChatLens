begin;
create table if not exists public.chatlens_feedback(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,rating integer not null check(rating between 1 and 5),recommend boolean not null,comments text not null check(char_length(comments)<=2000),created_at timestamptz not null default now(),unique(user_id));
alter table public.chatlens_feedback enable row level security;
revoke all on public.chatlens_feedback from public,anon,authenticated;
grant insert(rating,recommend,comments) on public.chatlens_feedback to authenticated;
drop policy if exists feedback_insert on public.chatlens_feedback;
create policy feedback_insert on public.chatlens_feedback for insert to authenticated with check(user_id=auth.uid());
create or replace function public.chatlens_is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.chatlens_admins where user_id=auth.uid()) $$;
create or replace function public.chatlens_admin_dashboard() returns jsonb language plpgsql security definer set search_path='' as $$
begin
if not public.chatlens_is_admin() then raise exception 'Access denied' using errcode='42501'; end if;
return jsonb_build_object(
'registered',(select count(*) from auth.users),
'verified',(select count(*) from auth.users where email_confirmed_at is not null),
'active7',(select count(*) from auth.users where last_sign_in_at>=now()-interval '7 days'),
'credits',(select coalesce(sum(used),0) from public.chatlens_usage),
'exhausted',(select count(*) from public.chatlens_usage where used=3),
'feedback_count',(select count(*) from public.chatlens_feedback),
'rating',(select round(avg(rating),2) from public.chatlens_feedback),
'recommendation',(select round(avg(case when recommend then 100.0 else 0.0 end),1) from public.chatlens_feedback),
'open_tickets',(select count(*) from public.chatlens_support where status in ('open','in_progress')),
'test_paid',(select count(*) from public.chatlens_payments where test_mode and status='paid'),
'live_paid',(select count(*) from public.chatlens_payments where not test_mode and status='paid'),
'users',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select u.email,u.created_at,u.last_sign_in_at,u.email_confirmed_at,coalesce(q.used,0) as used from auth.users u left join public.chatlens_usage q on q.user_id=u.id order by u.created_at desc limit 100)x),
'feedback',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select rating,recommend,comments,created_at from public.chatlens_feedback order by created_at desc limit 100)x),
'tickets',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (select subject,category,message,status,created_at from public.chatlens_support order by created_at desc limit 100)x));
end $$;
revoke all on function public.chatlens_is_admin() from public,anon,authenticated;
revoke all on function public.chatlens_admin_dashboard() from public,anon,authenticated;
grant execute on function public.chatlens_is_admin() to authenticated;
grant execute on function public.chatlens_admin_dashboard() to authenticated;
commit;