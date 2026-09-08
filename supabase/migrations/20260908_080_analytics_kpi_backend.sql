-- CMMS analytics / KPI backend.
-- Read-only projections and RPCs over existing normalized CMMS tables.
-- No UI dependency and no mutation of operational records.

create or replace view public.cmms_analytics_downtime_event_v
with (security_invoker = true)
as
select
  d.downtime_id,
  d.equipment_id,
  e.equipment_name,
  e.location_id,
  l.name as location_name,
  e.asset_category_id,
  c.name as asset_category_name,
  d.work_order_id,
  d.started_at,
  d.ended_at,
  case
    when d.started_at is null then null
    else extract(epoch from (coalesce(d.ended_at, now()) - d.started_at)) / 60.0
  end as downtime_minutes,
  (d.ended_at is null and d.started_at is not null) as is_open,
  d.source_data,
  d.created_at
from public.downtime_event d
join public.equipment_master e on e.equipment_id=d.equipment_id
left join public.cmms_location l on l.location_id=e.location_id
left join public.cmms_asset_category c on c.asset_category_id=e.asset_category_id;

revoke all on public.cmms_analytics_downtime_event_v from anon;
grant select on public.cmms_analytics_downtime_event_v to authenticated;

create or replace view public.cmms_analytics_asset_reliability_v
with (security_invoker = true)
as
with closed_events as (
  select
    d.equipment_id,
    d.started_at,
    d.ended_at,
    extract(epoch from (d.ended_at-d.started_at))/3600.0 as repair_hours,
    lag(d.ended_at) over(partition by d.equipment_id order by d.started_at,d.downtime_id) as previous_end_at
  from public.downtime_event d
  where d.started_at is not null and d.ended_at is not null and d.ended_at>=d.started_at
), agg as (
  select
    equipment_id,
    count(*) as failure_count,
    sum(repair_hours) as downtime_hours,
    avg(repair_hours) as mttr_hours,
    avg(
      case when previous_end_at is not null and started_at>=previous_end_at
        then extract(epoch from (started_at-previous_end_at))/3600.0
      end
    ) as mtbf_hours
  from closed_events
  group by equipment_id
)
select
  e.equipment_id,
  e.equipment_name,
  e.status,
  e.location_id,
  l.name as location_name,
  e.asset_category_id,
  c.name as asset_category_name,
  coalesce(a.failure_count,0) as failure_count,
  coalesce(a.downtime_hours,0) as downtime_hours,
  a.mttr_hours,
  a.mtbf_hours
from public.equipment_master e
left join agg a on a.equipment_id=e.equipment_id
left join public.cmms_location l on l.location_id=e.location_id
left join public.cmms_asset_category c on c.asset_category_id=e.asset_category_id;

revoke all on public.cmms_analytics_asset_reliability_v from anon;
grant select on public.cmms_analytics_asset_reliability_v to authenticated;

create or replace view public.cmms_analytics_work_order_cost_v
with (security_invoker = true)
as
with part_cost as (
  select work_order_id,
    sum(coalesce(quantity,0)*coalesce(unit_cost,0)) as parts_cost
  from public.cmms_work_order_part_usage
  group by work_order_id
), labor_cost as (
  select work_order_id,
    sum((coalesce(minutes,0)::numeric/60.0)*coalesce(hourly_rate,0)) as labor_cost,
    sum(coalesce(minutes,0)) as labor_minutes
  from public.cmms_work_order_labor
  group by work_order_id
)
select
  w.work_order_id,
  w.equipment_id,
  e.equipment_name,
  e.location_id,
  l.name as location_name,
  w.status,
  w.priority,
  w.source_type,
  w.created_at,
  w.updated_at,
  coalesce(p.parts_cost,0) as parts_cost,
  coalesce(lb.labor_cost,0) as labor_cost,
  coalesce(lb.labor_minutes,0) as labor_minutes,
  coalesce(p.parts_cost,0)+coalesce(lb.labor_cost,0) as total_cost
