-- Normalized Work Order detail/query/mutation RPCs.

create or replace function public.rpc_cmms_assign_work_order(
  p_work_order_id text,
  p_person_ids uuid[] default null,
  p_team_ids uuid[] default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_uid uuid := auth.uid();
  v_person uuid;
  v_team uuid;
  v_actor text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'WORK_ORDER_ASSIGN_ROLE_DENIED'; end if;
  if not exists(select 1 from public.maintenance_work_order where work_order_id=trim(p_work_order_id)) then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  delete from public.cmms_work_order_person_assignment where work_order_id=trim(p_work_order_id) and assignment_role in ('PRIMARY_ASSIGNEE','ASSIGNEE');
  delete from public.cmms_work_order_team_assignment where work_order_id=trim(p_work_order_id) and assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM');

  if p_person_ids is not null then
    foreach v_person in array p_person_ids loop
      if not exists(select 1 from public.cmms_person where person_id=v_person and active=true and archived_at is null) then raise exception 'ACTIVE_ASSIGNEE_NOT_FOUND'; end if;
      insert into public.cmms_work_order_person_assignment(work_order_id,person_id,assignment_role,created_by)
      values(trim(p_work_order_id),v_person,case when not exists(select 1 from public.cmms_work_order_person_assignment where work_order_id=trim(p_work_order_id) and assignment_role='PRIMARY_ASSIGNEE') then 'PRIMARY_ASSIGNEE' else 'ASSIGNEE' end,v_uid);
    end loop;
  end if;

  if p_team_ids is not null then
    foreach v_team in array p_team_ids loop
      if not exists(select 1 from public.cmms_team where team_id=v_team and active=true and archived_at is null) then raise exception 'ACTIVE_TEAM_NOT_FOUND'; end if;
      insert into public.cmms_work_order_team_assignment(work_order_id,team_id,assignment_role,created_by)
      values(trim(p_work_order_id),v_team,case when not exists(select 1 from public.cmms_work_order_team_assignment where work_order_id=trim(p_work_order_id) and assignment_role='PRIMARY_TEAM') then 'PRIMARY_TEAM' else 'ASSIGNED_TEAM' end,v_uid);
    end loop;
  end if;

  v_actor:=coalesce(auth.jwt()->>'email',v_uid::text);
  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  select 'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),equipment_id,'Maintenance_Work_Order',work_order_id,'ASSIGN_NORMALIZED',v_actor,
    jsonb_build_object('personIds',coalesce(to_jsonb(p_person_ids),'[]'::jsonb),'teamIds',coalesce(to_jsonb(p_team_ids),'[]'::jsonb))
  from public.maintenance_work_order where work_order_id=trim(p_work_order_id);

  return jsonb_build_object('workOrderId',trim(p_work_order_id),'personIds',coalesce(to_jsonb(p_person_ids),'[]'::jsonb),'teamIds',coalesce(to_jsonb(p_team_ids),'[]'::jsonb));
end $$;
revoke all on function public.rpc_cmms_assign_work_order(text,uuid[],uuid[]) from public, anon;
grant execute on function public.rpc_cmms_assign_work_order(text,uuid[],uuid[]) to authenticated;

create or replace function public.rpc_cmms_add_checklist_item(
  p_work_order_id text,p_title text,p_description text default null,p_response_type text default 'CHECK',p_required boolean default false,p_sequence_no integer default 0
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EDIT_ROLE_DENIED'; end if;
  if btrim(coalesce(p_title,''))='' then raise exception 'CHECKLIST_TITLE_REQUIRED'; end if;
  insert into public.cmms_work_order_checklist_item(work_order_id,sequence_no,title,description,response_type,required)
  values(trim(p_work_order_id),p_sequence_no,btrim(p_title),nullif(btrim(coalesce(p_description,'')),''),upper(trim(p_response_type)),coalesce(p_required,false)) returning checklist_item_id into v_id;
  return v_id;
end $$;
revoke all on function public.rpc_cmms_add_checklist_item(text,text,text,text,boolean,integer) from public, anon;
grant execute on function public.rpc_cmms_add_checklist_item(text,text,text,text,boolean,integer) to authenticated;

create or replace function public.rpc_cmms_complete_checklist_item(
  p_checklist_item_id uuid,p_completed boolean,p_response_text text default null,p_response_number numeric default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_item public.cmms_work_order_checklist_item%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EXECUTE_ROLE_DENIED'; end if;
  select * into v_item from public.cmms_work_order_checklist_item where checklist_item_id=p_checklist_item_id for update;
  if not found then raise exception 'CHECKLIST_ITEM_NOT_FOUND'; end if;
  update public.cmms_work_order_checklist_item set completed=coalesce(p_completed,false),response_text=p_response_text,response_number=p_response_number,
    completed_by=case when p_completed then auth.uid() else null end,completed_at=case when p_completed then now() else null end where checklist_item_id=p_checklist_item_id;
  return jsonb_build_object('checklistItemId',p_checklist_item_id,'completed',coalesce(p_completed,false));
end $$;
revoke all on function public.rpc_cmms_complete_checklist_item(uuid,boolean,text,numeric) from public, anon;
grant execute on function public.rpc_cmms_complete_checklist_item(uuid,boolean,text,numeric) to authenticated;

create or replace function public.rpc_cmms_add_part_usage(
  p_work_order_id text,p_part_name text,p_quantity numeric default 1,p_unit text default null,p_unit_cost numeric default null,p_spare_part_id text default null,p_notes text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EXECUTE_ROLE_DENIED'; end if;
  insert into public.cmms_work_order_part_usage(work_order_id,spare_part_id,part_name,quantity,unit,unit_cost,issued_by,notes)
  values(trim(p_work_order_id),nullif(btrim(coalesce(p_spare_part_id,'')),''),btrim(p_part_name),p_quantity,nullif(btrim(coalesce(p_unit,'')),''),p_unit_cost,auth.uid(),nullif(btrim(coalesce(p_notes,'')),'')) returning usage_id into v_id;
  return v_id;
end $$;
revoke all on function public.rpc_cmms_add_part_usage(text,text,numeric,text,numeric,text,text) from public, anon;
grant execute on function public.rpc_cmms_add_part_usage(text,text,numeric,text,numeric,text,text) to authenticated;

create or replace function public.rpc_cmms_add_labor(
  p_work_order_id text,p_person_id uuid,p_started_at timestamptz,p_ended_at timestamptz default null,p_hourly_rate numeric default null,p_note text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id uuid; v_minutes integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EXECUTE_ROLE_DENIED'; end if;
  if p_ended_at is not null and p_ended_at < p_started_at then raise exception 'LABOR_END_BEFORE_START'; end if;
  v_minutes:=case when p_ended_at is null then null else floor(extract(epoch from (p_ended_at-p_started_at))/60)::integer end;
  insert into public.cmms_work_order_labor(work_order_id,person_id,started_at,ended_at,minutes,hourly_rate,note,created_by)
  values(trim(p_work_order_id),p_person_id,p_started_at,p_ended_at,v_minutes,p_hourly_rate,nullif(btrim(coalesce(p_note,'')),''),auth.uid()) returning labor_id into v_id;
  return v_id;
end $$;
revoke all on function public.rpc_cmms_add_labor(text,uuid,timestamptz,timestamptz,numeric,text) from public, anon;
grant execute on function public.rpc_cmms_add_labor(text,uuid,timestamptz,timestamptz,numeric,text) to authenticated;

create or replace function public.rpc_cmms_add_work_order_attachment(
  p_work_order_id text,p_file_name text,p_storage_path text,p_storage_bucket text default null,p_mime_type text default null,p_file_size_bytes bigint default null,p_attachment_kind text default 'FILE'
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EXECUTE_ROLE_DENIED'; end if;
  insert into public.cmms_work_order_attachment(work_order_id,file_name,storage_bucket,storage_path,mime_type,file_size_bytes,attachment_kind,uploaded_by)
  values(trim(p_work_order_id),btrim(p_file_name),nullif(btrim(coalesce(p_storage_bucket,'')),''),btrim(p_storage_path),nullif(btrim(coalesce(p_mime_type,'')),''),p_file_size_bytes,upper(trim(p_attachment_kind)),auth.uid()) returning attachment_id into v_id;
  return v_id;
end $$;
revoke all on function public.rpc_cmms_add_work_order_attachment(text,text,text,text,text,bigint,text) from public, anon;
grant execute on function public.rpc_cmms_add_work_order_attachment(text,text,text,text,text,bigint,text) to authenticated;

create or replace function public.rpc_cmms_work_order_detail(p_work_order_id text)
returns jsonb
language sql
security invoker
set search_path=public
as $$
  select jsonb_build_object(
    'workOrder',to_jsonb(w),
    'equipment',to_jsonb(e),
    'request',case when r.request_id is null then null else to_jsonb(r) end,
    'people',coalesce((select jsonb_agg(jsonb_build_object('personId',p.person_id,'displayName',p.display_name,'role',a.assignment_role) order by a.created_at) from public.cmms_work_order_person_assignment a join public.cmms_person p on p.person_id=a.person_id where a.work_order_id=w.work_order_id),'[]'::jsonb),
    'teams',coalesce((select jsonb_agg(jsonb_build_object('teamId',t.team_id,'name',t.name,'role',a.assignment_role) order by a.created_at) from public.cmms_work_order_team_assignment a join public.cmms_team t on t.team_id=a.team_id where a.work_order_id=w.work_order_id),'[]'::jsonb),
    'checklist',coalesce((select jsonb_agg(to_jsonb(c) order by c.sequence_no,c.created_at) from public.cmms_work_order_checklist_item c where c.work_order_id=w.work_order_id),'[]'::jsonb),
    'parts',coalesce((select jsonb_agg(to_jsonb(x) order by x.used_at desc) from public.cmms_work_order_part_usage x where x.work_order_id=w.work_order_id),'[]'::jsonb),
    'labor',coalesce((select jsonb_agg(to_jsonb(x) order by x.started_at desc) from public.cmms_work_order_labor x where x.work_order_id=w.work_order_id),'[]'::jsonb),
    'attachments',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.cmms_work_order_attachment x where x.work_order_id=w.work_order_id),'[]'::jsonb),
    'downtime',coalesce((select jsonb_agg(to_jsonb(d) order by d.started_at desc) from public.downtime_event d where d.work_order_id=w.work_order_id),'[]'::jsonb)
  )
  from public.maintenance_work_order w
  join public.equipment_master e on e.equipment_id=w.equipment_id
  left join public.maintenance_request r on r.request_id=w.source_id and w.source_type='MAINTENANCE_REQUEST'
  where w.work_order_id=trim(p_work_order_id)
$$;
revoke all on function public.rpc_cmms_work_order_detail(text) from public, anon;
grant execute on function public.rpc_cmms_work_order_detail(text) to authenticated;
