-- Scheduler engine foundation for UpKeep-style work planning.
-- Normalizes planned time on work orders, exposes schedule events (WO + PM due),
-- detects equipment/person/team conflicts, and provides an atomic reschedule RPC.

alter table public.maintenance_work_order
  add column if not exists planned_start_at timestamptz,
  add column if not exists planned_end_at timestamptz,
  add column if not exists schedule_locked boolean not null default false,
  add column if not exists schedule_note text;

-- Backfill normalized schedule columns from legacy/source_data values when possible.
update public.maintenance_work_order
set
  planned_start_at = coalesce(
    planned_start_at,
    case
      when nullif(source_data->>'plannedStartAt','') is not null
        and (source_data->>'plannedStartAt') ~ '^\d{4}-\d{2}-\d{2}'
      then (source_data->>'plannedStartAt')::timestamptz
      else null
    end
  ),
  planned_end_at = coalesce(
    planned_end_at,
    case
      when nullif(source_data->>'plannedEndAt','') is not null
        and (source_data->>'plannedEndAt') ~ '^\d{4}-\d{2}-\d{2}'
      then (source_data->>'plannedEndAt')::timestamptz
      else null
    end
  )
where planned_start_at is null or planned_end_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.maintenance_work_order'::regclass
      and conname='maintenance_work_order_schedule_window_valid'
  ) then
    alter table public.maintenance_work_order
      add constraint maintenance_work_order_schedule_window_valid
      check (
        (planned_start_at is null and planned_end_at is null)
        or (planned_start_at is not null and planned_end_at is not null and planned_end_at > planned_start_at)
      );
  end if;
end $$;

create index if not exists maintenance_work_order_schedule_window_idx
  on public.maintenance_work_order (planned_start_at, planned_end_at)
  where planned_start_at is not null and planned_end_at is not null;

create index if not exists maintenance_work_order_schedule_status_idx
  on public.maintenance_work_order (status, planned_start_at);

create or replace function public.rpc_cmms_scheduler_conflicts(
  p_work_order_id text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_person_id uuid default null,
  p_team_id uuid default null
) returns table(
  conflict_type text,
  conflicting_work_order_id text,
  resource_id text,
  resource_name text,
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  status text,
  title text
)
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_equipment_id text;
begin
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'SCHEDULER_WINDOW_INVALID';
  end if;

  select w.equipment_id into v_equipment_id
  from public.maintenance_work_order w
  where w.work_order_id=p_work_order_id;

  if v_equipment_id is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  return query
  with active_wo as (
    select w.*
    from public.maintenance_work_order w
    where w.work_order_id<>p_work_order_id
      and upper(coalesce(w.status,'')) not in ('COMPLETED','COMPLETE','VERIFIED','RELEASED','CANCELLED','CLOSED')
      and w.planned_start_at is not null
      and w.planned_end_at is not null
      and w.planned_start_at < p_end_at
      and w.planned_end_at > p_start_at
  ), conflicts as (
    select
      'EQUIPMENT'::text as conflict_type,
      w.work_order_id,
      w.equipment_id::text as resource_id,
      coalesce(e.equipment_name,w.equipment_id)::text as resource_name,
      w.planned_start_at,w.planned_end_at,w.status,
      coalesce(nullif(w.reason,''),'Work Order')::text as title
    from active_wo w
    left join public.equipment_master e on e.equipment_id=w.equipment_id
    where w.equipment_id=v_equipment_id

    union all

    select
      'PERSON'::text,
      w.work_order_id,
      a.person_id::text,
      coalesce(p.display_name,p.email,a.person_id::text)::text,
      w.planned_start_at,w.planned_end_at,w.status,
      coalesce(nullif(w.reason,''),'Work Order')::text
    from active_wo w
    join public.cmms_work_order_person_assignment a on a.work_order_id=w.work_order_id
    left join public.cmms_person p on p.person_id=a.person_id
    where p_person_id is not null
      and a.person_id=p_person_id
      and a.assignment_role in ('PRIMARY_ASSIGNEE','ASSIGNEE')

    union all

    select
      'TEAM'::text,
      w.work_order_id,
      a.team_id::text,
      coalesce(t.name,a.team_id::text)::text,
      w.planned_start_at,w.planned_end_at,w.status,
      coalesce(nullif(w.reason,''),'Work Order')::text
    from active_wo w
    join public.cmms_work_order_team_assignment a on a.work_order_id=w.work_order_id
    left join public.cmms_team t on t.team_id=a.team_id
    where p_team_id is not null
      and a.team_id=p_team_id
      and a.assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM')
  )
  select c.conflict_type,c.work_order_id,c.resource_id,c.resource_name,
         c.planned_start_at,c.planned_end_at,c.status,c.title
  from conflicts c
  order by c.planned_start_at,c.conflict_type,c.work_order_id;