from public.maintenance_work_order w
join public.equipment_master e on e.equipment_id=w.equipment_id
left join public.cmms_location l on l.location_id=e.location_id
left join part_cost p on p.work_order_id=w.work_order_id
left join labor_cost lb on lb.work_order_id=w.work_order_id;

revoke all on public.cmms_analytics_work_order_cost_v from anon;
grant select on public.cmms_analytics_work_order_cost_v to authenticated;

create or replace view public.cmms_analytics_inventory_risk_v
with (security_invoker = true)
as
with stock as (
  select
    s.part_id,
    sum(s.quantity_on_hand) as quantity_on_hand,
    sum(s.quantity_reserved) as quantity_reserved,
    sum(s.quantity_on_hand-s.quantity_reserved) as quantity_available,
    sum(s.quantity_on_hand*coalesce(s.average_unit_cost,p.unit_cost,0)) as stock_value
  from public.cmms_part_stock s
  join public.cmms_part p on p.part_id=s.part_id
  group by s.part_id
)
select
  p.part_id,
  p.part_number,
  p.name,
  p.critical,
  p.min_stock,
  p.max_stock,
  p.reorder_point,
  p.reorder_quantity,
  p.lead_time_days,
  coalesce(s.quantity_on_hand,0) as quantity_on_hand,
  coalesce(s.quantity_reserved,0) as quantity_reserved,
  coalesce(s.quantity_available,0) as quantity_available,
  coalesce(s.stock_value,0) as stock_value,
  case
    when coalesce(s.quantity_available,0)<=0 then 'STOCKOUT'
    when coalesce(s.quantity_available,0)<=coalesce(p.reorder_point,p.min_stock) then 'REORDER'
    when coalesce(s.quantity_available,0)<=p.min_stock then 'LOW'
    else 'OK'
  end as risk_state,
  greatest(
    coalesce(p.reorder_quantity,0),
    greatest(coalesce(p.max_stock,p.min_stock,0)-coalesce(s.quantity_available,0),0)
  ) as suggested_order_quantity
from public.cmms_part p
left join stock s on s.part_id=p.part_id
where p.active=true and p.archived_at is null;

revoke all on public.cmms_analytics_inventory_risk_v from anon;
grant select on public.cmms_analytics_inventory_risk_v to authenticated;

