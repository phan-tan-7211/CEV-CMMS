-- Work-order execution details for corrective / breakdown maintenance.
-- Keeps existing schema stable by persisting execution fields in source_data and links downtime to the WO.

create or replace function public.rpc_save_maintenance_execution(
  p_work_order_id text,
  p_input jsonb,
  p_operation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_wo public.maintenance_work_order%rowtype;
  v_source jsonb;
  v_suffix text;
  v_downtime_id text;
  v_started timestamptz;
  v_ended timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role is null or v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then
    raise exception 'MAINTENANCE_EXECUTION_ROLE_DENIED';
  end if;

  select * into v_wo
  from public.maintenance_work_order
  where work_order_id = trim(p_work_order_id)
  for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if v_wo.status = 'RELEASED' then raise exception 'WORK_ORDER_ALREADY_RELEASED'; end if;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_source := coalesce(v_wo.source_data, '{}'::jsonb)
    || jsonb_build_object(
      'rootCause', coalesce(trim(p_input->>'rootCause'), ''),
      'correctiveAction', coalesce(trim(p_input->>'correctiveAction'), ''),
      'preventiveAction', coalesce(trim(p_input->>'preventiveAction'), ''),
      'executionNote', coalesce(trim(p_input->>'executionNote'), ''),
      'actualStartAt', coalesce(trim(p_input->>'actualStartAt'), ''),
      'actualCompletedAt', coalesce(trim(p_input->>'actualCompletedAt'), ''),
      'executionUpdatedBy', v_actor,
      'executionUpdatedAt', now(),
      'lastOperationId', p_operation_id
    );

  update public.maintenance_work_order
  set source_data = v_source, updated_at = now()
  where work_order_id = v_wo.work_order_id;

  if coalesce(trim(p_input->>'downtimeStartedAt'), '') <> '' then
    v_started := (p_input->>'downtimeStartedAt')::timestamptz;
    if coalesce(trim(p_input->>'downtimeEndedAt'), '') <> '' then
      v_ended := (p_input->>'downtimeEndedAt')::timestamptz;
      if v_ended < v_started then raise exception 'DOWNTIME_END_BEFORE_START'; end if;
    end if;

    select downtime_id into v_downtime_id
    from public.downtime_event
    where work_order_id = v_wo.work_order_id
    order by started_at desc
    limit 1;

    if coalesce(v_downtime_id, '') = '' then
      v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
      v_downtime_id := 'DT-' || v_suffix;
      insert into public.downtime_event(downtime_id,equipment_id,work_order_id,started_at,ended_at,source_data)
      values(
        v_downtime_id,
        v_wo.equipment_id,
        v_wo.work_order_id,
        v_started,
        v_ended,
        jsonb_build_object(
          'causeCategory', coalesce(trim(p_input->>'downtimeCauseCategory'), ''),
          'detail', coalesce(trim(p_input->>'downtimeDetail'), ''),
          'actionTaken', coalesce(trim(p_input->>'correctiveAction'), ''),
          'handledBy', coalesce(v_source->>'assignedPersonName', v_source->>'assignedPersonCode', ''),
          'recordedBy', v_actor,
          'operationId', p_operation_id
        )
      );
    else
      update public.downtime_event
      set started_at = v_started,
          ended_at = v_ended,
          source_data = coalesce(source_data, '{}'::jsonb) || jsonb_build_object(
            'causeCategory', coalesce(trim(p_input->>'downtimeCauseCategory'), ''),
            'detail', coalesce(trim(p_input->>'downtimeDetail'), ''),
            'actionTaken', coalesce(trim(p_input->>'correctiveAction'), ''),
            'handledBy', coalesce(v_source->>'assignedPersonName', v_source->>'assignedPersonCode', ''),
            'recordedBy', v_actor,
            'operationId', p_operation_id
          )
      where downtime_id = v_downtime_id;
    end if;
  end if;

  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-' || v_suffix,
    v_wo.equipment_id,
    'Maintenance_Work_Order',
    v_wo.work_order_id,
    'UPDATE_EXECUTION',
    v_actor,
    jsonb_build_object(
      'operationId', p_operation_id,
      'downtimeId', coalesce(v_downtime_id, ''),
      'rootCauseRecorded', coalesce(trim(p_input->>'rootCause'), '') <> '',
      'correctiveActionRecorded', coalesce(trim(p_input->>'correctiveAction'), '') <> ''
    )
  );

  return jsonb_build_object(
    'workOrderId', v_wo.work_order_id,
    'downtimeId', coalesce(v_downtime_id, ''),
    'updatedBy', v_actor,
    'updatedAt', now()
  );