end $$;

revoke all on function public.rpc_cmms_scheduler_conflicts(text,timestamptz,timestamptz,uuid,uuid) from public, anon;
grant execute on function public.rpc_cmms_scheduler_conflicts(text,timestamptz,timestamptz,uuid,uuid) to authenticated;

create or replace function public.rpc_cmms_scheduler_events(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_person_id uuid default null,
  p_team_id uuid default null,
  p_include_unscheduled boolean default true,
  p_limit integer default 1000
) returns table(
  event_type text,
  event_id text,
  work_order_id text,
  pm_schedule_id uuid,
  equipment_id text,
  equipment_name text,
  location_id uuid,
  location_name text,
  title text,
  status text,
  priority text,
  start_at timestamptz,
  end_at timestamptz,
  schedule_locked boolean,
  primary_person_id uuid,
  primary_person_name text,
  primary_team_id uuid,
  primary_team_name text,
  unscheduled boolean,
  source_data jsonb
)
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_limit integer:=least(greatest(coalesce(p_limit,1000),1),5000);
begin
  if p_start_at is null or p_end_at is null or p_end_at<=p_start_at then
    raise exception 'SCHEDULER_PERIOD_INVALID';
  end if;

  return query
  with wo as (
    select
      w.work_order_id,w.equipment_id,w.reason,w.status,w.priority,w.planned_start_at,w.planned_end_at,
      w.schedule_locked,w.source_data,e.equipment_name,e.location_id,l.name as location_name,
      pa.person_id as primary_person_id,coalesce(cp.display_name,cp.email) as primary_person_name,
      ta.team_id as primary_team_id,ct.name as primary_team_name
    from public.maintenance_work_order w
    join public.equipment_master e on e.equipment_id=w.equipment_id
    left join public.cmms_location l on l.location_id=e.location_id
    left join lateral (
      select a.person_id from public.cmms_work_order_person_assignment a
      where a.work_order_id=w.work_order_id and a.assignment_role='PRIMARY_ASSIGNEE'
      order by a.created_at,a.person_id limit 1
    ) pa on true
    left join public.cmms_person cp on cp.person_id=pa.person_id
    left join lateral (
      select a.team_id from public.cmms_work_order_team_assignment a
      where a.work_order_id=w.work_order_id and a.assignment_role='PRIMARY_TEAM'
      order by a.created_at,a.team_id limit 1
    ) ta on true
    left join public.cmms_team ct on ct.team_id=ta.team_id
    where upper(coalesce(w.status,'')) not in ('RELEASED','CANCELLED','CLOSED')
      and (p_location_id is null or e.location_id=p_location_id)
      and (p_person_id is null or exists(
        select 1 from public.cmms_work_order_person_assignment x
        where x.work_order_id=w.work_order_id and x.person_id=p_person_id
          and x.assignment_role in ('PRIMARY_ASSIGNEE','ASSIGNEE')
      ))
      and (p_team_id is null or exists(
        select 1 from public.cmms_work_order_team_assignment x
        where x.work_order_id=w.work_order_id and x.team_id=p_team_id
          and x.assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM')
      ))
      and (
        (w.planned_start_at is not null and w.planned_end_at is not null
          and w.planned_start_at<p_end_at and w.planned_end_at>p_start_at)
        or (p_include_unscheduled and w.planned_start_at is null and w.planned_end_at is null)
      )
  ), pm as (
    select
      s.schedule_id,s.equipment_id,s.title,s.priority,s.next_due_at,s.lead_time_minutes,s.source_data,
      e.equipment_name,e.location_id,l.name as location_name,
      s.default_person_id,coalesce(cp.display_name,cp.email) as person_name,
      s.default_team_id,ct.name as team_name
    from public.cmms_pm_schedule s
    join public.equipment_master e on e.equipment_id=s.equipment_id
    left join public.cmms_location l on l.location_id=e.location_id
    left join public.cmms_person cp on cp.person_id=s.default_person_id
    left join public.cmms_team ct on ct.team_id=s.default_team_id
    where s.active=true and s.archived_at is null and s.next_due_at is not null
      and s.next_due_at>=p_start_at and s.next_due_at<p_end_at
      and (p_location_id is null or e.location_id=p_location_id)
      and (p_person_id is null or s.default_person_id=p_person_id)
      and (p_team_id is null or s.default_team_id=p_team_id)
  ), all_events as (
    select
      'WORK_ORDER'::text as event_type,w.work_order_id::text as event_id,w.work_order_id,
      null::uuid as pm_schedule_id,w.equipment_id,w.equipment_name,w.location_id,w.location_name,
      coalesce(nullif(w.reason,''),'Work Order')::text as title,w.status,w.priority,
      w.planned_start_at as start_at,w.planned_end_at as end_at,w.schedule_locked,
      w.primary_person_id,w.primary_person_name,w.primary_team_id,w.primary_team_name,
      (w.planned_start_at is null)::boolean as unscheduled,w.source_data
    from wo w

    union all

    select
      'PM_DUE'::text,s.schedule_id::text,null::text,s.schedule_id,s.equipment_id,s.equipment_name,
      s.location_id,s.location_name,coalesce(nullif(s.title,''),'Preventive Maintenance')::text,
      'DUE'::text,s.priority,
      s.next_due_at,
      s.next_due_at + make_interval(mins=>greatest(coalesce((s.source_data->>'durationMinutes')::integer,60),1)),
      true,
      s.default_person_id,s.person_name,s.default_team_id,s.team_name,false,s.source_data
    from pm s
  )
  select a.event_type,a.event_id,a.work_order_id,a.pm_schedule_id,a.equipment_id,a.equipment_name,
         a.location_id,a.location_name,a.title,a.status,a.priority,a.start_at,a.end_at,
         a.schedule_locked,a.primary_person_id,a.primary_person_name,a.primary_team_id,
         a.primary_team_name,a.unscheduled,a.source_data
  from all_events a
  order by a.unscheduled,a.start_at nulls last,a.priority nulls last,a.event_id
  limit v_limit;
