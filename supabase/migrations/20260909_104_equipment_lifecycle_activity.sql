create or replace function public.rpc_set_equipment_status(p_equipment_id text,p_status_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_id text:=trim(coalesce(p_equipment_id,''));
  v_code text:=upper(trim(coalesce(p_status_code,'')));
  v_old text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_STATUS_ROLE_DENIED'; end if;
  if not exists(select 1 from public.equipment_status_master where status_code=v_code) then raise exception 'STATUS_NOT_FOUND'; end if;
  select status into v_old from public.equipment_master where equipment_id=v_id for update;
  if not found then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  if coalesce(v_old,'')=v_code then return jsonb_build_object('equipmentId',v_id,'status',v_code); end if;
  update public.equipment_master set status=v_code,updated_at=now() where equipment_id=v_id;
  insert into public.cmms_activity_event(entity_type,entity_id,event_type,actor_user_id,summary,detail)
  values('EQUIPMENT',v_id,'STATUS_CHANGED',auth.uid(),'Equipment status changed',jsonb_build_object('fromStatus',v_old,'toStatus',v_code));
  return jsonb_build_object('equipmentId',v_id,'status',v_code,'previousStatus',v_old);
end $$;

create or replace function public.rpc_cmms_equipment_lifecycle_history(p_equipment_id text,p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  from (
    select activity_id,event_type,actor_label,summary,detail,created_at
    from public.cmms_activity_event
    where entity_type='EQUIPMENT' and entity_id=trim(p_equipment_id)
    order by created_at desc
    limit greatest(1,least(coalesce(p_limit,100),300))
  ) x
$$;

revoke all on function public.rpc_cmms_equipment_lifecycle_history(text,integer) from public,anon;
grant execute on function public.rpc_cmms_equipment_lifecycle_history(text,integer) to authenticated;
