create or replace function public.rpc_transition_maintenance_request(p_request_id text, p_status text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_request public.maintenance_request%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'REQUEST_STATUS_ROLE_DENIED'; end if;
  select * into v_request from public.maintenance_request where request_id=trim(p_request_id) for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if upper(trim(p_status)) not in ('IN_PROGRESS','COMPLETED','CANCELLED') then raise exception 'REQUEST_STATUS_INVALID'; end if;
  update public.maintenance_request set status=upper(trim(p_status)),updated_at=now() where request_id=v_request.request_id;
  return jsonb_build_object('requestId',v_request.request_id,'status',upper(trim(p_status)));
end $$;
revoke all on function public.rpc_transition_maintenance_request(text,text) from public, anon;
grant execute on function public.rpc_transition_maintenance_request(text,text) to authenticated;
