-- Contract checks for analytics/KPI hardening migration 094.

do $$
declare
  v_dashboard text:=lower(pg_get_functiondef('public.rpc_cmms_analytics_dashboard(timestamptz,timestamptz,uuid,text)'::regprocedure));
  v_cost text:=lower(pg_get_functiondef('public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz)'::regprocedure));
  v_view text:=lower(pg_get_viewdef('public.cmms_analytics_inventory_risk_v'::regclass,true));
begin
  if v_dashboard not like '%analytics_period_invalid%' then
    raise exception 'analytics dashboard must validate period ordering';
  end if;
  if v_dashboard not like '%greatest(d.started_at, p_start_at)%' or v_dashboard not like '%least(coalesce(d.ended_at, p_end_at), p_end_at)%' then
    raise exception 'analytics dashboard must clip overlapping downtime to requested period';
  end if;
  if v_dashboard not like '%response_breached_at%' then
    raise exception 'analytics dashboard must count response SLA breach';
  end if;
  if v_dashboard not like '%p_location_id is null or e.location_id = p_location_id%' then
    raise exception 'analytics dashboard must apply location filter to SLA/equipment metrics';
  end if;
  if v_dashboard not like '%greatest(previous_end_at, p_start_at)%' then
    raise exception 'analytics dashboard must bound MTBF gap to requested period';
  end if;

  if v_cost not like '%analytics_period_invalid%' then
    raise exception 'analytics cost breakdown must validate period ordering';
  end if;
  if v_cost not like '%distinct on (a.work_order_id)%' then
    raise exception 'team attribution must select one canonical team per work order';
  end if;
  if v_cost not like '%distinct on (a.equipment_id)%' then
    raise exception 'vendor attribution must select one canonical vendor per equipment';
  end if;
  if v_cost not like '%service_vendor%' or v_cost not like '%primary_team%' then
    raise exception 'canonical attribution priority missing';
  end if;

  if v_view not like '%when risk_state = ''ok''::text then 0%' and v_view not like '%when (risk_state = ''ok''::text) then 0%' then
    raise exception 'inventory suggested order quantity must be zero for OK stock';
  end if;
  if v_view not like '%quantity_available < min_stock%' then
    raise exception 'inventory LOW state must be reachable below minimum stock';
  end if;
end $$;
