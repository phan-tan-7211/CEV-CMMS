do $$
begin
  if to_regclass('public.cmms_oee_period') is null then raise exception 'cmms_oee_period missing'; end if;
  if to_regprocedure('public.rpc_cmms_upsert_oee_period(jsonb)') is null then raise exception 'rpc_cmms_upsert_oee_period missing'; end if;
  if to_regprocedure('public.rpc_cmms_analytics_oee(timestamp with time zone,timestamp with time zone,uuid,text)') is null then raise exception 'rpc_cmms_analytics_oee missing'; end if;
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='cmms_oee_period' and c.relrowsecurity) then raise exception 'cmms_oee_period RLS disabled'; end if;
  if has_function_privilege('anon','public.rpc_cmms_upsert_oee_period(jsonb)','EXECUTE') then raise exception 'anon can execute OEE upsert'; end if;
  if not has_function_privilege('authenticated','public.rpc_cmms_upsert_oee_period(jsonb)','EXECUTE') then raise exception 'authenticated cannot execute OEE upsert'; end if;
  if has_function_privilege('anon','public.rpc_cmms_analytics_oee(timestamp with time zone,timestamp with time zone,uuid,text)','EXECUTE') then raise exception 'anon can execute OEE analytics'; end if;
end $$;