create or replace function public.rpc_cmms_analytics_dashboard(
  p_start_at timestamptz default (now()-interval '30 days'),
  p_end_at timestamptz default now(),
  p_location_id uuid default null,
  p_equipment_id text default null
) returns jsonb
language sql
security invoker
set search_path=public
as $$
with filtered_wo as (
  select w.*
  from public.maintenance_work_order w
  join public.equipment_master e on e.equipment_id=w.equipment_id
  where w.created_at>=p_start_at and w.created_at<p_end_at
    and (p_location_id is null or e.location_id=p_location_id)
    and (p_equipment_id is null or w.equipment_id=trim(p_equipment_id))
), wo as (
  select
    count(*) as total,
    count(*) filter(where upper(status) not in ('COMPLETED','COMPLETE','CLOSED','CANCELLED')) as backlog,
    count(*) filter(where upper(status) in ('COMPLETED','COMPLETE','CLOSED')) as completed,
    count(*) filter(where source_type='PREVENTIVE_MAINTENANCE') as pm_total,
    count(*) filter(where source_type='PREVENTIVE_MAINTENANCE' and upper(status) in ('COMPLETED','COMPLETE','CLOSED')) as pm_completed
  from filtered_wo
), dt_raw as (
  select d.*
  from public.downtime_event d
  join public.equipment_master e on e.equipment_id=d.equipment_id
  where d.started_at>=p_start_at and d.started_at<p_end_at
    and (p_location_id is null or e.location_id=p_location_id)
    and (p_equipment_id is null or d.equipment_id=trim(p_equipment_id))
), dt as (
  select
    count(*) as event_count,
    count(*) filter(where ended_at is null) as open_event_count,
    sum(case when started_at is not null then extract(epoch from (coalesce(ended_at,p_end_at)-started_at))/60.0 else 0 end) as downtime_minutes,
    avg(case when ended_at is not null and started_at is not null and ended_at>=started_at then extract(epoch from (ended_at-started_at))/3600.0 end) as mttr_hours
  from dt_raw
), reliability_seq as (
  select equipment_id,started_at,ended_at,
    lag(ended_at) over(partition by equipment_id order by started_at,downtime_id) as previous_end_at
  from dt_raw
  where started_at is not null and ended_at is not null and ended_at>=started_at
), reliability as (
  select avg(case when previous_end_at is not null and started_at>=previous_end_at then extract(epoch from(started_at-previous_end_at))/3600.0 end) as mtbf_hours
  from reliability_seq
), sla as (
  select
    count(*) as total,
    count(*) filter(where status='BREACHED' or breached_at is not null) as breached,
    count(*) filter(where status='MET') as met
  from public.cmms_sla_instance i
  where i.started_at>=p_start_at and i.started_at<p_end_at
    and (
      p_equipment_id is null or
      (i.entity_type='WORK_ORDER' and exists(select 1 from public.maintenance_work_order w where w.work_order_id=i.entity_id and w.equipment_id=trim(p_equipment_id))) or
      (i.entity_type='REQUEST' and exists(select 1 from public.maintenance_request r where r.request_id=i.entity_id and r.equipment_id=trim(p_equipment_id)))
    )
), costs as (
  select
    coalesce(sum(c.parts_cost),0) as parts_cost,
    coalesce(sum(c.labor_cost),0) as labor_cost,
    coalesce(sum(c.total_cost),0) as total_cost
  from public.cmms_analytics_work_order_cost_v c
  where c.created_at>=p_start_at and c.created_at<p_end_at
    and (p_location_id is null or c.location_id=p_location_id)
    and (p_equipment_id is null or c.equipment_id=trim(p_equipment_id))
), inventory as (
  select
    count(*) filter(where risk_state in ('LOW','REORDER','STOCKOUT')) as low_stock_parts,
    count(*) filter(where risk_state='STOCKOUT') as stockout_parts,
    count(*) filter(where critical and risk_state in ('LOW','REORDER','STOCKOUT')) as critical_risk_parts,
    coalesce(sum(stock_value),0) as inventory_value
  from public.cmms_analytics_inventory_risk_v
)
select jsonb_build_object(
  'period',jsonb_build_object('startAt',p_start_at,'endAt',p_end_at),
  'filters',jsonb_build_object('locationId',p_location_id,'equipmentId',p_equipment_id),
  'workOrders',jsonb_build_object(
    'total',wo.total,
    'backlog',wo.backlog,
    'completed',wo.completed,
    'completionRate',case when wo.total=0 then null else round(wo.completed::numeric*100/wo.total,2) end
  ),
  'preventiveMaintenance',jsonb_build_object(
    'generated',wo.pm_total,
    'completed',wo.pm_completed,
    'complianceRate',case when wo.pm_total=0 then null else round(wo.pm_completed::numeric*100/wo.pm_total,2) end
  ),
  'reliability',jsonb_build_object(
    'downtimeEvents',dt.event_count,
    'openDowntimeEvents',dt.open_event_count,
    'downtimeMinutes',round(coalesce(dt.downtime_minutes,0)::numeric,2),
    'mttrHours',round(dt.mttr_hours::numeric,2),
    'mtbfHours',round(reliability.mtbf_hours::numeric,2)
  ),
  'sla',jsonb_build_object(
    'total',sla.total,
    'breached',sla.breached,
    'met',sla.met,
    'breachRate',case when sla.total=0 then null else round(sla.breached::numeric*100/sla.total,2) end
  ),
  'cost',jsonb_build_object(
    'parts',round(costs.parts_cost::numeric,2),
    'labor',round(costs.labor_cost::numeric,2),
    'total',round(costs.total_cost::numeric,2)
  ),
  'inventory',jsonb_build_object(
    'lowStockParts',inventory.low_stock_parts,
    'stockoutParts',inventory.stockout_parts,
    'criticalRiskParts',inventory.critical_risk_parts,
    'inventoryValue',round(inventory.inventory_value::numeric,2)
  )
)
from wo,dt,reliability,sla,costs,inventory
$$;

