-- Follow-up hardening for SLA response marking.
-- Restricts explicit response mutations to operational roles and clears a warning
-- state after a timely response when no breach has occurred.

create or replace function public.rpc_cmms_mark_sla_responded(
  p_entity_type text,
  p_entity_id text
) returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_type text:=upper(btrim(coalesce(p_entity_type,'')));
  v_id text:=btrim(coalesce(p_entity_id,''));
  v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then
    raise exception 'SLA_RESPOND_ROLE_DENIED';
  end if;
  if v_type not in ('WORK_ORDER','REQUEST') then raise exception 'SLA_ENTITY_TYPE_INVALID'; end if;
  if not public.cmms_entity_exists(v_type,v_id) then raise exception 'SLA_ENTITY_NOT_FOUND'; end if;

  update public.cmms_sla_instance
  set responded_at=coalesce(responded_at,now()),
      status=case
        when breached_at is not null or response_breached_at is not null then 'BREACHED'
        when status='WARNING' then 'ACTIVE'
        else status
      end,
      updated_at=now()
  where entity_type=v_type
    and entity_id=v_id
    and responded_at is null
    and resolved_at is null;

  get diagnostics v_count=row_count;
  return v_count;
end $$;

revoke all on function public.rpc_cmms_mark_sla_responded(text,text) from public, anon;
grant execute on function public.rpc_cmms_mark_sla_responded(text,text) to authenticated;
