-- Free account approval backend. No billing service or client-side admin secrets.
create schema if not exists printer_private;
revoke all on schema printer_private from public, anon, authenticated;
grant usage on schema printer_private to authenticated;

create table printer_private.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table printer_private.admin_memberships enable row level security;
revoke all on printer_private.admin_memberships from public, anon, authenticated;

-- Private lookups need privileged reads of auth.users/memberships. They only reveal
-- a boolean for the authenticated caller, never accept a user id, and are not in
-- an exposed API schema. Admin roles never come from editable user_metadata.
create function printer_private.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;
create function printer_private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select printer_private.is_verified() and exists (select 1 from printer_private.admin_memberships where user_id = auth.uid());
$$;
revoke all on function printer_private.is_verified(), printer_private.is_admin() from public, anon;
grant execute on function printer_private.is_verified(), printer_private.is_admin() to authenticated;

create table public.printer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);
create table public.printer_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.printer_profiles(id) on delete cascade,
  shop_name text not null check (length(btrim(shop_name)) between 2 and 120),
  message text not null default '' check (length(message) <= 2000),
  requested_plan text not null check (requested_plan in ('pro', 'shop')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  decision_reason text check (length(decision_reason) <= 1000)
);
create unique index printer_one_pending_request on public.printer_access_requests(user_id) where status = 'pending';
create index printer_requests_user_date on public.printer_access_requests(user_id, created_at desc);
create index printer_requests_status_date on public.printer_access_requests(status, created_at desc);
create table public.printer_access_grants (
  user_id uuid primary key references public.printer_profiles(id) on delete cascade,
  plan text not null check (plan in ('pro', 'shop')),
  status text not null check (status in ('trial', 'active', 'revoked')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null check (length(reason) <= 1000),
  check (ends_at > starts_at)
);
create table public.printer_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  user_id uuid not null references auth.users(id),
  action text not null,
  created_at timestamptz not null default now(),
  details jsonb not null
);
create index printer_audit_created on public.printer_access_audit(created_at desc);

alter table public.printer_profiles enable row level security;
alter table public.printer_access_requests enable row level security;
alter table public.printer_access_grants enable row level security;
alter table public.printer_access_audit enable row level security;
revoke all on public.printer_profiles, public.printer_access_requests, public.printer_access_grants, public.printer_access_audit from public, anon, authenticated;
grant select on public.printer_profiles, public.printer_access_requests, public.printer_access_grants, public.printer_access_audit to authenticated;
grant insert (user_id, shop_name, message, requested_plan) on public.printer_access_requests to authenticated;
grant update (status, reviewed_at, reviewed_by, decision_reason) on public.printer_access_requests to authenticated;
grant insert, update on public.printer_access_grants to authenticated;

create policy printer_profiles_read on public.printer_profiles for select to authenticated
using (printer_private.is_verified() and (id = (select auth.uid()) or (select printer_private.is_admin())));
create policy printer_requests_read on public.printer_access_requests for select to authenticated
using (printer_private.is_verified() and (user_id = (select auth.uid()) or (select printer_private.is_admin())));
create policy printer_requests_create on public.printer_access_requests for insert to authenticated
with check (printer_private.is_verified() and user_id = (select auth.uid()) and status = 'pending');
create policy printer_requests_review on public.printer_access_requests for update to authenticated
using ((select printer_private.is_admin())) with check ((select printer_private.is_admin()));
create policy printer_grants_read on public.printer_access_grants for select to authenticated
using (printer_private.is_verified() and (user_id = (select auth.uid()) or (select printer_private.is_admin())));
create policy printer_grants_create on public.printer_access_grants for insert to authenticated
with check ((select printer_private.is_admin()));
create policy printer_grants_change on public.printer_access_grants for update to authenticated
using ((select printer_private.is_admin())) with check ((select printer_private.is_admin()));
create policy printer_audit_read on public.printer_access_audit for select to authenticated
using ((select printer_private.is_admin()));

