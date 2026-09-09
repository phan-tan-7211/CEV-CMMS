-- OEE production-period foundation.
-- OEE is calculated only from real production period inputs plus downtime_event overlap.

create table if not exists public.cmms_oee_period (
  oee_period_id uuid primary key default gen_random_uuid(),
  equipment_id text not null references public.equipment_master(equipment_id),
  period_start_at timestamptz not null,
  period_end_at timestamptz not null,
  shift_code text,
  planned_production_minutes numeric(14,4) not null,
  ideal_cycle_seconds numeric(14,4) not null,
  total_count numeric(18,4) not null,
  good_count numeric(18,4) not null,
  source_type text not null default 'MANUAL',
  note text,
  source_data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_oee_period_time_chk check (period_end_at > period_start_at),
  constraint cmms_oee_period_planned_chk check (planned_production_minutes > 0),
  constraint cmms_oee_period_cycle_chk check (ideal_cycle_seconds > 0),
  constraint cmms_oee_period_total_chk check (total_count >= 0),
  constraint cmms_oee_period_good_chk check (good_count >= 0 and good_count <= total_count),
  constraint cmms_oee_period_source_chk check (source_type in ('MANUAL','IMPORT','API','MES')),
  constraint cmms_oee_period_natural_uk unique (equipment_id,period_start_at,period_end_at)
);

create index if not exists cmms_oee_period_equipment_time_idx
  on public.cmms_oee_period(equipment_id,period_start_at,period_end_at);

alter table public.cmms_oee_period enable row level security;

drop policy if exists cmms_oee_period_read on public.cmms_oee_period;
create policy cmms_oee_period_read on public.cmms_oee_period
for select to authenticated
using ((select auth.uid()) is not null);

-- App writes go through the validated RPC below; do not expose direct DML.
revoke all on public.cmms_oee_period from anon;
revoke insert, update, delete on public.cmms_oee_period from authenticated;
grant select on public.cmms_oee_period to authenticated;

create or replace function public.rpc_cmms_upsert_oee_period(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role:=public.current_app_role();
  v_id uuid:=nullif(p_input->>'oeePeriodId','')::uuid;
  v_equipment_id text:=nullif(btrim(coalesce(p_input->>'equipmentId','')),'');
  v_start timestamptz:=nullif(p_input->>'periodStartAt','')::timestamptz;
  v_end timestamptz:=nullif(p_input->>'periodEndAt','')::timestamptz;
  v_planned numeric:=nullif(p_input->>'plannedProductionMinutes','')::numeric;
  v_cycle numeric:=nullif(p_input->>'idealCycleSeconds','')::numeric;
  v_total numeric:=nullif(p_input->>'totalCount','')::numeric;
  v_good numeric:=nullif(p_input->>'goodCount','')::numeric;
  v_source text:=upper(coalesce(nullif(btrim(p_input->>'sourceType'),''),'MANUAL'));
  v_elapsed_minutes numeric;
  v_actor_email text;
  v_row public.cmms_oee_period%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'OEE_WRITE_FORBIDDEN'; end if;
  if v_equipment_id is null or v_start is null or v_end is null then raise exception 'OEE_REQUIRED_FIELDS'; end if;
  if v_end<=v_start then raise exception 'OEE_PERIOD_INVALID'; end if;
  if not exists(select 1 from public.equipment_master e where e.equipment_id=v_equipment_id and coalesce(e.active,true)=true) then
    raise exception 'OEE_EQUIPMENT_INVALID';
  end if;

  v_elapsed_minutes:=extract(epoch from (v_end-v_start))/60.0;
  if v_planned is null or v_planned<=0 or v_planned>v_elapsed_minutes then raise exception 'OEE_PLANNED_MINUTES_INVALID'; end if;
  if v_cycle is null or v_cycle<=0 then raise exception 'OEE_IDEAL_CYCLE_INVALID'; end if;
  if v_total is null or v_total<0 then raise exception 'OEE_TOTAL_COUNT_INVALID'; end if;
  if v_good is null or v_good<0 or v_good>v_total then raise exception 'OEE_GOOD_COUNT_INVALID'; end if;
  if v_source not in ('MANUAL','IMPORT','API','MES') then raise exception 'OEE_SOURCE_INVALID'; end if;

  if exists(
    select 1 from public.cmms_oee_period p
    where p.equipment_id=v_equipment_id
      and p.oee_period_id is distinct from v_id
      and p.period_start_at<v_end
      and p.period_end_at>v_start
  ) then
    raise exception 'OEE_PERIOD_OVERLAP';
  end if;

  if v_id is null then
    insert into public.cmms_oee_period(
      equipment_id,period_start_at,period_end_at,shift_code,
      planned_production_minutes,ideal_cycle_seconds,total_count,good_count,
      source_type,note,source_data,created_by,updated_by
    ) values (
      v_equipment_id,v_start,v_end,nullif(btrim(p_input->>'shiftCode'),''),
      v_planned,v_cycle,v_total,v_good,v_source,nullif(btrim(p_input->>'note'),''),
      coalesce(p_input->'sourceData','{}'::jsonb),auth.uid(),auth.uid()
    ) returning * into v_row;
  else
    update public.cmms_oee_period
    set equipment_id=v_equipment_id,
        period_start_at=v_start,
        period_end_at=v_end,
        shift_code=nullif(btrim(p_input->>'shiftCode'),''),
        planned_production_minutes=v_planned,
        ideal_cycle_seconds=v_cycle,
        total_count=v_total,
        good_count=v_good,
        source_type=v_source,
        note=nullif(btrim(p_input->>'note'),''),
        source_data=coalesce(p_input->'sourceData',source_data),
        updated_by=auth.uid(),updated_at=now()
    where oee_period_id=v_id
    returning * into v_row;
    if not found then raise exception 'OEE_PERIOD_NOT_FOUND'; end if;
  end if;

  select coalesce(u.email,auth.jwt()->>'email','unknown') into v_actor_email
  from (select 1) x
  left join public.app_user_role u on u.user_id=auth.uid();

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||gen_random_uuid()::text,
    v_row.equipment_id,
    'OEE_PERIOD',
    v_row.oee_period_id::text,
    case when v_id is null then 'CREATE' else 'UPDATE' end,
    coalesce(v_actor_email,'unknown'),
    jsonb_build_object('equipmentId',v_row.equipment_id,'periodStartAt',v_row.period_start_at,'periodEndAt',v_row.period_end_at)
  );

  return jsonb_build_object('oeePeriodId',v_row.oee_period_id,'equipmentId',v_row.equipment_id,'updatedAt',v_row.updated_at);
