-- Contract checks for CMMS analytics/KPI backend.
do $$
begin
  if to_regclass('public.cmms_analytics_downtime_event_v') is null then raise exception 'MISSING_VIEW: cmms_analytics_downtime_event_v'; end if;
  if to_regclass('public.cmms_analytics_asset_reliability_v') is null then raise exception 'MISSING_VIEW: cmms_analytics_asset_reliability_v'; end if;
  if to_regclass('public.cmms_analytics_work_order_cost_v') is null then raise exception 'MISSING_VIEW: cmms_analytics_work_order_cost_v'; end if;
  if to_regclass('public.cmms_analytics_inventory_risk_v') is null then raise exception 'MISSING_VIEW: cmms_analytics_inventory_risk_v'; end if;

  if to_regprocedure('public.rpc_cmms_analytics_dashboard(timestamp with time zone,timestamp with time zone,uuid,text)') is null then
    raise exception 'MISSING_RPC: rpc_cmms_analytics_dashboard';
  end if;
  if to_regprocedure('public.rpc_cmms_analytics_cost_breakdown(text,timestamp with time zone,timestamp with time zone)') is null then
    raise exception 'MISSING_RPC: rpc_cmms_analytics_cost_breakdown';
  end if;

  if not exists(
    select 1 from pg_views where schemaname='public' and viewname='cmms_analytics_asset_reliability_v'
  ) then raise exception 'ANALYTICS_RELIABILITY_VIEW_NOT_REGISTERED'; end if;
end $$;
