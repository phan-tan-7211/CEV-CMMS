-- Security Advisor hardening for legacy public-schema objects.
-- 1) Make legacy overview views honor caller RLS/permissions.
-- 2) Make views read-only to app roles and remove anonymous access.
-- 3) Fix mutable search_path on is_authenticated().
-- 4) Remove anonymous/PUBLIC execute from the exact legacy SECURITY DEFINER
--    functions flagged by Supabase Security Advisor, while preserving intended
--    authenticated access where those RPCs are part of the signed-in app API.

alter view public.spare_part_overview set (security_invoker = true);
alter view public.equipment_org_resolved set (security_invoker = true);

revoke all on table public.spare_part_overview from public, anon, authenticated, service_role;
grant select on table public.spare_part_overview to authenticated, service_role;

revoke all on table public.equipment_org_resolved from public, anon, authenticated, service_role;
grant select on table public.equipment_org_resolved to authenticated, service_role;

alter function public.is_authenticated() set search_path = public;

-- Helpers used by RLS/app functions: signed-in users may execute, anonymous users may not.
revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- Event-trigger helper is never an app RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Legacy signed-in application/admin RPCs. Keep authenticated/service_role, remove anonymous/PUBLIC.
do $$
declare
  v_name text;
  v_oid oid;
begin
  foreach v_name in array array[
    'admin_update_equipment',
    'rpc_create_equipment_status',
    'rpc_create_maintenance_work_order',
    'rpc_create_tooling',
    'rpc_create_tooling_modification',
    'rpc_create_tooling_plan',
    'rpc_cutover_diagnostics',
    'rpc_cutover_write_smoke',
    'rpc_delete_equipment_status_master',
    'rpc_equipment_photo_paths',
    'rpc_evaluate_calibration',
    'rpc_list_equipment_status_master',
    'rpc_record_calibration',
    'rpc_record_calibration_vendor_quote',
    'rpc_record_equipment_handover',
    'rpc_record_maintenance_result',
    'rpc_set_equipment_status',
    'rpc_submit_daily_inspection',
    'rpc_transition_tooling_modification',
    'rpc_update_equipment_status_master',
    'rpc_upsert_downtime_event_bm06',
    'rpc_upsert_maintenance_plan'
  ] loop
    for v_oid in
      select p.oid
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_name and p.prosecdef
    loop
      execute format('revoke execute on function %s from public, anon', v_oid::regprocedure);
      execute format('grant execute on function %s to authenticated, service_role', v_oid::regprocedure);
    end loop;
  end loop;
end $$;
