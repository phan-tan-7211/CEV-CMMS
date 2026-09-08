-- Contract checks for 20260909_085_work_order_lifecycle_hardening.sql

do $$
begin
  if to_regprocedure('public.rpc_transition_maintenance(text,text,text)') is null then
    raise exception 'missing rpc_transition_maintenance(text,text,text)';
  end if;
  if to_regprocedure('public.cmms_guard_work_order_checklist_mutation()') is null then
    raise exception 'missing cmms_guard_work_order_checklist_mutation()';
  end if;
  if to_regprocedure('public.cmms_guard_work_order_execution_insert()') is null then
    raise exception 'missing cmms_guard_work_order_execution_insert()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.cmms_work_order_checklist_item'::regclass
      and tgname='trg_cmms_work_order_checklist_guard'
      and not tgisinternal
  ) then raise exception 'missing checklist guard trigger'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.cmms_work_order_part_usage'::regclass
      and tgname='trg_cmms_work_order_part_usage_guard'
      and not tgisinternal
  ) then raise exception 'missing part usage guard trigger'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.cmms_work_order_labor'::regclass
      and tgname='trg_cmms_work_order_labor_guard'
      and not tgisinternal
  ) then raise exception 'missing labor guard trigger'; end if;
end $$;
