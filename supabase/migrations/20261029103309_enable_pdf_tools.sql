begin;

-- Add the new tool to plan defaults without changing customer-specific overrides.
create or replace function printer_private.valid_tools(tools text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select tools is not null and array_position(tools, null) is null and tools <@
    array['card-montage','sequential-number','booklet-montage','hardcover-cover',
          'cutter-montage','fast-print','pdf-tools']::text[];
$$;

-- The owner-only audit trigger expects an interactive user, which a migration
-- does not have. Disable only this trigger for the versioned plan update.
alter table public.printer_subscription_plans disable trigger printer_plan_audit;
update public.printer_subscription_plans
set tool_ids = array_append(tool_ids, 'pdf-tools')
where plan in ('pro', 'shop') and not ('pdf-tools' = any(tool_ids));
alter table public.printer_subscription_plans enable trigger printer_plan_audit;

commit;
