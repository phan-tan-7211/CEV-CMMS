create or replace function public.rpc_cmms_apply_work_order_create_extras(
  p_work_order_id text,
  p_client_mutation_id text,
  p_checklist_template_id uuid default null,
  p_custom_values jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_source jsonb;
  v_checklist jsonb:=jsonb_build_object('appliedCount',0);
  v_fields jsonb:=jsonb_build_object('savedCount',0);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role()::text;
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EXTRAS_ROLE_DENIED'; end if;
  if nullif(trim(coalesce(p_work_order_id,'')),'') is null then raise exception 'WORK_ORDER_ID_REQUIRED'; end if;
  if nullif(trim(coalesce(p_client_mutation_id,'')),'') is null then raise exception 'CLIENT_MUTATION_ID_REQUIRED'; end if;

  select source_data into v_source from public.maintenance_work_order where work_order_id=trim(p_work_order_id) for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if coalesce(v_source->>'createExtrasMutationId','')=trim(p_client_mutation_id) then
    return jsonb_build_object('workOrderId',p_work_order_id,'alreadyApplied',true,'checklist',coalesce(v_source->'createExtrasChecklist','{}'::jsonb),'customFields',coalesce(v_source->'createExtrasCustomFields','{}'::jsonb));
  end if;

  if p_checklist_template_id is not null then
    v_checklist:=public.rpc_cmms_apply_checklist_template_to_work_order(trim(p_work_order_id),p_checklist_template_id);
  end if;
  if jsonb_array_length(coalesce(p_custom_values,'[]'::jsonb))>0 then
    v_fields:=public.rpc_cmms_save_custom_field_values('WORK_ORDER',trim(p_work_order_id),coalesce(p_custom_values,'[]'::jsonb));
  end if;

  update public.maintenance_work_order
  set source_data=coalesce(source_data,'{}'::jsonb)||jsonb_build_object(
    'createExtrasMutationId',trim(p_client_mutation_id),
    'createExtrasAppliedAt',now(),
    'createExtrasChecklist',v_checklist,
    'createExtrasCustomFields',v_fields
  ), updated_at=now()
  where work_order_id=trim(p_work_order_id);

  return jsonb_build_object('workOrderId',p_work_order_id,'alreadyApplied',false,'checklist',v_checklist,'customFields',v_fields);
end $$;

revoke all on function public.rpc_cmms_apply_work_order_create_extras(text,text,uuid,jsonb) from public,anon;
grant execute on function public.rpc_cmms_apply_work_order_create_extras(text,text,uuid,jsonb) to authenticated;