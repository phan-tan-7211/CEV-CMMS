do $$
declare
  missing_tables text[];
  missing_functions text[];
  rls_disabled text[];
begin
  select array_agg(name order by name) into missing_tables
  from unnest(array[
    'cmms_organization_settings',
    'cmms_module_settings',
    'cmms_work_order_settings',
    'cmms_user_dashboard_preference'
  ]) as name
  where to_regclass('public.' || name) is null;

  if coalesce(cardinality(missing_tables),0) > 0 then
    raise exception 'CMMS settings tables missing: %', missing_tables;
  end if;

  select array_agg(signature order by signature) into missing_functions
  from unnest(array[
    'public.rpc_cmms_settings_bundle()',
    'public.rpc_cmms_update_organization_settings(jsonb)',
    'public.rpc_cmms_update_module_settings(jsonb)',
    'public.rpc_cmms_update_work_order_settings(jsonb)',
    'public.rpc_cmms_save_dashboard_preference(text[],text[],jsonb)'
  ]) as signature
  where to_regprocedure(signature) is null;

  if coalesce(cardinality(missing_functions),0) > 0 then
    raise exception 'CMMS settings RPCs missing: %', missing_functions;
  end if;

  select array_agg(c.relname order by c.relname) into rls_disabled
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname = any(array[
      'cmms_organization_settings',
      'cmms_module_settings',
      'cmms_work_order_settings',
      'cmms_user_dashboard_preference'
    ])
    and not c.relrowsecurity;

  if coalesce(cardinality(rls_disabled),0) > 0 then
    raise exception 'CMMS settings tables without RLS: %', rls_disabled;
  end if;

  if (select count(*) from public.cmms_organization_settings where settings_id=1) <> 1 then
    raise exception 'Organization settings singleton missing';
  end if;
  if (select count(*) from public.cmms_module_settings where settings_id=1) <> 1 then
    raise exception 'Module settings singleton missing';
  end if;
  if (select count(*) from public.cmms_work_order_settings where settings_id=1) <> 1 then
    raise exception 'Work Order settings singleton missing';
  end if;
end $$;
