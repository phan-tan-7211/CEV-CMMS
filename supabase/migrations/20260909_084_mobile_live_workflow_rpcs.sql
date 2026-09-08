-- Mobile workflow RPCs for live picker-backed create forms.
-- Additive to legacy rpc_create_maintenance_work_order / rpc_create_maintenance_request.

create or replace function public.rpc_cmms_create_work_order_v2(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_equipment_id text := btrim(coalesce(p_input->>'equipmentId',''));
  v_reason text := btrim(coalesce(p_input->>'reason',''));
  v_priority text := upper(btrim(coalesce(p_input->>'priority','MEDIUM')));
  v_source_type text := coalesce(nullif(btrim(p_input->>'sourceType'),''),'MOBILE');
  v_source_id text := nullif(btrim(coalesce(p_input->>'sourceId','')),'');
  v_operation_id text := coalesce(nullif(btrim(p_input->>'operationId'),''),'MOBILE-'||replace(gen_random_uuid()::text,'-',''));
  v_people uuid[] := array[]::uuid[];
  v_teams uuid[] := array[]::uuid[];
  v_result jsonb;
  v_wo_id text;
  v_person uuid;
  v_team uuid;
  v_first boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'MAINTENANCE_ROLE_DENIED'; end if;
  if v_equipment_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if v_reason='' then raise exception 'WORK_ORDER_REASON_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and equipment_type='PRODUCTION' and active=true) then
    raise exception 'PRODUCTION_EQUIPMENT_NOT_FOUND';
  end if;

  select coalesce(array_agg(distinct e.value::uuid),array[]::uuid[]) into v_people
  from jsonb_array_elements_text(coalesce(p_input->'personIds','[]'::jsonb)) as e(value);
  select coalesce(array_agg(distinct e.value::uuid),array[]::uuid[]) into v_teams
  from jsonb_array_elements_text(coalesce(p_input->'teamIds','[]'::jsonb)) as e(value);

  if (cardinality(v_people)>0 or cardinality(v_teams)>0) and v_role not in ('SUPERVISOR','MANAGER','ADMIN') then
    raise exception 'WORK_ORDER_ASSIGN_ROLE_DENIED';
  end if;
  if exists(select 1 from unnest(v_people) x where not exists(select 1 from public.cmms_person p where p.person_id=x and p.active=true and p.archived_at is null)) then
    raise exception 'ACTIVE_ASSIGNEE_NOT_FOUND';
  end if;
  if exists(select 1 from unnest(v_teams) x where not exists(select 1 from public.cmms_team t where t.team_id=x and t.active=true and t.archived_at is null)) then
    raise exception 'ACTIVE_TEAM_NOT_FOUND';
  end if;

  v_result := public.rpc_create_maintenance_work_order(
    v_operation_id,v_equipment_id,v_source_type,coalesce(v_source_id,v_equipment_id),v_reason,v_priority,
    coalesce(p_input->>'method',''),coalesce(p_input->>'plannedStartAt',''),coalesce(p_input->>'plannedEndAt','')
  );
  v_wo_id := btrim(coalesce(v_result->>'workOrderId',''));
  if v_wo_id='' then raise exception 'WORK_ORDER_CREATE_FAILED'; end if;

  v_first:=true;
  foreach v_person in array v_people loop
    insert into public.cmms_work_order_person_assignment(work_order_id,person_id,assignment_role,created_by)
    values(v_wo_id,v_person,case when v_first then 'PRIMARY_ASSIGNEE' else 'ASSIGNEE' end,auth.uid());
    v_first:=false;
  end loop;

  v_first:=true;
  foreach v_team in array v_teams loop
    insert into public.cmms_work_order_team_assignment(work_order_id,team_id,assignment_role,created_by)
    values(v_wo_id,v_team,case when v_first then 'PRIMARY_TEAM' else 'ASSIGNED_TEAM' end,auth.uid());
    v_first:=false;
  end loop;

  return v_result || jsonb_build_object('personIds',to_jsonb(v_people),'teamIds',to_jsonb(v_teams));
end $$;
revoke all on function public.rpc_cmms_create_work_order_v2(jsonb) from public, anon;
grant execute on function public.rpc_cmms_create_work_order_v2(jsonb) to authenticated;

create or replace function public.rpc_cmms_create_request_v2(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_equipment_id text := btrim(coalesce(p_input->>'equipmentId',''));
  v_title text := btrim(coalesce(p_input->>'title',''));
  v_description text := btrim(coalesce(p_input->>'description',''));
  v_priority text := upper(btrim(coalesce(p_input->>'priority','MEDIUM')));
  v_source_id text := coalesce(nullif(btrim(p_input->>'sourceId'),''),v_equipment_id);
  v_actor text;
  v_id text;
  v_suffix text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_equipment_id='' then raise exception 'EQUIPMENT_ID_REQUIRED'; end if;
  if v_title='' then raise exception 'REQUEST_TITLE_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=v_equipment_id and active=true) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  if v_priority not in ('LOW','MEDIUM','HIGH','CRITICAL','URGENT','NORMAL') then raise exception 'REQUEST_PRIORITY_INVALID'; end if;

  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text);
  v_suffix:=to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_id:='REQ-'||v_suffix;

  insert into public.maintenance_request(
    request_id,equipment_id,reason,status,source_type,source_id,created_by,
    title,description,priority,requested_by_user_id,source_data
  ) values(
    v_id,v_equipment_id,coalesce(nullif(v_description,''),v_title),'OPEN','MOBILE',v_source_id,v_actor,
    v_title,nullif(v_description,''),v_priority,auth.uid(),
    jsonb_build_object('createdFrom','MOBILE','createdAt',now())
  );

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values('AUD-'||v_suffix,v_equipment_id,'Maintenance_Request',v_id,'CREATE',v_actor,
    jsonb_build_object('title',v_title,'priority',v_priority,'sourceId',v_source_id));

  return jsonb_build_object('requestId',v_id,'status','OPEN','priority',v_priority);
end $$;
revoke all on function public.rpc_cmms_create_request_v2(jsonb) from public, anon;
grant execute on function public.rpc_cmms_create_request_v2(jsonb) to authenticated;
