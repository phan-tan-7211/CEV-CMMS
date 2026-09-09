-- Preventive Maintenance schedule CRUD for Mobile/Web administration.
-- Keeps cron generation in 088 and adds validated manager/supervisor mutation RPCs.

create or replace function public.rpc_cmms_upsert_pm_schedule(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_role public.app_role;
  v_schedule_id uuid;
  v_existing public.cmms_pm_schedule%rowtype;
  v_equipment_id text := btrim(coalesce(p_input->>'equipmentId',''));
  v_title text := btrim(coalesce(p_input->>'title',''));
  v_description text := nullif(btrim(coalesce(p_input->>'description','')),'');
  v_schedule_type text := upper(btrim(coalesce(p_input->>'scheduleType','TIME')));
  v_priority text := upper(nullif(btrim(coalesce(p_input->>'priority','NORMAL')),''));
  v_active boolean := coalesce((p_input->>'active')::boolean,true);
  v_start_at timestamptz := coalesce(nullif(p_input->>'startAt','')::timestamptz,now());
  v_next_due_at timestamptz;
  v_time_interval integer;
  v_time_unit text;
  v_meter_id uuid;
  v_meter_interval numeric;
  v_next_meter_due numeric;
  v_lead_time_minutes integer := coalesce(nullif(p_input->>'leadTimeMinutes','')::integer,0);
  v_checklist_template_id uuid;
  v_default_person_id uuid;
  v_default_team_id uuid;
  v_source_data jsonb := coalesce(p_input->'sourceData','{}'::jsonb);
  v_actor text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'PM_SCHEDULE_MANAGE_ROLE_DENIED'; end if;

  if nullif(p_input->>'scheduleId','') is not null then
    v_schedule_id := (p_input->>'scheduleId')::uuid;
    select * into v_existing from public.cmms_pm_schedule where schedule_id=v_schedule_id for update;
    if not found then raise exception 'PM_SCHEDULE_NOT_FOUND'; end if;
    if v_equipment_id='' then v_equipment_id:=v_existing.equipment_id; end if;
  else
    v_schedule_id := gen_random_uuid();
  end if;

  if v_equipment_id='' then raise exception 'EQUIPMENT_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and active=true) then
    raise exception 'ACTIVE_EQUIPMENT_NOT_FOUND';
  end if;
  if v_title='' then raise exception 'PM_TITLE_REQUIRED'; end if;
  if v_schedule_type not in ('TIME','METER','EITHER') then raise exception 'PM_SCHEDULE_TYPE_INVALID'; end if;
  if v_lead_time_minutes < 0 then raise exception 'PM_LEAD_TIME_INVALID'; end if;

  if v_schedule_type in ('TIME','EITHER') then
    v_time_interval := nullif(p_input->>'timeInterval','')::integer;
    v_time_unit := upper(nullif(btrim(coalesce(p_input->>'timeUnit','')),''));
    v_next_due_at := nullif(p_input->>'nextDueAt','')::timestamptz;
    if v_time_interval is null or v_time_interval <= 0 then raise exception 'PM_TIME_INTERVAL_REQUIRED'; end if;
    if v_time_unit not in ('HOURS','DAYS','WEEKS','MONTHS','YEARS') then raise exception 'PM_TIME_UNIT_INVALID'; end if;
    if v_next_due_at is null then raise exception 'PM_NEXT_DUE_REQUIRED'; end if;
  end if;

  if v_schedule_type in ('METER','EITHER') then
    v_meter_id := nullif(p_input->>'meterId','')::uuid;
    v_meter_interval := nullif(p_input->>'meterInterval','')::numeric;
    v_next_meter_due := nullif(p_input->>'nextMeterDue','')::numeric;
    if v_meter_id is null then raise exception 'PM_METER_REQUIRED'; end if;
    if not exists(
      select 1 from public.cmms_meter
      where meter_id=v_meter_id and equipment_id=v_equipment_id and active=true and archived_at is null
    ) then raise exception 'ACTIVE_EQUIPMENT_METER_NOT_FOUND'; end if;
    if v_meter_interval is null or v_meter_interval <= 0 then raise exception 'PM_METER_INTERVAL_REQUIRED'; end if;
    if v_next_meter_due is null then raise exception 'PM_NEXT_METER_DUE_REQUIRED'; end if;
  end if;

  v_checklist_template_id := nullif(p_input->>'checklistTemplateId','')::uuid;
  if v_checklist_template_id is not null and not exists(
    select 1 from public.cmms_checklist_template
    where template_id=v_checklist_template_id and active=true and archived_at is null
  ) then raise exception 'ACTIVE_CHECKLIST_TEMPLATE_NOT_FOUND'; end if;

  v_default_person_id := nullif(p_input->>'defaultPersonId','')::uuid;
  if v_default_person_id is not null and not exists(
    select 1 from public.cmms_person where person_id=v_default_person_id and active=true and archived_at is null
  ) then raise exception 'ACTIVE_DEFAULT_PERSON_NOT_FOUND'; end if;

  v_default_team_id := nullif(p_input->>'defaultTeamId','')::uuid;
  if v_default_team_id is not null and not exists(
    select 1 from public.cmms_team where team_id=v_default_team_id and active=true and archived_at is null
  ) then raise exception 'ACTIVE_DEFAULT_TEAM_NOT_FOUND'; end if;

  insert into public.cmms_pm_schedule(
    schedule_id,equipment_id,checklist_template_id,title,description,schedule_type,priority,active,
    start_at,next_due_at,time_interval,time_unit,meter_id,meter_interval,next_meter_due,lead_time_minutes,
    default_person_id,default_team_id,archived_at,source_data,created_by,created_at,updated_at
  ) values(
    v_schedule_id,v_equipment_id,v_checklist_template_id,v_title,v_description,v_schedule_type,v_priority,v_active,
    v_start_at,v_next_due_at,v_time_interval,v_time_unit,v_meter_id,v_meter_interval,v_next_meter_due,v_lead_time_minutes,
    v_default_person_id,v_default_team_id,null,v_source_data,v_uid,now(),now()
  )
  on conflict(schedule_id) do update set
    equipment_id=excluded.equipment_id,
    checklist_template_id=excluded.checklist_template_id,
    title=excluded.title,
    description=excluded.description,
    schedule_type=excluded.schedule_type,
    priority=excluded.priority,
    active=excluded.active,
    start_at=excluded.start_at,
    next_due_at=excluded.next_due_at,
    time_interval=excluded.time_interval,
    time_unit=excluded.time_unit,
    meter_id=excluded.meter_id,
    meter_interval=excluded.meter_interval,
    next_meter_due=excluded.next_meter_due,
    lead_time_minutes=excluded.lead_time_minutes,
    default_person_id=excluded.default_person_id,
    default_team_id=excluded.default_team_id,
    archived_at=null,
    source_data=excluded.source_data,
    updated_at=now();

  v_actor := coalesce(auth.jwt()->>'email',v_uid::text);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_equipment_id,'PM_Schedule',v_schedule_id::text,
    case when v_existing.schedule_id is null then 'CREATE' else 'UPDATE' end,
    v_actor,
    jsonb_build_object('scheduleType',v_schedule_type,'active',v_active,'title',v_title)
  );

  return jsonb_build_object('scheduleId',v_schedule_id,'equipmentId',v_equipment_id,'active',v_active,'scheduleType',v_schedule_type);
