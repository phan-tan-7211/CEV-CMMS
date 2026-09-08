-- Preventive-maintenance read/write/generation RPCs.

create or replace function public.cmms_pm_next_time_due(
  p_base timestamptz,
  p_interval integer,
  p_unit text
) returns timestamptz
language plpgsql
immutable
security invoker
set search_path=public
as $$
begin
  if p_interval is null or p_interval <= 0 then raise exception 'PM_INTERVAL_INVALID'; end if;
  case upper(trim(p_unit))
    when 'HOURS' then return p_base + make_interval(hours => p_interval);
    when 'DAYS' then return p_base + make_interval(days => p_interval);
    when 'WEEKS' then return p_base + make_interval(days => p_interval * 7);
    when 'MONTHS' then return p_base + make_interval(months => p_interval);
    when 'YEARS' then return p_base + make_interval(years => p_interval);
    else raise exception 'PM_TIME_UNIT_INVALID';
  end case;
end $$;
revoke all on function public.cmms_pm_next_time_due(timestamptz,integer,text) from public, anon;
grant execute on function public.cmms_pm_next_time_due(timestamptz,integer,text) to authenticated;

create or replace function public.rpc_cmms_record_meter_reading(
  p_meter_id uuid,
  p_value numeric,
  p_recorded_at timestamptz default now(),
  p_source_type text default 'MANUAL',
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_meter public.cmms_meter%rowtype;
  v_previous numeric;
  v_reading_id uuid;
  v_source text := upper(trim(coalesce(p_source_type,'MANUAL')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'METER_READING_ROLE_DENIED'; end if;

  select * into v_meter from public.cmms_meter where meter_id=p_meter_id and active=true and archived_at is null;
  if not found then raise exception 'ACTIVE_METER_NOT_FOUND'; end if;
  if v_source not in ('MANUAL','IMPORT','IOT','WORK_ORDER','API') then raise exception 'METER_SOURCE_INVALID'; end if;

  select reading_value into v_previous
  from public.cmms_meter_reading where meter_id=p_meter_id
  order by recorded_at desc, created_at desc limit 1;

  if v_previous is not null and p_value < v_previous and v_meter.rollover_value is null then
    raise exception 'METER_READING_DECREASE_NOT_ALLOWED';
  end if;

  insert into public.cmms_meter_reading(meter_id,reading_value,recorded_at,recorded_by,source_type,note)
  values(p_meter_id,p_value,coalesce(p_recorded_at,now()),auth.uid(),v_source,nullif(btrim(coalesce(p_note,'')),''))
  returning reading_id into v_reading_id;

  return jsonb_build_object('readingId',v_reading_id,'meterId',p_meter_id,'value',p_value,'previousValue',v_previous,'recordedAt',coalesce(p_recorded_at,now()));
end $$;
revoke all on function public.rpc_cmms_record_meter_reading(uuid,numeric,timestamptz,text,text) from public, anon;
grant execute on function public.rpc_cmms_record_meter_reading(uuid,numeric,timestamptz,text,text) to authenticated;

create or replace function public.rpc_cmms_pm_schedule_detail(p_schedule_id uuid)
returns jsonb
language sql
security invoker
set search_path=public
as $$
  select jsonb_build_object(
    'schedule',to_jsonb(s),
    'equipment',to_jsonb(e),
    'meter',case when m.meter_id is null then null else to_jsonb(m) end,
    'latestMeterReading',(
      select to_jsonb(r) from public.cmms_meter_reading r where r.meter_id=s.meter_id order by r.recorded_at desc,r.created_at desc limit 1
    ),
    'checklistTemplate',case when t.template_id is null then null else to_jsonb(t) end,
    'checklistItems',coalesce((
      select jsonb_agg(to_jsonb(i) order by i.sequence_no)
      from public.cmms_checklist_template_item i where i.template_id=s.checklist_template_id
    ),'[]'::jsonb),
    'defaultPerson',case when p.person_id is null then null else to_jsonb(p) end,
    'defaultTeam',case when tm.team_id is null then null else to_jsonb(tm) end
  )
  from public.cmms_pm_schedule s
  join public.equipment_master e on e.equipment_id=s.equipment_id
  left join public.cmms_meter m on m.meter_id=s.meter_id
  left join public.cmms_checklist_template t on t.template_id=s.checklist_template_id
  left join public.cmms_person p on p.person_id=s.default_person_id
  left join public.cmms_team tm on tm.team_id=s.default_team_id
  where s.schedule_id=p_schedule_id
$$;
revoke all on function public.rpc_cmms_pm_schedule_detail(uuid) from public, anon;
grant execute on function public.rpc_cmms_pm_schedule_detail(uuid) to authenticated;

create or replace function public.rpc_cmms_pm_due_list(
  p_as_of timestamptz default now(),
  p_include_not_due boolean default false
) returns table(
  schedule_id uuid,
  equipment_id text,
  title text,
  schedule_type text,
  next_due_at timestamptz,
  next_meter_due numeric,
  latest_meter_value numeric,
  time_due boolean,
  meter_due boolean,
  is_due boolean
)
language sql
security invoker
set search_path=public
as $$
  with latest as (
    select distinct on (r.meter_id) r.meter_id,r.reading_value
    from public.cmms_meter_reading r
    order by r.meter_id,r.recorded_at desc,r.created_at desc
  )
  select s.schedule_id,s.equipment_id,s.title,s.schedule_type,s.next_due_at,s.next_meter_due,l.reading_value,
    (s.schedule_type in ('TIME','EITHER') and s.next_due_at is not null and s.next_due_at - make_interval(mins=>s.lead_time_minutes) <= p_as_of) as time_due,
    (s.schedule_type in ('METER','EITHER') and s.next_meter_due is not null and l.reading_value is not null and l.reading_value >= s.next_meter_due) as meter_due,
    ((s.schedule_type in ('TIME','EITHER') and s.next_due_at is not null and s.next_due_at - make_interval(mins=>s.lead_time_minutes) <= p_as_of)
      or (s.schedule_type in ('METER','EITHER') and s.next_meter_due is not null and l.reading_value is not null and l.reading_value >= s.next_meter_due)) as is_due
  from public.cmms_pm_schedule s
  left join latest l on l.meter_id=s.meter_id
  where s.active=true and s.archived_at is null
    and (p_include_not_due or
      (s.schedule_type in ('TIME','EITHER') and s.next_due_at is not null and s.next_due_at - make_interval(mins=>s.lead_time_minutes) <= p_as_of)
      or (s.schedule_type in ('METER','EITHER') and s.next_meter_due is not null and l.reading_value is not null and l.reading_value >= s.next_meter_due))
  order by coalesce(s.next_due_at,'infinity'::timestamptz),s.title
$$;
revoke all on function public.rpc_cmms_pm_due_list(timestamptz,boolean) from public, anon;
grant execute on function public.rpc_cmms_pm_due_list(timestamptz,boolean) to authenticated;

create or replace function public.rpc_cmms_generate_due_pm_work_orders(
  p_as_of timestamptz default now(),
  p_schedule_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_uid uuid := auth.uid();
  v_actor text;
  v_s public.cmms_pm_schedule%rowtype;
  v_latest numeric;
  v_time_due boolean;
  v_meter_due boolean;
  v_wo_id text;
  v_generated jsonb := '[]'::jsonb;
  v_item record;
  v_next_time timestamptz;
  v_next_meter numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'PM_GENERATE_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',v_uid::text);

  for v_s in
    select * from public.cmms_pm_schedule
    where active=true and archived_at is null and (p_schedule_id is null or schedule_id=p_schedule_id)
    order by next_due_at nulls last,created_at
    for update
  loop
    v_latest:=null;
    if v_s.meter_id is not null then
      select reading_value into v_latest from public.cmms_meter_reading
      where meter_id=v_s.meter_id order by recorded_at desc,created_at desc limit 1;
    end if;

    v_time_due := v_s.schedule_type in ('TIME','EITHER') and v_s.next_due_at is not null
      and v_s.next_due_at - make_interval(mins=>v_s.lead_time_minutes) <= p_as_of;
    v_meter_due := v_s.schedule_type in ('METER','EITHER') and v_s.next_meter_due is not null
      and v_latest is not null and v_latest >= v_s.next_meter_due;
    if not (v_time_due or v_meter_due) then continue; end if;

    v_wo_id:='WO-PM-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
    insert into public.maintenance_work_order(work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data)
    values(
      v_wo_id,v_s.equipment_id,'OPEN',coalesce(v_s.priority,'NORMAL'),coalesce(nullif(v_s.description,''),v_s.title),
      'PREVENTIVE_MAINTENANCE',v_s.schedule_id::text,v_actor,
      jsonb_build_object('pmScheduleId',v_s.schedule_id,'pmTitle',v_s.title,'generatedAt',p_as_of,'timeDue',v_time_due,'meterDue',v_meter_due,'meterValue',v_latest)
    );

    if v_s.default_person_id is not null then
      insert into public.cmms_work_order_person_assignment(work_order_id,person_id,assignment_role,created_by)
      values(v_wo_id,v_s.default_person_id,'PRIMARY_ASSIGNEE',v_uid) on conflict do nothing;
    end if;
    if v_s.default_team_id is not null then
      insert into public.cmms_work_order_team_assignment(work_order_id,team_id,assignment_role,created_by)
      values(v_wo_id,v_s.default_team_id,'PRIMARY_TEAM',v_uid) on conflict do nothing;
    end if;

    if v_s.checklist_template_id is not null then
      for v_item in select * from public.cmms_checklist_template_item where template_id=v_s.checklist_template_id order by sequence_no loop
        insert into public.cmms_work_order_checklist_item(work_order_id,sequence_no,title,description,response_type,required)
        values(v_wo_id,v_item.sequence_no,v_item.label,v_item.description,
          case when v_item.item_type in ('CHECK','TEXT','NUMBER','PASS_FAIL','METER') then v_item.item_type else 'CHECK' end,
          v_item.required);
      end loop;
    end if;

    v_next_time:=v_s.next_due_at;
    if v_time_due then
      v_next_time:=public.cmms_pm_next_time_due(v_s.next_due_at,v_s.time_interval,v_s.time_unit);
      while v_next_time - make_interval(mins=>v_s.lead_time_minutes) <= p_as_of loop
        v_next_time:=public.cmms_pm_next_time_due(v_next_time,v_s.time_interval,v_s.time_unit);
      end loop;
    end if;

    v_next_meter:=v_s.next_meter_due;
    if v_meter_due then
      v_next_meter:=v_s.next_meter_due + v_s.meter_interval;
      while v_latest is not null and v_next_meter <= v_latest loop v_next_meter:=v_next_meter+v_s.meter_interval; end loop;
    end if;

    update public.cmms_pm_schedule
    set next_due_at=v_next_time,next_meter_due=v_next_meter,last_generated_at=p_as_of,last_generated_work_order_id=v_wo_id,updated_at=now()
    where schedule_id=v_s.schedule_id;

    insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
    values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
      v_s.equipment_id,'PM_Schedule',v_s.schedule_id::text,'GENERATE_WORK_ORDER',v_actor,
      jsonb_build_object('workOrderId',v_wo_id,'timeDue',v_time_due,'meterDue',v_meter_due,'nextDueAt',v_next_time,'nextMeterDue',v_next_meter));

    v_generated:=v_generated||jsonb_build_array(jsonb_build_object('scheduleId',v_s.schedule_id,'workOrderId',v_wo_id));
  end loop;

  return jsonb_build_object('generatedCount',jsonb_array_length(v_generated),'items',v_generated);
end $$;
revoke all on function public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid) from public, anon;
grant execute on function public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid) to authenticated;
