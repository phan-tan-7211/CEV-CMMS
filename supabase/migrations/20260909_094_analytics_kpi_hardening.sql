-- Analytics/KPI hardening follow-up.
-- Fixes period overlap math, SLA location filtering, MTBF period boundaries,
-- inventory risk semantics, input validation, and TEAM/VENDOR cost double-counting.

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
), base as (
  select
    p.*,
    coalesce(s.quantity_on_hand,0) as quantity_on_hand,
    coalesce(s.quantity_reserved,0) as quantity_reserved,
    coalesce(s.quantity_available,0) as quantity_available,
    coalesce(s.stock_value,0) as stock_value
  from public.cmms_part p
  left join stock s on s.part_id=p.part_id
  where p.active=true and p.archived_at is null
), classified as (
  select b.*,
    case
      when b.quantity_available<=0 then 'STOCKOUT'
      when b.min_stock is not null and b.quantity_available<b.min_stock then 'LOW'
      when coalesce(b.reorder_point,b.min_stock) is not null
        and b.quantity_available<=coalesce(b.reorder_point,b.min_stock) then 'REORDER'
      else 'OK'
    end as risk_state
  from base b
)
select
  part_id,
  part_number,
  name,
  critical,
  min_stock,
  max_stock,
  reorder_point,
  reorder_quantity,
  lead_time_days,
  quantity_on_hand,
  quantity_reserved,
  quantity_available,
  stock_value,
  risk_state,
  case
    when risk_state='OK' then 0::numeric
    else greatest(
      coalesce(reorder_quantity,0),
      greatest(coalesce(max_stock,min_stock,reorder_point,0)-quantity_available,0)
    )
  end as suggested_order_quantity
from classified;

revoke all on public.cmms_analytics_inventory_risk_v from anon;
grant select on public.cmms_analytics_inventory_risk_v to authenticated;

create or replace function public.rpc_cmms_analytics_dashboard(
  p_start_at timestamptz default (now()-interval '30 days'),
  p_end_at timestamptz default now(),
  p_location_id uuid default null,
  p_equipment_id text default null
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_equipment_id text:=nullif(btrim(coalesce(p_equipment_id,'')),'');
  v_result jsonb;
begin
  if p_start_at is null or p_end_at is null then
    raise exception 'ANALYTICS_PERIOD_REQUIRED';
  end if;
  if p_start_at>=p_end_at then
    raise exception 'ANALYTICS_PERIOD_INVALID';
  end if;

  with filtered_wo as (
    select w.*
    from public.maintenance_work_order w
    join public.equipment_master e on e.equipment_id=w.equipment_id
    where w.created_at>=p_start_at and w.created_at<p_end_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or w.equipment_id=v_equipment_id)
  ), wo as (
    select
      count(*) as total,
      count(*) filter(where upper(status) not in ('COMPLETED','COMPLETE','CLOSED','CANCELLED')) as backlog,
      count(*) filter(where upper(status) in ('COMPLETED','COMPLETE','CLOSED')) as completed,
      count(*) filter(where source_type='PREVENTIVE_MAINTENANCE') as pm_total,
      count(*) filter(where source_type='PREVENTIVE_MAINTENANCE' and upper(status) in ('COMPLETED','COMPLETE','CLOSED')) as pm_completed
    from filtered_wo
  ), dt_raw as (
    select
      d.*,
      greatest(d.started_at,p_start_at) as clipped_start_at,
      least(coalesce(d.ended_at,p_end_at),p_end_at) as clipped_end_at
    from public.downtime_event d
    join public.equipment_master e on e.equipment_id=d.equipment_id
    where d.started_at is not null
      and (d.ended_at is null or d.ended_at>=d.started_at)
      and d.started_at<p_end_at
      and coalesce(d.ended_at,p_end_at)>p_start_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or d.equipment_id=v_equipment_id)
  ), dt as (
    select
      count(*) as event_count,
      count(*) filter(where ended_at is null) as open_event_count,
      sum(extract(epoch from (clipped_end_at-clipped_start_at))/60.0) as downtime_minutes,
      avg(case when ended_at is not null then extract(epoch from (ended_at-started_at))/3600.0 end) as mttr_hours
    from dt_raw
    where clipped_end_at>clipped_start_at
  ), reliability_seq as (
    select
      d.equipment_id,
      d.started_at,
      d.ended_at,
      lag(d.ended_at) over(partition by d.equipment_id order by d.started_at,d.downtime_id) as previous_end_at
    from public.downtime_event d
    join public.equipment_master e on e.equipment_id=d.equipment_id
    where d.started_at is not null
      and d.ended_at is not null
      and d.ended_at>=d.started_at
      and d.started_at<p_end_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or d.equipment_id=v_equipment_id)
  ), reliability as (
    select avg(
      case
        when previous_end_at is not null and started_at>=previous_end_at
          and started_at>=p_start_at and started_at<p_end_at
        then extract(epoch from (started_at-greatest(previous_end_at,p_start_at)))/3600.0
      end
    ) as mtbf_hours
    from reliability_seq
  ), sla_entity as (
    select
      i.*,
      coalesce(w.equipment_id,r.equipment_id) as equipment_id
    from public.cmms_sla_instance i
    left join public.maintenance_work_order w
      on i.entity_type='WORK_ORDER' and w.work_order_id=i.entity_id
    left join public.maintenance_request r
      on i.entity_type='REQUEST' and r.request_id=i.entity_id
    where i.started_at>=p_start_at and i.started_at<p_end_at
  ), sla as (
    select
      count(*) as total,
      count(*) filter(where s.status='BREACHED' or s.breached_at is not null or s.response_breached_at is not null) as breached,
      count(*) filter(where s.status='MET') as met
    from sla_entity s
    left join public.equipment_master e on e.equipment_id=s.equipment_id
    where (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or s.equipment_id=v_equipment_id)
  ), costs as (
    select
      coalesce(sum(c.parts_cost),0) as parts_cost,
      coalesce(sum(c.labor_cost),0) as labor_cost,
      coalesce(sum(c.total_cost),0) as total_cost
    from public.cmms_analytics_work_order_cost_v c
    where c.created_at>=p_start_at and c.created_at<p_end_at
      and (p_location_id is null or c.location_id=p_location_id)
      and (v_equipment_id is null or c.equipment_id=v_equipment_id)
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
    'filters',jsonb_build_object('locationId',p_location_id,'equipmentId',v_equipment_id),
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
  ) into v_result
  from wo,dt,reliability,sla,costs,inventory;

  return v_result;
