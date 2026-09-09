-- Contract checks for 20260909_089_pm_schedule_crud.sql

do $$
begin
  if to_regprocedure('public.rpc_cmms_upsert_pm_schedule(jsonb)') is null then
    raise exception 'missing rpc_cmms_upsert_pm_schedule(jsonb)';
  end if;
  if to_regprocedure('public.rpc_cmms_set_pm_schedule_active(uuid,boolean)') is null then
    raise exception 'missing rpc_cmms_set_pm_schedule_active(uuid,boolean)';
  end if;
  if to_regprocedure('public.rpc_cmms_archive_pm_schedule(uuid,boolean)') is null then
    raise exception 'missing rpc_cmms_archive_pm_schedule(uuid,boolean)';
  end if;

  if has_function_privilege('anon','public.rpc_cmms_upsert_pm_schedule(jsonb)','EXECUTE') then
    raise exception 'anon must not execute PM schedule upsert';
  end if;
  if not has_function_privilege('authenticated','public.rpc_cmms_upsert_pm_schedule(jsonb)','EXECUTE') then
    raise exception 'authenticated must execute PM schedule upsert';
  end if;
end $$;
