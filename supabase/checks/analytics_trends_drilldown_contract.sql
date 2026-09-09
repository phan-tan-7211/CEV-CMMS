do $$
begin
  if to_regprocedure('public.rpc_cmms_analytics_trends(timestamptz,timestamptz,text,text,uuid,text)') is null then
    raise exception 'missing rpc_cmms_analytics_trends';
  end if;
  if to_regprocedure('public.rpc_cmms_analytics_drilldown(text,timestamptz,timestamptz,uuid,text,integer,integer)') is null then
    raise exception 'missing rpc_cmms_analytics_drilldown';
  end if;
  if has_function_privilege('anon','public.rpc_cmms_analytics_trends(timestamptz,timestamptz,text,text,uuid,text)','EXECUTE') then
    raise exception 'anon must not execute analytics trends';
  end if;
  if not has_function_privilege('authenticated','public.rpc_cmms_analytics_trends(timestamptz,timestamptz,text,text,uuid,text)','EXECUTE') then
    raise exception 'authenticated must execute analytics trends';
  end if;
  if has_function_privilege('anon','public.rpc_cmms_analytics_drilldown(text,timestamptz,timestamptz,uuid,text,integer,integer)','EXECUTE') then
    raise exception 'anon must not execute analytics drilldown';
  end if;
  if not has_function_privilege('authenticated','public.rpc_cmms_analytics_drilldown(text,timestamptz,timestamptz,uuid,text,integer,integer)','EXECUTE') then
    raise exception 'authenticated must execute analytics drilldown';
  end if;
end $$;
