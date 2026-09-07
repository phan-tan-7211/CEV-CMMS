-- Work order assignment using canonical organization people.
-- Stores assignment in maintenance_work_order.source_data and writes an audit event.

create or replace function public.rpc_assign_maintenance_work_order(
  p_work_order_id text,
  p_person_code text,
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
  v_person_code text := nullif(trim(coalesce(p_person_code, '')), '');
  v_person_name text := '';
  v_previous_person_code text := '';
  v_source jsonb;
  v_suffix text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  v_role := public.current_app_role();
  if v_role is null or v_role not in ('SUPERVISOR','MANAGER','ADMIN') then
    raise exception 'WORK_ORDER_ASSIGN_ROLE_DENIED';
  end if;

  select * into v_wo
  from public.maintenance_work_order
  where work_order_id = trim(p_work_order_id)
  for update;

  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if v_wo.status = 'RELEASED' then raise exception 'WORK_ORDER_ALREADY_RELEASED'; end if;

  if v_person_code is not null then
    select display_name into v_person_name
    from public.org_people
    where person_code = v_person_code and active = true;

    if not found then raise exception 'ACTIVE_ORG_PERSON_NOT_FOUND'; end if;
  end if;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_source := coalesce(v_wo.source_data, '{}'::jsonb);
  v_previous_person_code := coalesce(v_source->>'assignedPersonCode', '');

  if v_person_code is null then
    v_source := v_source - 'assignedPersonCode' - 'assignedPersonName' - 'assignedBy' - 'assignedAt';
  else
    v_source := v_source || jsonb_build_object(
      'assignedPersonCode', v_person_code,
      'assignedPersonName', v_person_name,
      'assignedBy', v_actor,
      'assignedAt', now()
    );
  end if;

  update public.maintenance_work_order
  set source_data = v_source,
      updated_at = now()
  where work_order_id = v_wo.work_order_id;

  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-' || v_suffix,
    v_wo.equipment_id,
    'Maintenance_Work_Order',
    v_wo.work_order_id,
    case when v_person_code is null then 'UNASSIGN' else 'ASSIGN' end,
    v_actor,
    jsonb_build_object(
      'beforeAssignee', v_previous_person_code,
      'afterAssignee', coalesce(v_person_code, ''),
      'afterAssigneeName', v_person_name,
      'operationId', p_operation_id
    )
  );

  return jsonb_build_object(
    'workOrderId', v_wo.work_order_id,
    'assignedPersonCode', coalesce(v_person_code, ''),
    'assignedPersonName', v_person_name,
    'assignedBy', case when v_person_code is null then '' else v_actor end,
    'assignedAt', case when v_person_code is null then '' else now()::text end
  );
end $$;

grant execute on function public.rpc_assign_maintenance_work_order(text,text,text) to authenticated;
