-- Editable plan defaults and nullable per-customer overrides. Existing access is preserved.
create function printer_private.valid_tools(tools text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select tools is not null and array_position(tools, null) is null and tools <@
    array['card-montage','sequential-number','booklet-montage','hardcover-cover','cutter-montage','fast-print']::text[];
$$;
revoke all on function printer_private.valid_tools(text[]) from public, anon;
grant execute on function printer_private.valid_tools(text[]) to authenticated;

create table public.printer_subscription_plans (
  plan text primary key check (plan in ('pro','shop')),
  tool_ids text[] not null check (printer_private.valid_tools(tool_ids)),
  batch_exports boolean not null
);
insert into public.printer_subscription_plans values
  ('pro', array['card-montage','sequential-number','booklet-montage','hardcover-cover','cutter-montage','fast-print'], false),
  ('shop', array['card-montage','sequential-number','booklet-montage','hardcover-cover','cutter-montage','fast-print'], true);
alter table public.printer_subscription_plans enable row level security;
revoke all on public.printer_subscription_plans from public, anon, authenticated;
grant select, update on public.printer_subscription_plans to authenticated;
create policy printer_plans_read on public.printer_subscription_plans for select to authenticated
using ((select printer_private.is_verified()));
create policy printer_plans_change on public.printer_subscription_plans for update to authenticated
using ((select printer_private.is_admin())) with check ((select printer_private.is_admin()));

alter table public.printer_access_grants
  add column tool_ids text[] check (tool_ids is null or printer_private.valid_tools(tool_ids)),
  add column batch_exports boolean;

create function printer_private.audit_plan_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  insert into public.printer_access_audit(actor_id,user_id,action,details)
  values (auth.uid(),auth.uid(),'subscription_plan:update',jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)));
  return new;
end;
$$;
revoke all on function printer_private.audit_plan_change() from public, anon, authenticated;
create trigger printer_plan_audit after update on public.printer_subscription_plans
for each row execute function printer_private.audit_plan_change();

