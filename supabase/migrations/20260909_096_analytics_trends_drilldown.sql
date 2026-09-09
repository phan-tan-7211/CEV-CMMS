-- Analytics trends + drill-down foundation.
-- Uses local-calendar buckets and never prorates production counts across buckets.

create or replace function public.rpc_cmms_analytics_trends(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_bucket text default 'DAY',
  p_timezone text default 'Asia/Ho_Chi_Minh',
  p_location_id uuid default null,
  p_equipment_id text default null
) returns table(
  bucket_start_at timestamptz,
  bucket_end_at timestamptz,
  work_orders_created bigint,
  work_orders_completed bigint,
  downtime_events bigint,
  downtime_minutes numeric,
  maintenance_cost numeric,
  availability_percent numeric,
  performance_percent numeric,
  quality_percent numeric,
  oee_percent numeric
)
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_bucket text:=upper(trim(coalesce(p_bucket,'DAY')));
  v_equipment_id text:=nullif(btrim(coalesce(p_equipment_id,'')),'');
  v_step interval;
  v_trunc text;
begin
  if p_start_at is null or p_end_at is null then raise exception 'ANALYTICS_PERIOD_REQUIRED'; end if;
  if p_start_at>=p_end_at then raise exception 'ANALYTICS_PERIOD_INVALID'; end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'ANALYTICS_TIMEZONE_INVALID'; end if;

  if v_bucket='DAY' then v_step:=interval '1 day'; v_trunc:='day';
  elsif v_bucket='WEEK' then v_step:=interval '1 week'; v_trunc:='week';
  elsif v_bucket='MONTH' then v_step:=interval '1 month'; v_trunc:='month';
  else raise exception 'ANALYTICS_BUCKET_INVALID';
  end if;

  return query
  with bucket_local as (
    select gs as local_start, gs+v_step as local_end
    from generate_series(
      date_trunc(v_trunc,p_start_at at time zone p_timezone),
      date_trunc(v_trunc,(p_end_at-interval '1 microsecond') at time zone p_timezone),
      v_step
    ) gs
  ), buckets as (
    select
      greatest(local_start at time zone p_timezone,p_start_at) as bucket_start,
      least(local_end at time zone p_timezone,p_end_at) as bucket_end
    from bucket_local
  ), equipment_scope as (
    select e.equipment_id
    from public.equipment_master e
    where (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or e.equipment_id=v_equipment_id)
  ), bucket_metrics as (
    select
      b.bucket_start,
      b.bucket_end,
      (
        select count(*)::bigint
        from public.maintenance_work_order w
        join equipment_scope es on es.equipment_id=w.equipment_id
        where w.created_at>=b.bucket_start and w.created_at<b.bucket_end
      ) as wo_created,
      (
        select count(*)::bigint
        from public.maintenance_work_order w
        join equipment_scope es on es.equipment_id=w.equipment_id
        where w.created_at>=b.bucket_start and w.created_at<b.bucket_end
          and upper(w.status) in ('COMPLETED','COMPLETE','CLOSED')
      ) as wo_completed,
      (
        select count(*)::bigint
        from public.downtime_event d
        join equipment_scope es on es.equipment_id=d.equipment_id
        where d.started_at is not null
          and (d.ended_at is null or d.ended_at>=d.started_at)
          and d.started_at<b.bucket_end
          and coalesce(d.ended_at,b.bucket_end)>b.bucket_start
      ) as dt_events,
      coalesce((
        select sum(extract(epoch from (
          least(coalesce(d.ended_at,b.bucket_end),b.bucket_end)
          - greatest(d.started_at,b.bucket_start)
        ))/60.0)
        from public.downtime_event d
        join equipment_scope es on es.equipment_id=d.equipment_id
        where d.started_at is not null
          and (d.ended_at is null or d.ended_at>=d.started_at)
          and d.started_at<b.bucket_end
          and coalesce(d.ended_at,b.bucket_end)>b.bucket_start
      ),0)::numeric as dt_minutes,
      coalesce((
        select sum(c.total_cost)
        from public.cmms_analytics_work_order_cost_v c
        join equipment_scope es on es.equipment_id=c.equipment_id
        where c.created_at>=b.bucket_start and c.created_at<b.bucket_end
      ),0)::numeric as total_cost
    from buckets b
  ), oee_periods as (
    select b.bucket_start,b.bucket_end,p.*
    from buckets b
    join public.cmms_oee_period p
      on p.period_start_at>=b.bucket_start
     and p.period_end_at<=b.bucket_end
    join equipment_scope es on es.equipment_id=p.equipment_id
  ), oee_period_metrics as (
    select p.*,
      least(
        coalesce((
          select sum(extract(epoch from (
            least(coalesce(d.ended_at,p.period_end_at),p.period_end_at)
            - greatest(d.started_at,p.period_start_at)
          ))/60.0)
          from public.downtime_event d
          where d.equipment_id=p.equipment_id
            and d.started_at is not null
            and (d.ended_at is null or d.ended_at>=d.started_at)
            and d.started_at<p.period_end_at
            and coalesce(d.ended_at,p.period_end_at)>p.period_start_at
        ),0),
        p.planned_production_minutes
      )::numeric as oee_downtime_minutes
    from oee_periods p
  ), oee_agg as (
    select
      p.bucket_start,p.bucket_end,
      sum(p.planned_production_minutes)::numeric as planned_minutes,
      sum(p.oee_downtime_minutes)::numeric as oee_downtime_minutes,
      sum(p.total_count)::numeric as total_count,
      sum(p.good_count)::numeric as good_count,
      sum(p.ideal_cycle_seconds*p.total_count)::numeric as ideal_run_seconds
    from oee_period_metrics p
    group by p.bucket_start,p.bucket_end
  )
  select
    m.bucket_start,
    m.bucket_end,
    m.wo_created,
    m.wo_completed,
    m.dt_events,
    round(m.dt_minutes,2),
    round(m.total_cost,2),
    case when coalesce(o.planned_minutes,0)<=0 then null
      else round(least(greatest(o.planned_minutes-o.oee_downtime_minutes,0)/o.planned_minutes,1)*100,2) end,
    case when coalesce(o.planned_minutes-o.oee_downtime_minutes,0)<=0 then null
      else round(least(o.ideal_run_seconds/(greatest(o.planned_minutes-o.oee_downtime_minutes,0)*60),1)*100,2) end,
    case when coalesce(o.total_count,0)<=0 then null
      else round(least(o.good_count/o.total_count,1)*100,2) end,
    case when coalesce(o.planned_minutes,0)<=0
           or coalesce(o.planned_minutes-o.oee_downtime_minutes,0)<=0
           or coalesce(o.total_count,0)<=0 then null
      else round(
        least(greatest(o.planned_minutes-o.oee_downtime_minutes,0)/o.planned_minutes,1)
        * least(o.ideal_run_seconds/(greatest(o.planned_minutes-o.oee_downtime_minutes,0)*60),1)
        * least(o.good_count/o.total_count,1) * 100,2
      ) end
  from bucket_metrics m
  left join oee_agg o on o.bucket_start=m.bucket_start and o.bucket_end=m.bucket_end
  order by m.bucket_start;
