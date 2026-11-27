begin;
alter table public.chatlens_payments drop constraint if exists chatlens_payments_plan_check;
alter table public.chatlens_payments add constraint chatlens_payments_plan_check
  check (plan = any (array['free'::text,'detailed_analysis'::text,'premium_report'::text,'premium'::text,'business'::text]));
alter table public.chatlens_purchases add column if not exists report_id uuid, add column if not exists consumed_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname='chatlens_purchases_report_consumption_check' and conrelid='public.chatlens_purchases'::regclass) then
    alter table public.chatlens_purchases add constraint chatlens_purchases_report_consumption_check
      check ((report_id is null and consumed_at is null) or (report_id is not null and consumed_at is not null));
  end if;
end
$$;
create unique index if not exists chatlens_purchases_report_once on public.chatlens_purchases(report_id) where report_id is not null;
create index if not exists chatlens_purchases_available_detailed on public.chatlens_purchases(user_id,created_at,id) where product='detailed_analysis' and active=true and test_mode=false and report_id is null;
alter table public.chatlens_purchases enable row level security;
revoke all on public.chatlens_purchases from public,anon,authenticated;
grant select on public.chatlens_purchases to authenticated;
grant update (report_id,consumed_at) on public.chatlens_purchases to authenticated;
drop policy if exists purchase_consume_own on public.chatlens_purchases;
create policy purchase_consume_own on public.chatlens_purchases for update to authenticated
  using ((select auth.uid())=user_id and product='detailed_analysis' and active=true and test_mode=false and report_id is null and consumed_at is null)
  with check ((select auth.uid())=user_id and product='detailed_analysis' and active=true and test_mode=false and report_id is not null and consumed_at is not null);
create or replace function public.chatlens_consume_detailed_analysis(p_report_id uuid)
returns boolean language plpgsql set search_path=''
as $function$
declare uid uuid := auth.uid(); purchase_id uuid;
begin
  if uid is null or p_report_id is null then return false; end if;
  if exists (select 1 from public.chatlens_purchases p where p.user_id=uid and p.product='detailed_analysis' and p.active=true and p.test_mode=false and p.report_id=p_report_id) then return true; end if;
  select p.id into purchase_id from public.chatlens_purchases p
    where p.user_id=uid and p.product='detailed_analysis' and p.active=true and p.test_mode=false and p.report_id is null and p.consumed_at is null
    order by p.created_at,p.id for update skip locked limit 1;
  if purchase_id is null then return false; end if;
  begin
    update public.chatlens_purchases set report_id=p_report_id,consumed_at=now()
      where id=purchase_id and user_id=uid and product='detailed_analysis' and active=true and test_mode=false and report_id is null and consumed_at is null;
    return found;
  exception when unique_violation then
    return exists (select 1 from public.chatlens_purchases p where p.user_id=uid and p.product='detailed_analysis' and p.active=true and p.test_mode=false and p.report_id=p_report_id);
  end;
end
$function$;
revoke all on function public.chatlens_consume_detailed_analysis(uuid) from public,anon,authenticated;
grant execute on function public.chatlens_consume_detailed_analysis(uuid) to authenticated;
create or replace function public.chatlens_activate_purchase()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if new.status='paid' and new.verified_at is not null and new.razorpay_payment_id is not null
    and ((new.plan='detailed_analysis' and new.amount=29900 and new.currency='INR')
      or (new.plan='premium_report' and new.amount=9900 and new.currency='INR')) then
    insert into public.chatlens_purchases(user_id,payment_id,product,active,test_mode)
      values(new.user_id,new.id,new.plan,not new.test_mode,new.test_mode)
      on conflict(payment_id) do nothing;
  end if;
  if new.status='refunded' then update public.chatlens_purchases set active=false where payment_id=new.id; end if;
  return new;
end
$function$;
revoke all on function public.chatlens_activate_purchase() from public,anon,authenticated;
commit;