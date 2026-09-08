-- Automate due Preventive Maintenance -> Work Order generation with pg_cron.
-- The cron worker is internal-only; app users continue to use the authenticated RPC wrapper.

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.cmms_generate_due_pm_work_orders_internal(
  p_as_of timestamptz default now(),
  p_actor text default 'SYSTEM:PM_CRON',
  p_schedule_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor text := coalesce(nullif(btrim(coalesce(p_actor,'')),''),'SYSTEM:PM_CRON');
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
  for v_s in
    select *
    from public.cmms_pm_schedule
    where active=true
      and archived_at is null
      and (p_schedule_id is null or schedule_id=p_schedule_id)
    order by next_due_at nulls last, created_at
    for update
  loop
    v_latest:=null;
    if v_s.meter_id is not null then
      select reading_value into v_latest
      from public.cmms_meter_reading
      where meter_id=v_s.meter_id
      order by recorded_at desc,created_at desc
      limit 1;
    end if;

    v_time_due := v_s.schedule_type in ('TIME','EITHER')
      and v_s.next_due_at is not null
      and v_s.next_due_at - make_interval(mins=>v_s.lead_time_minutes) <= p_as_of;
    v_meter_due := v_s.schedule_type in ('METER','EITHER')
      and v_s.next_meter_due is not null
      and v_latest is not null
      and v_latest >= v_s.next_meter_due;

    if not (v_time_due or v_meter_due) then continue; end if;

    v_wo_id:='WO-PM-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
    insert into public.maintenance_work_order(
      work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data
    ) values(
      v_wo_id,v_s.equipment_id,'OPEN',coalesce(v_s.priority,'NORMAL'),coalesce(nullif(v_s.description,''),v_s.title),
      'PREVENTIVE_MAINTENANCE',v_s.schedule_id::text,v_actor,
      jsonb_build_object(
        'pmScheduleId',v_s.schedule_id,
        'pmTitle',v_s.title,
        'generatedAt',p_as_of,
        'generatedBy',v_actor,
        'timeDue',v_time_due,
        'meterDue',v_meter_due,
        'meterValue',v_latest
      )
    );

    if v_s.default_person_id is not null then
      insert into public.cmms_work_order_person_assignment(work_order_id,person_id,assignment_role,created_by)
      values(v_wo_id,v_s.default_person_id,'PRIMARY_ASSIGNEE',v_uid)
      on conflict do nothing;
    end if;
    if v_s.default_team_id is not null then
      insert into public.cmms_work_order_team_assignment(work_order_id,team_id,assignment_role,created_by)
      values(v_wo_id,v_s.default_team_id,'PRIMARY_TEAM',v_uid)
      on conflict do nothing;
    end if;

    if v_s.checklist_template_id is not null then
      for v_item in
        select * from public.cmms_checklist_template_item
        where template_id=v_s.checklist_template_id
        order by sequence_no
      loop
        insert into public.cmms_work_order_checklist_item(
          work_order_id,sequence_no,title,description,response_type,required
        ) values(
          v_wo_id,v_item.sequence_no,v_item.label,v_item.description,
          case when v_item.item_type in ('CHECK','TEXT','NUMBER','PASS_FAIL','METER') then v_item.item_type else 'CHECK' end,
          v_item.required
        );
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
      while v_latest is not null and v_next_meter <= v_latest loop
        v_next_meter:=v_next_meter+v_s.meter_interval;
      end loop;
    end if;

    update public.cmms_pm_schedule
    set next_due_at=v_next_time,
        next_meter_due=v_next_meter,
        last_generated_at=p_as_of,
        last_generated_work_order_id=v_wo_id,
        updated_at=now()
    where schedule_id=v_s.schedule_id;

    insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
    values(
      'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
      v_s.equipment_id,'PM_Schedule',v_s.schedule_id::text,'GENERATE_WORK_ORDER',v_actor,
      jsonb_build_object(
        'workOrderId',v_wo_id,
        'timeDue',v_time_due,
        'meterDue',v_meter_due,
        'nextDueAt',v_next_time,
        'nextMeterDue',v_next_meter
      )
    );

    v_generated:=v_generated||jsonb_build_array(jsonb_build_object('scheduleId',v_s.schedule_id,'workOrderId',v_wo_id));
  end loop;

  return jsonb_build_object('generatedCount',jsonb_array_length(v_generated),'items',v_generated);
end $$;

revoke all on function public.cmms_generate_due_pm_work_orders_internal(timestamptz,text,uuid) from public, anon, authenticated;

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
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'PM_GENERATE_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',v_uid::text);
  return public.cmms_generate_due_pm_work_orders_internal(coalesce(p_as_of,now()),v_actor,p_schedule_id);
end $$;

revoke all on function public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid) from public, anon;
grant execute on function public.rpc_cmms_generate_due_pm_work_orders(timestamptz,uuid) to authenticated;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname='cmms-pm-due-generator' loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

select cron.schedule(
  'cmms-pm-due-generator',
  '*/15 * * * *',
  'select public.cmms_generate_due_pm_work_orders_internal(now(), ''SYSTEM:PM_CRON'', null);'
);
