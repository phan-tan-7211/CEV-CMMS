-- Contract checks for 20260909_090_sla_notification_hardening.sql

do $$
begin
  if to_regprocedure('public.cmms_entity_exists(text,text)') is null then raise exception 'missing cmms_entity_exists'; end if;
  if to_regprocedure('public.rpc_cmms_mark_sla_responded(text,text)') is null then raise exception 'missing mark SLA responded RPC'; end if;
  if to_regprocedure('public.rpc_cmms_mark_sla_resolved(text,text)') is null then raise exception 'missing mark SLA resolved RPC'; end if;
  if to_regprocedure('public.cmms_run_sla_escalation_internal(timestamptz)') is null then raise exception 'missing internal SLA worker'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cmms_sla_instance' and column_name='response_warning_sent_at') then raise exception 'missing response warning column'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.maintenance_work_order'::regclass and tgname='trg_cmms_sync_sla_work_order_status' and not tgisinternal) then raise exception 'missing WO SLA sync trigger'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.maintenance_request'::regclass and tgname='trg_cmms_sync_sla_request_status' and not tgisinternal) then raise exception 'missing request SLA sync trigger'; end if;
end $$;
