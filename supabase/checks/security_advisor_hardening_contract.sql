-- Contract checks for 20260909_092_security_advisor_hardening.sql

do $$
declare
  v_view text;
  v_name text;
  v_oid oid;
  v_config text[];
begin
  foreach v_view in array array['spare_part_overview','equipment_org_resolved'] loop
    if not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=v_view
        and coalesce(c.reloptions,'{}'::text[]) @> array['security_invoker=true']
    ) then raise exception 'view % is not security_invoker',v_view; end if;
    if has_table_privilege('anon',format('public.%I',v_view),'SELECT') then
      raise exception 'anon can still select view %',v_view;
    end if;
    if not has_table_privilege('authenticated',format('public.%I',v_view),'SELECT') then
      raise exception 'authenticated lost select on view %',v_view;
    end if;
  end loop;

  select proconfig into v_config
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='is_authenticated' and pg_get_function_identity_arguments(p.oid)='';
  if v_config is null or not (v_config @> array['search_path=public']) then
    raise exception 'is_authenticated search_path not fixed';
  end if;

  foreach v_name in array array[
    'admin_update_equipment','current_app_role','is_admin','rls_auto_enable',
    'rpc_create_equipment_status','rpc_create_maintenance_work_order','rpc_create_tooling',
    'rpc_create_tooling_modification','rpc_create_tooling_plan','rpc_cutover_diagnostics',
    'rpc_cutover_write_smoke','rpc_delete_equipment_status_master','rpc_equipment_photo_paths',
    'rpc_evaluate_calibration','rpc_list_equipment_status_master','rpc_record_calibration',
    'rpc_record_calibration_vendor_quote','rpc_record_equipment_handover','rpc_record_maintenance_result',
    'rpc_set_equipment_status','rpc_submit_daily_inspection','rpc_transition_tooling_modification',
    'rpc_update_equipment_status_master','rpc_upsert_downtime_event_bm06','rpc_upsert_maintenance_plan'
  ] loop
    for v_oid in
      select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_name and p.prosecdef
    loop
      if has_function_privilege('anon',v_oid,'EXECUTE') then
        raise exception 'anon can still execute %',v_oid::regprocedure;
      end if;
    end loop;
  end loop;
end $$;