end $$;

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
  if p_start_at is null or p_end_at is null then
    raise exception 'ANALYTICS_PERIOD_REQUIRED';
  end if;
  if p_start_at>=p_end_at then
    raise exception 'ANALYTICS_PERIOD_INVALID';
  end if;

  if v_dimension='ASSET' then
    return query
    select c.equipment_id,c.equipment_name,count(*)::bigint,
      coalesce(sum(c.parts_cost),0),coalesce(sum(c.labor_cost),0),coalesce(sum(c.total_cost),0)
    from public.cmms_analytics_work_order_cost_v c
    where c.created_at>=p_start_at and c.created_at<p_end_at
    group by c.equipment_id,c.equipment_name
    order by sum(c.total_cost) desc;
  elsif v_dimension='LOCATION' then
    return query
    select coalesce(c.location_id::text,'UNASSIGNED'),coalesce(c.location_name,'Unassigned'),count(*)::bigint,
      coalesce(sum(c.parts_cost),0),coalesce(sum(c.labor_cost),0),coalesce(sum(c.total_cost),0)
    from public.cmms_analytics_work_order_cost_v c
    where c.created_at>=p_start_at and c.created_at<p_end_at
    group by c.location_id,c.location_name
    order by sum(c.total_cost) desc;
  elsif v_dimension='TEAM' then
    return query
    with team_assignment as (
      select distinct on (a.work_order_id)
        a.work_order_id,a.team_id
      from public.cmms_work_order_team_assignment a
      where a.assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM')
      order by a.work_order_id,
        case when a.assignment_role='PRIMARY_TEAM' then 0 else 1 end,
        a.created_at,a.team_id
    )
    select t.team_id::text,t.name,count(c.work_order_id)::bigint,
      coalesce(sum(c.parts_cost),0),coalesce(sum(c.labor_cost),0),coalesce(sum(c.total_cost),0)
    from public.cmms_analytics_work_order_cost_v c
    join team_assignment a on a.work_order_id=c.work_order_id
    join public.cmms_team t on t.team_id=a.team_id
    where c.created_at>=p_start_at and c.created_at<p_end_at
    group by t.team_id,t.name
    order by sum(c.total_cost) desc;
  elsif v_dimension='VENDOR' then
    return query
    with vendor_assignment as (
      select distinct on (a.equipment_id)
        a.equipment_id,a.party_id
      from public.cmms_equipment_party_assignment a
      join public.cmms_business_party bp on bp.party_id=a.party_id
      where a.assignment_role in ('SERVICE_VENDOR','ASSIGNED_VENDOR')
        and bp.party_kind in ('VENDOR','BOTH')
        and bp.active=true and bp.archived_at is null
      order by a.equipment_id,
        case when a.assignment_role='SERVICE_VENDOR' then 0 else 1 end,
        a.created_at,a.party_id
    )
    select bp.party_id::text,bp.company_name,count(c.work_order_id)::bigint,
      coalesce(sum(c.parts_cost),0),coalesce(sum(c.labor_cost),0),coalesce(sum(c.total_cost),0)
    from public.cmms_analytics_work_order_cost_v c
    join vendor_assignment a on a.equipment_id=c.equipment_id
    join public.cmms_business_party bp on bp.party_id=a.party_id
    where c.created_at>=p_start_at and c.created_at<p_end_at
    group by bp.party_id,bp.company_name
    order by sum(c.total_cost) desc;
  else
    raise exception 'ANALYTICS_DIMENSION_INVALID';
  end if;
end $$;

revoke all on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz) from public, anon;
grant execute on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz) to authenticated;

comment on function public.rpc_cmms_analytics_dashboard(timestamptz,timestamptz,uuid,text)
is 'CMMS dashboard KPIs with validated periods, overlap-clipped downtime, location-aware SLA filtering, and period-bounded MTBF.';

comment on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz)
is 'Cost breakdown by ASSET, LOCATION, canonical TEAM, or canonical VENDOR with validated periods and no duplicate assignment inflation.';