create function public.printer_admin_plan(p_plan text,p_tool_ids text[],p_batch_exports boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  if p_plan is null or p_plan not in ('pro','shop') or not printer_private.valid_tools(p_tool_ids) or p_batch_exports is null then
    raise exception 'Invalid subscription plan';
  end if;
  update public.printer_subscription_plans set tool_ids=p_tool_ids,batch_exports=p_batch_exports where plan=p_plan;
end;
$$;

create function public.printer_admin_subscription(p_user_id uuid,p_plan text,p_tool_ids text[],p_batch_exports boolean,p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  if p_user_id is null or p_plan is null or p_plan not in ('pro','shop') or
    (p_tool_ids is not null and not printer_private.valid_tools(p_tool_ids)) or p_reason is null or length(p_reason)>1000 then
    raise exception 'Invalid subscription settings';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  update public.printer_access_grants set plan=p_plan,tool_ids=p_tool_ids,batch_exports=p_batch_exports,reason=p_reason
  where user_id=p_user_id;
  if not found then raise exception 'Grant access before managing a subscription'; end if;
end;
$$;

create or replace function public.printer_access_snapshot() returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not printer_private.is_verified() then raise exception 'Verified account required'; end if;
  return jsonb_build_object('server_now',now(),'is_admin',printer_private.is_admin(),
    'grant',(select to_jsonb(g) from public.printer_access_grants g where g.user_id=auth.uid()),
    'allowed_tools',coalesce((select to_jsonb(coalesce(g.tool_ids,p.tool_ids)) from public.printer_access_grants g
      join public.printer_subscription_plans p on p.plan=g.plan where g.user_id=auth.uid()),'[]'::jsonb),
    'batch_exports',coalesce((select coalesce(g.batch_exports,p.batch_exports) from public.printer_access_grants g
      join public.printer_subscription_plans p on p.plan=g.plan where g.user_id=auth.uid()),false),
    'request',(select to_jsonb(r) from public.printer_access_requests r where r.user_id=auth.uid() order by r.created_at desc,r.id desc limit 1));
end;
$$;

create or replace function public.printer_admin_list() returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  return jsonb_build_object(
    'plans',(select jsonb_agg(p order by plan) from public.printer_subscription_plans p),
    'customers',coalesce((select jsonb_agg(t) from (select * from public.printer_profiles order by created_at desc limit 1000) t),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(t) from (select * from public.printer_access_requests order by (status='pending') desc,created_at desc limit 1000) t),'[]'::jsonb),
    'grants',coalesce((select jsonb_agg(t) from (select * from public.printer_access_grants order by ends_at desc limit 1000) t),'[]'::jsonb),
    'audit',coalesce((select jsonb_agg(t) from (select * from public.printer_access_audit order by created_at desc limit 100) t),'[]'::jsonb),
    'hasMore',(select count(*)>1000 from public.printer_profiles) or (select count(*)>1000 from public.printer_access_requests) or (select count(*)>1000 from public.printer_access_grants));
end;
$$;

revoke all on function public.printer_admin_plan(text,text[],boolean),public.printer_admin_subscription(uuid,text,text[],boolean,text) from public,anon;
grant execute on function public.printer_admin_plan(text,text[],boolean),public.printer_admin_subscription(uuid,text,text[],boolean,text) to authenticated;

-- Revocation preserves the original subscription dates, plan and overrides.
create or replace function public.printer_admin_action(p_action text, p_user_id uuid, p_request_id uuid, p_plan text, p_days integer, p_reason text) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  request_row public.printer_access_requests;
  grant_row public.printer_access_grants;
  end_time timestamptz;
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  if p_action is null or p_action not in ('approve', 'deny', 'trial', 'grant', 'extend', 'revoke') then raise exception 'Invalid access action'; end if;
  if p_plan is null or p_plan not in ('pro', 'shop') or p_days is null or p_days not between 1 and 3650 or p_reason is null or length(p_reason) > 1000 then raise exception 'Invalid plan, duration, or reason'; end if;
  -- Serialize all decisions for this customer, including two owners approving concurrently.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if not exists (select 1 from public.printer_profiles where id = p_user_id) then raise exception 'Customer not found'; end if;
  if p_action in ('approve', 'deny') then
    select * into request_row from public.printer_access_requests where id = p_request_id and user_id = p_user_id for update;
    if request_row.id is null or request_row.status <> 'pending' then raise exception 'This request has already been reviewed or does not exist'; end if;
  end if;
  if p_action <> 'deny' then
    select * into grant_row from public.printer_access_grants where user_id = p_user_id for update;
    if p_action = 'revoke' and grant_row.user_id is not null then
      update public.printer_access_grants set status='revoked',reason=p_reason where user_id=p_user_id;
      return;
    end if;
    if p_action = 'extend' then
      if grant_row.user_id is null or grant_row.status = 'revoked' then raise exception 'Grant or reinstate access before extending it'; end if;
      end_time := greatest(now(), grant_row.ends_at) + make_interval(days => p_days);
    else
      end_time := now() + make_interval(days => p_days);
    end if;
    insert into public.printer_access_grants(user_id, plan, status, starts_at, ends_at, reason)
    values (p_user_id, case when p_action = 'extend' then grant_row.plan else p_plan end,
      case when p_action = 'revoke' then 'revoked' when p_action = 'trial' then 'trial' when p_action = 'extend' then grant_row.status else 'active' end,
      case when p_action = 'extend' then grant_row.starts_at else now() end, end_time, p_reason)
    on conflict (user_id) do update set plan = excluded.plan, status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at, reason = excluded.reason;
  end if;
  if p_action in ('approve', 'deny') then
    update public.printer_access_requests set status = case when p_action = 'deny' then 'denied' else 'approved' end,
      reviewed_at = now(), reviewed_by = auth.uid(), decision_reason = p_reason where id = request_row.id;
  elsif p_action in ('trial', 'grant') then
    update public.printer_access_requests set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid(), decision_reason = p_reason
    where user_id = p_user_id and status = 'pending';
  end if;
end;
$$;