end $$;

revoke all on function public.rpc_cmms_analytics_trends(timestamptz,timestamptz,text,text,uuid,text) from public, anon;
grant execute on function public.rpc_cmms_analytics_trends(timestamptz,timestamptz,text,text,uuid,text) to authenticated;

create or replace function public.rpc_cmms_analytics_drilldown(
  p_metric text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_equipment_id text default null,
  p_limit integer default 100,
  p_offset integer default 0
) returns table(
  item_type text,
  item_id text,
  occurred_at timestamptz,
  equipment_id text,
  equipment_name text,
  location_id uuid,
  location_name text,
  status text,
  title text,
  value_numeric numeric,
  secondary_numeric numeric,
  detail jsonb
)
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_metric text:=upper(trim(coalesce(p_metric,'')));
  v_equipment_id text:=nullif(btrim(coalesce(p_equipment_id,'')),'');
  v_limit integer:=least(greatest(coalesce(p_limit,100),1),200);
  v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if p_start_at is null or p_end_at is null then raise exception 'ANALYTICS_PERIOD_REQUIRED'; end if;
  if p_start_at>=p_end_at then raise exception 'ANALYTICS_PERIOD_INVALID'; end if;
  if v_metric not in ('DOWNTIME','WORK_ORDER','COST','OEE') then raise exception 'ANALYTICS_METRIC_INVALID'; end if;

  if v_metric='DOWNTIME' then
    return query
    select
      'DOWNTIME'::text,d.downtime_id,d.started_at,d.equipment_id,e.equipment_name,e.location_id,l.name,
      case when d.ended_at is null then 'OPEN' else 'CLOSED' end::text,
      coalesce(nullif(d.source_data->>'reason',''),'Downtime')::text,
      round((extract(epoch from (
        least(coalesce(d.ended_at,p_end_at),p_end_at)-greatest(d.started_at,p_start_at)
      ))/60.0)::numeric,2),
      null::numeric,
      jsonb_build_object('startedAt',d.started_at,'endedAt',d.ended_at,'workOrderId',d.work_order_id,'isOpen',d.ended_at is null)
    from public.downtime_event d
    join public.equipment_master e on e.equipment_id=d.equipment_id
    left join public.cmms_location l on l.location_id=e.location_id
    where d.started_at is not null
      and (d.ended_at is null or d.ended_at>=d.started_at)
      and d.started_at<p_end_at
      and coalesce(d.ended_at,p_end_at)>p_start_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or d.equipment_id=v_equipment_id)
    order by d.started_at desc,d.downtime_id
    limit v_limit offset v_offset;

  elsif v_metric='WORK_ORDER' then
    return query
    select
      'WORK_ORDER'::text,w.work_order_id,w.created_at,w.equipment_id,e.equipment_name,e.location_id,l.name,
      w.status,coalesce(nullif(w.reason,''),'Work Order')::text,
      null::numeric,null::numeric,
      jsonb_build_object('priority',w.priority,'sourceType',w.source_type,'updatedAt',w.updated_at)
    from public.maintenance_work_order w
    join public.equipment_master e on e.equipment_id=w.equipment_id
    left join public.cmms_location l on l.location_id=e.location_id
    where w.created_at>=p_start_at and w.created_at<p_end_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or w.equipment_id=v_equipment_id)
    order by w.created_at desc,w.work_order_id
    limit v_limit offset v_offset;

  elsif v_metric='COST' then
    return query
    select
      'COST'::text,c.work_order_id,c.created_at,c.equipment_id,c.equipment_name,c.location_id,c.location_name,
      c.status,coalesce(nullif(c.source_type,''),'Maintenance cost')::text,
      round(c.total_cost,2),round(c.parts_cost,2),
      jsonb_build_object('partsCost',round(c.parts_cost,2),'laborCost',round(c.labor_cost,2),'laborMinutes',c.labor_minutes)
    from public.cmms_analytics_work_order_cost_v c
    where c.created_at>=p_start_at and c.created_at<p_end_at
      and (p_location_id is null or c.location_id=p_location_id)
      and (v_equipment_id is null or c.equipment_id=v_equipment_id)
    order by c.total_cost desc,c.created_at desc,c.work_order_id
    limit v_limit offset v_offset;

  else
    return query
    with periods as (
      select
        p.*,e.equipment_name,e.location_id,l.name as location_name,
        least(
          coalesce((
            select sum(extract(epoch from (
              least(coalesce(d.ended_at,p.period_end_at),p.period_end_at)
              - greatest(d.started_at,p.period_start_at)
            ))/60.0)
            from public.downtime_event d
            where d.equipment_id=p.equipment_id
              and d.started_at is not null
              and (d.ended_at is null or d.ended_at>=d.started_at)
              and d.started_at<p.period_end_at
              and coalesce(d.ended_at,p.period_end_at)>p.period_start_at
          ),0),
          p.planned_production_minutes
        )::numeric as dt_minutes
      from public.cmms_oee_period p
      join public.equipment_master e on e.equipment_id=p.equipment_id
      left join public.cmms_location l on l.location_id=e.location_id
      where p.period_start_at>=p_start_at and p.period_end_at<=p_end_at
        and (p_location_id is null or e.location_id=p_location_id)
        and (v_equipment_id is null or p.equipment_id=v_equipment_id)
    )
    select
      'OEE'::text,p.oee_period_id::text,p.period_start_at,p.equipment_id,p.equipment_name,p.location_id,p.location_name,
      p.source_type,coalesce(nullif(p.shift_code,''),'Production period')::text,
      case
        when p.planned_production_minutes<=0 or (p.planned_production_minutes-p.dt_minutes)<=0 or p.total_count<=0 then null
        else round(
          least((p.planned_production_minutes-p.dt_minutes)/p.planned_production_minutes,1)
          * least((p.ideal_cycle_seconds*p.total_count)/((p.planned_production_minutes-p.dt_minutes)*60),1)
          * least(p.good_count/p.total_count,1) * 100,2
        )
      end,
      round(p.dt_minutes,2),
      jsonb_build_object(
        'periodEndAt',p.period_end_at,
        'shiftCode',p.shift_code,
        'plannedMinutes',p.planned_production_minutes,
        'downtimeMinutes',round(p.dt_minutes,2),
        'totalCount',p.total_count,
        'goodCount',p.good_count,
        'availabilityPercent',case when p.planned_production_minutes<=0 then null else round(least((p.planned_production_minutes-p.dt_minutes)/p.planned_production_minutes,1)*100,2) end,
        'performancePercent',case when (p.planned_production_minutes-p.dt_minutes)<=0 then null else round(least((p.ideal_cycle_seconds*p.total_count)/((p.planned_production_minutes-p.dt_minutes)*60),1)*100,2) end,
        'qualityPercent',case when p.total_count<=0 then null else round(least(p.good_count/p.total_count,1)*100,2) end
      )
    from periods p
    order by p.period_start_at desc,p.oee_period_id
    limit v_limit offset v_offset;
  end if;
end $$;

revoke all on function public.rpc_cmms_analytics_drilldown(text,timestamptz,timestamptz,uuid,text,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_analytics_drilldown(text,timestamptz,timestamptz,uuid,text,integer,integer) to authenticated;

comment on function public.rpc_cmms_analytics_trends(timestamptz,timestamptz,text,text,uuid,text)
is 'Calendar-bucket analytics trends for WO, downtime, maintenance cost, and OEE. OEE periods must fit fully inside a bucket; production counts are never prorated.';

comment on function public.rpc_cmms_analytics_drilldown(text,timestamptz,timestamptz,uuid,text,integer,integer)
is 'Paginated analytics drill-down for DOWNTIME, WORK_ORDER, COST, and OEE, with location/equipment filters.';