end $$;

revoke all on function public.rpc_cmms_scheduler_events(timestamptz,timestamptz,uuid,uuid,uuid,boolean,integer) from public, anon;
grant execute on function public.rpc_cmms_scheduler_events(timestamptz,timestamptz,uuid,uuid,uuid,boolean,integer) to authenticated;

create or replace function public.rpc_cmms_reschedule_work_order(
  p_work_order_id text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_person_id uuid default null,
  p_team_id uuid default null,
  p_allow_conflict boolean default false,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=coalesce(public.current_app_role()::text,'');
  v_uid uuid:=auth.uid();
  v_email text:=coalesce(auth.jwt()->>'email','');
  v_work_order public.maintenance_work_order%rowtype;
  v_conflict_count integer:=0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'SCHEDULER_FORBIDDEN'; end if;

  select * into v_work_order from public.maintenance_work_order
  where work_order_id=p_work_order_id for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if upper(coalesce(v_work_order.status,'')) in ('COMPLETED','COMPLETE','VERIFIED','RELEASED','CANCELLED','CLOSED') then
    raise exception 'SCHEDULER_TERMINAL_WORK_ORDER';
  end if;
  if v_work_order.schedule_locked and v_role<>'ADMIN' then raise exception 'SCHEDULER_LOCKED'; end if;

  if (p_start_at is null) <> (p_end_at is null) then raise exception 'SCHEDULER_WINDOW_INVALID'; end if;
  if p_start_at is not null and p_end_at<=p_start_at then raise exception 'SCHEDULER_WINDOW_INVALID'; end if;
  if p_start_at is not null and p_end_at-p_start_at>interval '14 days' then raise exception 'SCHEDULER_DURATION_TOO_LONG'; end if;

  if p_person_id is not null and not exists(
    select 1 from public.cmms_person p where p.person_id=p_person_id and p.active=true and p.archived_at is null
  ) then raise exception 'SCHEDULER_PERSON_INVALID'; end if;
  if p_team_id is not null and not exists(
    select 1 from public.cmms_team t where t.team_id=p_team_id and t.active=true and t.archived_at is null
  ) then raise exception 'SCHEDULER_TEAM_INVALID'; end if;

  if p_start_at is not null and not p_allow_conflict then
    select count(*) into v_conflict_count
    from public.rpc_cmms_scheduler_conflicts(p_work_order_id,p_start_at,p_end_at,p_person_id,p_team_id);
    if v_conflict_count>0 then raise exception 'SCHEDULER_CONFLICT'; end if;
  end if;

  update public.maintenance_work_order
  set planned_start_at=p_start_at,
      planned_end_at=p_end_at,
      schedule_note=nullif(btrim(coalesce(p_note,'')),''),
      source_data=coalesce(source_data,'{}'::jsonb)
        || jsonb_build_object('plannedStartAt',p_start_at,'plannedEndAt',p_end_at),
      updated_at=now()
  where work_order_id=p_work_order_id;

  if p_person_id is not null then
    delete from public.cmms_work_order_person_assignment
    where work_order_id=p_work_order_id and assignment_role='PRIMARY_ASSIGNEE';
    insert into public.cmms_work_order_person_assignment(work_order_id,person_id,assignment_role,created_by)
    values(p_work_order_id,p_person_id,'PRIMARY_ASSIGNEE',v_uid)
    on conflict do nothing;
  end if;

  if p_team_id is not null then
    delete from public.cmms_work_order_team_assignment
    where work_order_id=p_work_order_id and assignment_role='PRIMARY_TEAM';
    insert into public.cmms_work_order_team_assignment(work_order_id,team_id,assignment_role,created_by)
    values(p_work_order_id,p_team_id,'PRIMARY_TEAM',v_uid)
    on conflict do nothing;
  end if;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail,created_at)
  values(
    'AUD-SCH-'||replace(gen_random_uuid()::text,'-',''),v_work_order.equipment_id,'WORK_ORDER',p_work_order_id,
    case when p_start_at is null then 'UNSCHEDULE' else 'RESCHEDULE' end,
    v_email,
    jsonb_build_object(
      'oldStartAt',v_work_order.planned_start_at,'oldEndAt',v_work_order.planned_end_at,
      'newStartAt',p_start_at,'newEndAt',p_end_at,'personId',p_person_id,'teamId',p_team_id,
      'allowConflict',p_allow_conflict,'note',nullif(btrim(coalesce(p_note,'')),'')
    ),now()
  );

  return jsonb_build_object(
    'workOrderId',p_work_order_id,
    'plannedStartAt',p_start_at,
    'plannedEndAt',p_end_at,
    'personId',p_person_id,
    'teamId',p_team_id,
    'unscheduled',p_start_at is null
  );
