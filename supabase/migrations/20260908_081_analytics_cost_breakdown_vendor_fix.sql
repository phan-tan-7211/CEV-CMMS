-- Align analytics vendor dimension with cmms_business_party.company_name.
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
    select t.team_id::text,t.name,count(distinct c.work_order_id)::bigint,
      coalesce(sum(c.parts_cost),0),coalesce(sum(c.labor_cost),0),coalesce(sum(c.total_cost),0)
    from public.cmms_analytics_work_order_cost_v c
    join public.cmms_work_order_team_assignment a on a.work_order_id=c.work_order_id
    join public.cmms_team t on t.team_id=a.team_id
    where c.created_at>=p_start_at and c.created_at<p_end_at
      and a.assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM')
    group by t.team_id,t.name
    order by sum(c.total_cost) desc;
  elsif v_dimension='VENDOR' then
    return query
    select bp.party_id::text,bp.company_name,count(distinct c.work_order_id)::bigint,
      coalesce(sum(c.parts_cost),0),coalesce(sum(c.labor_cost),0),coalesce(sum(c.total_cost),0)
    from public.cmms_analytics_work_order_cost_v c
    join public.cmms_equipment_party_assignment a on a.equipment_id=c.equipment_id
    join public.cmms_business_party bp on bp.party_id=a.party_id
    where c.created_at>=p_start_at and c.created_at<p_end_at
      and a.assignment_role in ('ASSIGNED_VENDOR','SERVICE_VENDOR')
      and bp.party_kind in ('VENDOR','BOTH')
    group by bp.party_id,bp.company_name
    order by sum(c.total_cost) desc;
  else
    raise exception 'ANALYTICS_DIMENSION_INVALID';
  end if;
end $$;

revoke all on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz) from public, anon;
grant execute on function public.rpc_cmms_analytics_cost_breakdown(text,timestamptz,timestamptz) to authenticated;