revoke all on function public.rpc_cmms_analytics_dashboard(timestamptz,timestamptz,uuid,text) from public, anon;
grant execute on function public.rpc_cmms_analytics_dashboard(timestamptz,timestamptz,uuid,text) to authenticated;

create or replace function public.rpc_cmms_analytics_cost_breakdown(
  p_dimension text default 'ASSET',
  p_start_at timestamptz default (now()-interval '30 days'),
  p_end_at timestamptz default now()
) returns table(
  dimension_key text,
  dimension_label text,
  work_order_count bigint,
  parts_cost numeric,
  labor_cost numeric,
  total_cost numeric
)
language plpgsql
security invoker
set search_path=public
as $$
declare v_dimension text:=upper(trim(coalesce(p_dimension,'ASSET')));
begin
  if v_dimension='ASSET' then
    return query
    select c.equipment_id,c.equipment_name,count(*)::bigint,sum(c.parts_cost),sum(c.labor_cost),sum(c.total_cost)
    from public.cmms_analytics_work_order_cost_v c
    where c.created_at>=p_start_at and c.created_at<p_end_at
    group by c.equipment_id,c.equipment_name
    order by sum(c.total_cost) desc;
  elsif v_dimension='LOCATION' then
    return query
    select coalesce(c.location_id::text,'UNASSIGNED'),coalesce(c.location_name,'Unassigned'),count(*)::bigint,sum(c.parts_cost),sum(c.labor_cost),sum(c.total_cost)
    from public.cmms_analytics_work_order_cost_v c
    where c.created_at>=p_start_at and c.created_at<p_end_at
    group by c.location_id,c.location_name
    order by sum(c.total_cost) desc;
  elsif v_dimension='TEAM' then
    return query
    select t.team_id::text,t.name,count(distinct c.work_order_id)::bigint,
      sum(c.parts_cost),sum(c.labor_cost),sum(c.total_cost)
    from public.cmms_analytics_work_order_cost_v c
    join public.cmms_work_order_team_assignment a on a.work_order_id=c.work_order_id
    join public.cmms_team t on t.team_id=a.team_id
    where c.created_at>=p_start_at and c.created_at<p_end_at
      and a.assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM')
    group by t.team_id,t.name
    order by sum(c.total_cost) desc;
  elsif v_dimension='VENDOR' then
    return query
    select bp.party_id::text,bp.name,count(distinct c.work_order_id)::bigint,
      sum(c.parts_cost),sum(c.labor_cost),sum(c.total_cost)
    from public.cmms_analytics_work_order_cost_v c
    join public.cmms_equipment_party_assignment a on a.equipment_id=c.equipment_id
    join public.cmms_business_party bp on bp.party_id=a.party_id
    where c.created_at>=p_start_at and c.created_at<p_end_at
      and a.assignment_role in ('ASSIGNED_VENDOR','SERVICE_VENDOR')
    group by bp.party_id,bp.name
    order by sum(c.total_cost) desc;
  else
    raise exception 'ANALYTICS_DIMENSION_INVALID';
  end if;
end $$;

revoke all on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz) from public, anon;
grant execute on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz) to authenticated;

comment on function public.rpc_cmms_analytics_dashboard(timestamptz,timestamptz,uuid,text)
is 'CMMS dashboard KPIs over a requested period. PM compliance is completed PM work orders divided by PM work orders generated in the same period.';