end $$;

revoke all on function public.rpc_cmms_upsert_oee_period(jsonb) from public, anon;
grant execute on function public.rpc_cmms_upsert_oee_period(jsonb) to authenticated;

create or replace function public.rpc_cmms_analytics_oee(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_equipment_id text default null
) returns table(
  equipment_id text,
  equipment_name text,
  location_id uuid,
  location_name text,
  period_count bigint,
  planned_production_minutes numeric,
  downtime_minutes numeric,
  operating_minutes numeric,
  total_count numeric,
  good_count numeric,
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
  v_equipment_id text:=nullif(btrim(coalesce(p_equipment_id,'')),'');
begin
  if p_start_at is null or p_end_at is null then raise exception 'ANALYTICS_PERIOD_REQUIRED'; end if;
  if p_start_at>=p_end_at then raise exception 'ANALYTICS_PERIOD_INVALID'; end if;

  return query
  with periods as (
    select p.*,e.equipment_name,e.location_id,l.name as location_name
    from public.cmms_oee_period p
    join public.equipment_master e on e.equipment_id=p.equipment_id
    left join public.cmms_location l on l.location_id=e.location_id
    where p.period_start_at>=p_start_at and p.period_end_at<=p_end_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (v_equipment_id is null or p.equipment_id=v_equipment_id)
  ), period_metrics as (
    select p.*,
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
      ),0) as downtime_minutes
    from periods p
  ), agg as (
    select
      p.equipment_id,max(p.equipment_name) as equipment_name,p.location_id,max(p.location_name) as location_name,
      count(*)::bigint as period_count,
      sum(p.planned_production_minutes)::numeric as planned_minutes,
      least(sum(p.downtime_minutes),sum(p.planned_production_minutes))::numeric as downtime_minutes,
      sum(p.total_count)::numeric as total_count,
      sum(p.good_count)::numeric as good_count,
      sum(p.ideal_cycle_seconds*p.total_count)::numeric as ideal_run_seconds
    from period_metrics p
    group by p.equipment_id,p.location_id
  ), calc as (
    select a.*,
      greatest(a.planned_minutes-a.downtime_minutes,0)::numeric as operating_minutes
    from agg a
  )
  select
    c.equipment_id,c.equipment_name,c.location_id,c.location_name,c.period_count,
    round(c.planned_minutes,2),round(c.downtime_minutes,2),round(c.operating_minutes,2),
    round(c.total_count,2),round(c.good_count,2),
    case when c.planned_minutes<=0 then null else round(least(c.operating_minutes/c.planned_minutes,1)*100,2) end,
    case when c.operating_minutes<=0 then null else round(least(c.ideal_run_seconds/(c.operating_minutes*60),1)*100,2) end,
    case when c.total_count<=0 then null else round(least(c.good_count/c.total_count,1)*100,2) end,
    case when c.planned_minutes<=0 or c.operating_minutes<=0 or c.total_count<=0 then null
      else round(
        least(c.operating_minutes/c.planned_minutes,1)
        * least(c.ideal_run_seconds/(c.operating_minutes*60),1)
        * least(c.good_count/c.total_count,1) * 100,2)
    end
  from calc c
  order by c.equipment_name,c.equipment_id;
end $$;

revoke all on function public.rpc_cmms_analytics_oee(timestamptz,timestamptz,uuid,text) from public, anon;
grant execute on function public.rpc_cmms_analytics_oee(timestamptz,timestamptz,uuid,text) to authenticated;
