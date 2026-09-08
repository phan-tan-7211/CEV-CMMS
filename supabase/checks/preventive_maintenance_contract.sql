-- Read-only contract checks for PM/meter foundation.
begin;

do $$
declare n text; missing text[]:=array[]::text[];
begin
  foreach n in array array[
    'cmms_checklist_template','cmms_checklist_template_item','cmms_meter','cmms_meter_reading','cmms_pm_schedule'
  ] loop
    if to_regclass('public.'||n) is null then missing:=array_append(missing,n); end if;
  end loop;
  if cardinality(missing)>0 then raise exception 'PM tables missing: %',array_to_string(missing,', '); end if;
end $$;

do $$
begin
  if to_regprocedure('public.cmms_pm_next_time_due(timestamptz,integer,text)') is null then raise exception 'cmms_pm_next_time_due missing'; end if;
  if to_regprocedure('public.rpc_cmms_record_meter_reading(uuid,numeric,timestamptz,text,text)') is null then raise exception 'rpc_cmms_record_meter_reading missing'; end if;
  if to_regprocedure('public.rpc_cmms_pm_schedule_detail(uuid)') is null then raise exception 'rpc_cmms_pm_schedule_detail missing'; end if;
  if to_regprocedure('public.rpc_cmms_pm_due_list(timestamptz,boolean)') is null then raise exception 'rpc_cmms_pm_due_list missing'; end if;
  if to_regprocedure('public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid)') is null then raise exception 'rpc_cmms_generate_due_pm_work_orders missing'; end if;
end $$;

do $$
declare bad text[];
begin
  select array_agg(c.relname order by c.relname) into bad
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array[
    'cmms_checklist_template','cmms_checklist_template_item','cmms_meter','cmms_meter_reading','cmms_pm_schedule'
  ]) and not c.relrowsecurity;
  if coalesce(cardinality(bad),0)>0 then raise exception 'RLS disabled on: %',array_to_string(bad,', '); end if;
end $$;

do $$
begin
  if public.cmms_pm_next_time_due('2026-01-01 00:00:00+00'::timestamptz,1,'DAYS') <> '2026-01-02 00:00:00+00'::timestamptz then
    raise exception 'PM next due day calculation failed';
  end if;
  if public.cmms_pm_next_time_due('2026-01-31 00:00:00+00'::timestamptz,1,'MONTHS') <> '2026-02-28 00:00:00+00'::timestamptz then
    raise exception 'PM next due month calculation failed';
  end if;
end $$;

rollback;