-- Profile and immutable audit writes can only be made by these trigger functions.
create function printer_private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.printer_profiles(id, email, display_name, created_at)
  values (new.id, coalesce(new.email, ''), left(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.email, 'Customer'), 120), new.created_at)
  on conflict (id) do update set email = excluded.email, display_name = excluded.display_name;
  return new;
end;
$$;
revoke all on function printer_private.sync_profile() from public, anon, authenticated;
create trigger printer_sync_profile after insert or update on auth.users for each row execute function printer_private.sync_profile();
insert into public.printer_profiles(id, email, display_name, created_at)
select id, coalesce(email, ''), left(coalesce(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', email, 'Customer'), 120), created_at from auth.users;

create function printer_private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  insert into public.printer_access_audit(actor_id, user_id, action, details)
  values (auth.uid(), new.user_id, tg_table_name || ':' || tg_op,
    jsonb_build_object('before', case when tg_op = 'UPDATE' then to_jsonb(old) else null end, 'after', to_jsonb(new)));
  return new;
end;
$$;
revoke all on function printer_private.audit_change() from public, anon, authenticated;
create trigger printer_grants_audit after insert or update on public.printer_access_grants for each row execute function printer_private.audit_change();
create trigger printer_requests_audit after update on public.printer_access_requests for each row execute function printer_private.audit_change();

create function public.printer_access_snapshot() returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not printer_private.is_verified() then raise exception 'Verified account required'; end if;
  return jsonb_build_object('server_now', now(), 'is_admin', printer_private.is_admin(),
    'grant', (select to_jsonb(g) from public.printer_access_grants g where g.user_id = auth.uid()),
    'request', (select to_jsonb(r) from public.printer_access_requests r where r.user_id = auth.uid() order by r.created_at desc, r.id desc limit 1));
end;
$$;

create function public.printer_submit_request(p_shop_name text, p_message text, p_plan text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not printer_private.is_verified() then raise exception 'Verified account required'; end if;
  if exists (select 1 from public.printer_access_requests where user_id = auth.uid() and created_at > now() - interval '1 minute') then raise exception 'Please wait a minute before sending another request'; end if;
  insert into public.printer_access_requests(user_id, shop_name, message, requested_plan)
  values (auth.uid(), btrim(p_shop_name), coalesce(p_message, ''), p_plan);
exception when unique_violation then raise exception 'You already have a pending request';
end;
$$;

create function public.printer_admin_action(p_action text, p_user_id uuid, p_request_id uuid, p_plan text, p_days integer, p_reason text) returns void
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

create function public.printer_admin_list() returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
  if not printer_private.is_admin() then raise exception 'Owner access required'; end if;
  return jsonb_build_object(
    'customers', coalesce((select jsonb_agg(t) from (select * from public.printer_profiles order by created_at desc limit 1000) t), '[]'::jsonb),
    'requests', coalesce((select jsonb_agg(t) from (select * from public.printer_access_requests order by (status = 'pending') desc, created_at desc limit 1000) t), '[]'::jsonb),
    'grants', coalesce((select jsonb_agg(t) from (select * from public.printer_access_grants order by ends_at desc limit 1000) t), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(t) from (select * from public.printer_access_audit order by created_at desc limit 100) t), '[]'::jsonb),
    'hasMore', (select count(*) > 1000 from public.printer_profiles) or (select count(*) > 1000 from public.printer_access_requests) or (select count(*) > 1000 from public.printer_access_grants));
end;
$$;

revoke all on function public.printer_access_snapshot(), public.printer_submit_request(text,text,text), public.printer_admin_action(text,uuid,uuid,text,integer,text), public.printer_admin_list() from public, anon;
grant execute on function public.printer_access_snapshot(), public.printer_submit_request(text,text,text), public.printer_admin_action(text,uuid,uuid,text,integer,text), public.printer_admin_list() to authenticated;