end $$;

revoke all on function public.rpc_cmms_reschedule_work_order(text,timestamptz,timestamptz,uuid,uuid,boolean,text) from public, anon;
grant execute on function public.rpc_cmms_reschedule_work_order(text,timestamptz,timestamptz,uuid,uuid,boolean,text) to authenticated;

create or replace function public.rpc_cmms_set_work_order_schedule_lock(
  p_work_order_id text,
  p_locked boolean
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=coalesce(public.current_app_role()::text,'');
  v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role not in ('MANAGER','ADMIN') then raise exception 'SCHEDULER_LOCK_FORBIDDEN'; end if;
  update public.maintenance_work_order
  set schedule_locked=coalesce(p_locked,false),updated_at=now()
  where work_order_id=p_work_order_id;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  return coalesce(p_locked,false);
end $$;

revoke all on function public.rpc_cmms_set_work_order_schedule_lock(text,boolean) from public, anon;
grant execute on function public.rpc_cmms_set_work_order_schedule_lock(text,boolean) to authenticated;

comment on function public.rpc_cmms_scheduler_events(timestamptz,timestamptz,uuid,uuid,uuid,boolean,integer)
is 'Scheduler feed for scheduled/unscheduled work orders and PM due events.';
comment on function public.rpc_cmms_scheduler_conflicts(text,timestamptz,timestamptz,uuid,uuid)
is 'Detect overlapping active work on the same equipment, person, or team.';
comment on function public.rpc_cmms_reschedule_work_order(text,timestamptz,timestamptz,uuid,uuid,boolean,text)
is 'Atomic schedule/unschedule/reassign operation for drag-drop and resize workflows.';