end $$;

revoke all on function public.rpc_cmms_upsert_pm_schedule(jsonb) from public, anon;
grant execute on function public.rpc_cmms_upsert_pm_schedule(jsonb) to authenticated;

create or replace function public.rpc_cmms_set_pm_schedule_active(
  p_schedule_id uuid,
  p_active boolean
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role public.app_role;
  v_row public.cmms_pm_schedule%rowtype;
  v_actor text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'PM_SCHEDULE_MANAGE_ROLE_DENIED'; end if;
  select * into v_row from public.cmms_pm_schedule where schedule_id=p_schedule_id for update;
  if not found then raise exception 'PM_SCHEDULE_NOT_FOUND'; end if;
  if v_row.archived_at is not null and coalesce(p_active,false) then raise exception 'PM_SCHEDULE_ARCHIVED'; end if;

  update public.cmms_pm_schedule set active=coalesce(p_active,false),updated_at=now() where schedule_id=p_schedule_id;
  v_actor:=coalesce(auth.jwt()->>'email',v_uid::text);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_row.equipment_id,'PM_Schedule',p_schedule_id::text,case when p_active then 'ACTIVATE' else 'DEACTIVATE' end,v_actor,'{}'::jsonb);
  return jsonb_build_object('scheduleId',p_schedule_id,'active',coalesce(p_active,false));
end $$;

revoke all on function public.rpc_cmms_set_pm_schedule_active(uuid,boolean) from public, anon;
grant execute on function public.rpc_cmms_set_pm_schedule_active(uuid,boolean) to authenticated;

create or replace function public.rpc_cmms_archive_pm_schedule(
  p_schedule_id uuid,
  p_archived boolean default true
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role public.app_role;
  v_row public.cmms_pm_schedule%rowtype;
  v_actor text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MANAGER','ADMIN') then raise exception 'PM_SCHEDULE_ARCHIVE_ROLE_DENIED'; end if;
  select * into v_row from public.cmms_pm_schedule where schedule_id=p_schedule_id for update;
  if not found then raise exception 'PM_SCHEDULE_NOT_FOUND'; end if;

  update public.cmms_pm_schedule
  set archived_at=case when coalesce(p_archived,true) then now() else null end,
      active=case when coalesce(p_archived,true) then false else active end,
      updated_at=now()
  where schedule_id=p_schedule_id;

  v_actor:=coalesce(auth.jwt()->>'email',v_uid::text);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_row.equipment_id,'PM_Schedule',p_schedule_id::text,case when p_archived then 'ARCHIVE' else 'RESTORE' end,v_actor,'{}'::jsonb);
  return jsonb_build_object('scheduleId',p_schedule_id,'archived',coalesce(p_archived,true));
end $$;

revoke all on function public.rpc_cmms_archive_pm_schedule(uuid,boolean) from public, anon;
grant execute on function public.rpc_cmms_archive_pm_schedule(uuid,boolean) to authenticated;
