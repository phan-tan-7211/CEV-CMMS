-- Contract check for 20260909_093_cutover_diagnostics_security.sql

do $$
declare v_oid oid;
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='rpc_cutover_diagnostics' and pg_get_function_identity_arguments(p.oid)='';
  if v_oid is null then raise exception 'rpc_cutover_diagnostics missing'; end if;
  if has_function_privilege('anon',v_oid,'EXECUTE') then raise exception 'anon can execute cutover diagnostics'; end if;
  if has_function_privilege('authenticated',v_oid,'EXECUTE') then raise exception 'authenticated can execute cutover diagnostics'; end if;
  if not has_function_privilege('service_role',v_oid,'EXECUTE') then raise exception 'service_role lost cutover diagnostics'; end if;
end $$;
