-- Contract checks for scheduler engine foundation 097.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='maintenance_work_order' and column_name='planned_start_at') then
    raise exception 'missing maintenance_work_order.planned_start_at';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='maintenance_work_order' and column_name='planned_end_at') then
    raise exception 'missing maintenance_work_order.planned_end_at';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='maintenance_work_order' and column_name='schedule_locked') then
    raise exception 'missing maintenance_work_order.schedule_locked';
  end if;

  if to_regprocedure('public.rpc_cmms_scheduler_events(timestamptz,timestamptz,uuid,uuid,uuid,boolean,integer)') is null then
    raise exception 'missing rpc_cmms_scheduler_events';
  end if;
  if to_regprocedure('public.rpc_cmms_scheduler_conflicts(text,timestamptz,timestamptz,uuid,uuid)') is null then
    raise exception 'missing rpc_cmms_scheduler_conflicts';
  end if;
  if to_regprocedure('public.rpc_cmms_reschedule_work_order(text,timestamptz,timestamptz,uuid,uuid,boolean,text)') is null then
    raise exception 'missing rpc_cmms_reschedule_work_order';
  end if;
  if to_regprocedure('public.rpc_cmms_set_work_order_schedule_lock(text,boolean)') is null then
    raise exception 'missing rpc_cmms_set_work_order_schedule_lock';
  end if;

  if has_function_privilege('anon','public.rpc_cmms_reschedule_work_order(text,timestamptz,timestamptz,uuid,uuid,boolean,text)','EXECUTE') then
    raise exception 'anon must not execute reschedule RPC';
  end if;
  if not has_function_privilege('authenticated','public.rpc_cmms_reschedule_work_order(text,timestamptz,timestamptz,uuid,uuid,boolean,text)','EXECUTE') then
    raise exception 'authenticated must execute reschedule RPC (role guard is inside function)';
  end if;
end $$;
