-- Contract checks for 20260909_088_pm_work_order_automation.sql

do $$
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then
    raise exception 'missing pg_cron extension';
  end if;
  if to_regprocedure('public.cmms_generate_due_pm_work_orders_internal(timestamptz,text,uuid)') is null then
    raise exception 'missing internal PM generator';
  end if;
  if to_regprocedure('public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid)') is null then
    raise exception 'missing authenticated PM generator RPC';
  end if;
  if has_function_privilege('authenticated','public.cmms_generate_due_pm_work_orders_internal(timestamptz,text,uuid)','EXECUTE') then
    raise exception 'internal PM generator must not be executable by authenticated';
  end if;
  if not has_function_privilege('authenticated','public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid)','EXECUTE') then
    raise exception 'authenticated PM generator RPC execute missing';
  end if;
  if not exists (
    select 1 from cron.job
    where jobname='cmms-pm-due-generator'
      and schedule='*/15 * * * *'
      and active=true
  ) then
    raise exception 'missing active cmms-pm-due-generator cron job';
  end if;
end $$;
