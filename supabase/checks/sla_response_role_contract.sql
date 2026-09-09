-- Contract checks for 20260909_091_sla_response_role_hardening.sql

do $$
declare
  v_src text;
begin
  if to_regprocedure('public.rpc_cmms_mark_sla_responded(text,text)') is null then
    raise exception 'missing rpc_cmms_mark_sla_responded';
  end if;

  select pg_get_functiondef('public.rpc_cmms_mark_sla_responded(text,text)'::regprocedure) into v_src;
  if position('SLA_RESPOND_ROLE_DENIED' in v_src)=0 then
    raise exception 'SLA response role guard missing';
  end if;
  if position('MAINTENANCE' in v_src)=0 or position('SUPERVISOR' in v_src)=0 or position('MANAGER' in v_src)=0 or position('ADMIN' in v_src)=0 then
    raise exception 'SLA response allowed roles incomplete';
  end if;
  if position('SLA_ENTITY_NOT_FOUND' in v_src)=0 then
    raise exception 'SLA response entity validation missing';
  end if;
  if position('when status=''warning'' then ''active''' in lower(v_src))=0 then
    raise exception 'SLA response warning reset missing';
  end if;
end $$;