end $$;

grant execute on function public.rpc_save_maintenance_execution(text,jsonb,text) to authenticated;

-- Extend the authoritative transition RPC with actual execution timestamps and verification metadata.
create or replace function public.rpc_transition_maintenance(
  p_work_order_id text,
  p_action text,
  p_operation_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_wo public.maintenance_work_order%rowtype;
  v_next text;
  v_source jsonb;
  v_suffix text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  select * into v_wo from public.maintenance_work_order where work_order_id=p_work_order_id for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  case p_action
    when 'REQUEST_APPROVAL' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'OPEN' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'WAITING_APPROVAL';
    when 'APPROVE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'WAITING_APPROVAL' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'APPROVED';
    when 'START' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'APPROVED' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'IN_PROGRESS';
    when 'COMPLETE' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'IN_PROGRESS' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'COMPLETED';
    when 'VERIFY' then
      if v_role not in ('SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'COMPLETED' then raise exception 'INVALID_TRANSITION'; end if; v_next := 'VERIFIED';
    when 'RELEASE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'VERIFIED' then raise exception 'INVALID_TRANSITION'; end if;
      if not exists (select 1 from public.equipment_handover where work_order_id=p_work_order_id and accepted=true) then raise exception 'HANDOVER_ACCEPTED_REQUIRED'; end if;
      v_next := 'RELEASED';
    else raise exception 'UNKNOWN_MAINTENANCE_ACTION';
  end case;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_source := coalesce(v_wo.source_data,'{}'::jsonb) || jsonb_build_object('lastOperationId',p_operation_id);
  if p_action='APPROVE' then v_source := v_source || jsonb_build_object('approvedBy',v_actor,'approvedAt',now()); end if;
  if p_action='START' then v_source := v_source || jsonb_build_object('actualStartAt',coalesce(nullif(v_source->>'actualStartAt',''),now()::text),'startedBy',v_actor); end if;
  if p_action='COMPLETE' then v_source := v_source || jsonb_build_object('actualCompletedAt',coalesce(nullif(v_source->>'actualCompletedAt',''),now()::text),'completedBy',v_actor); end if;
  if p_action='VERIFY' then v_source := v_source || jsonb_build_object('verifiedBy',v_actor,'verifiedAt',now()); end if;
  if p_action='RELEASE' then v_source := v_source || jsonb_build_object('releasedBy',v_actor,'releasedAt',now()); end if;

  update public.maintenance_work_order set status=v_next, source_data=v_source, updated_at=now() where work_order_id=p_work_order_id;

  if p_action='RELEASE' then
    update public.downtime_event set ended_at=coalesce(ended_at,now()) where work_order_id=p_work_order_id and ended_at is null;
    update public.equipment_master set status='RUNNING',updated_at=now() where equipment_id=v_wo.equipment_id;
  end if;

  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||v_suffix,v_wo.equipment_id,'Maintenance_Work_Order',p_work_order_id,p_action,v_actor,jsonb_build_object('before',v_wo.status,'after',v_next,'operationId',p_operation_id));
  return jsonb_build_object('status',v_next);
end $$;

grant execute on function public.rpc_transition_maintenance(text,text,text) to authenticated;
