-- Harden Work Order execution state at the database boundary.
-- 1) Required checklist items must be complete before COMPLETE.
-- 2) Checklist responses, part usage and labor can only be recorded while IN_PROGRESS.
-- 3) Checklist definitions may be created before/during execution but not after completion.
-- 4) Lock down the transition RPC from public/anon.

create or replace function public.cmms_guard_work_order_checklist_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.maintenance_work_order
  where work_order_id = new.work_order_id;

  if v_status is null then
    raise exception 'WORK_ORDER_NOT_FOUND';
  end if;

  if tg_op = 'INSERT' then
    if v_status not in ('OPEN','WAITING_APPROVAL','APPROVED','IN_PROGRESS') then
      raise exception 'CHECKLIST_DEFINITION_LOCKED';
    end if;
    return new;
  end if;

  if (new.completed is distinct from old.completed)
     or (new.response_text is distinct from old.response_text)
     or (new.response_number is distinct from old.response_number)
     or (new.completed_by is distinct from old.completed_by)
     or (new.completed_at is distinct from old.completed_at) then
    if v_status <> 'IN_PROGRESS' then
      raise exception 'WORK_ORDER_NOT_IN_PROGRESS';
    end if;
  elsif v_status not in ('OPEN','WAITING_APPROVAL','APPROVED','IN_PROGRESS') then
    raise exception 'CHECKLIST_DEFINITION_LOCKED';
  end if;

  return new;
end $$;

create or replace function public.cmms_guard_work_order_execution_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status
  from public.maintenance_work_order
  where work_order_id = new.work_order_id;

  if v_status is null then
    raise exception 'WORK_ORDER_NOT_FOUND';
  end if;
  if v_status <> 'IN_PROGRESS' then
    raise exception 'WORK_ORDER_NOT_IN_PROGRESS';
  end if;
  return new;
end $$;

drop trigger if exists trg_cmms_work_order_checklist_guard on public.cmms_work_order_checklist_item;
create trigger trg_cmms_work_order_checklist_guard
before insert or update on public.cmms_work_order_checklist_item
for each row execute function public.cmms_guard_work_order_checklist_mutation();

drop trigger if exists trg_cmms_work_order_part_usage_guard on public.cmms_work_order_part_usage;
create trigger trg_cmms_work_order_part_usage_guard
before insert on public.cmms_work_order_part_usage
for each row execute function public.cmms_guard_work_order_execution_insert();

drop trigger if exists trg_cmms_work_order_labor_guard on public.cmms_work_order_labor;
create trigger trg_cmms_work_order_labor_guard
before insert on public.cmms_work_order_labor
for each row execute function public.cmms_guard_work_order_execution_insert();

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
  select * into v_wo
  from public.maintenance_work_order
  where work_order_id = trim(p_work_order_id)
  for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  case upper(trim(p_action))
    when 'REQUEST_APPROVAL' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'OPEN' then raise exception 'INVALID_TRANSITION'; end if;
      v_next := 'WAITING_APPROVAL';
    when 'APPROVE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'WAITING_APPROVAL' then raise exception 'INVALID_TRANSITION'; end if;
      v_next := 'APPROVED';
    when 'START' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'APPROVED' then raise exception 'INVALID_TRANSITION'; end if;
      v_next := 'IN_PROGRESS';
    when 'COMPLETE' then
      if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'IN_PROGRESS' then raise exception 'INVALID_TRANSITION'; end if;
      if exists (
        select 1
        from public.cmms_work_order_checklist_item c
        where c.work_order_id = v_wo.work_order_id
          and c.required = true
          and c.completed = false
      ) then
        raise exception 'REQUIRED_CHECKLIST_INCOMPLETE';
      end if;
      v_next := 'COMPLETED';
    when 'VERIFY' then
      if v_role not in ('SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'COMPLETED' then raise exception 'INVALID_TRANSITION'; end if;
      v_next := 'VERIFIED';
    when 'RELEASE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if;
      if v_wo.status <> 'VERIFIED' then raise exception 'INVALID_TRANSITION'; end if;
      if not exists (
        select 1 from public.equipment_handover
        where work_order_id = v_wo.work_order_id and accepted = true
      ) then
        raise exception 'HANDOVER_ACCEPTED_REQUIRED';
      end if;
      v_next := 'RELEASED';
    else
      raise exception 'UNKNOWN_MAINTENANCE_ACTION';
  end case;

  v_actor := coalesce(auth.jwt()->>'email', auth.uid()::text);
  v_source := coalesce(v_wo.source_data,'{}'::jsonb)
    || jsonb_build_object('lastOperationId',p_operation_id);

  if upper(trim(p_action))='APPROVE' then
    v_source := v_source || jsonb_build_object('approvedBy',v_actor,'approvedAt',now());
  end if;
  if upper(trim(p_action))='START' then
    v_source := v_source || jsonb_build_object('actualStartAt',coalesce(nullif(v_source->>'actualStartAt',''),now()::text),'startedBy',v_actor);
  end if;
  if upper(trim(p_action))='COMPLETE' then
    v_source := v_source || jsonb_build_object('actualCompletedAt',coalesce(nullif(v_source->>'actualCompletedAt',''),now()::text),'completedBy',v_actor);
  end if;
  if upper(trim(p_action))='VERIFY' then
    v_source := v_source || jsonb_build_object('verifiedBy',v_actor,'verifiedAt',now());
  end if;
  if upper(trim(p_action))='RELEASE' then
    v_source := v_source || jsonb_build_object('releasedBy',v_actor,'releasedAt',now());
  end if;

  update public.maintenance_work_order
  set status = v_next, source_data = v_source, updated_at = now()
  where work_order_id = v_wo.work_order_id;

  if upper(trim(p_action))='RELEASE' then
    update public.downtime_event
    set ended_at = coalesce(ended_at,now())
    where work_order_id = v_wo.work_order_id and ended_at is null;

    update public.equipment_master
    set status='RUNNING',updated_at=now()
    where equipment_id=v_wo.equipment_id;
  end if;

  v_suffix := to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS') || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||v_suffix,
    v_wo.equipment_id,
    'Maintenance_Work_Order',
    v_wo.work_order_id,
    upper(trim(p_action)),
    v_actor,
    jsonb_build_object('before',v_wo.status,'after',v_next,'operationId',p_operation_id)
  );

  return jsonb_build_object('status',v_next);
end $$;

revoke all on function public.rpc_transition_maintenance(text,text,text) from public, anon;
grant execute on function public.rpc_transition_maintenance(text,text,text) to authenticated;

revoke all on function public.cmms_guard_work_order_checklist_mutation() from public, anon, authenticated;
revoke all on function public.cmms_guard_work_order_execution_insert() from public, anon, authenticated;
