create or replace function public.rpc_cmms_save_meter(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_role text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role()::text;
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'METER_WRITE_ROLE_DENIED'; end if;
  if nullif(trim(coalesce(p_input->>'equipmentId','')),'') is null then raise exception 'METER_EQUIPMENT_REQUIRED'; end if;
  if nullif(trim(coalesce(p_input->>'name','')),'') is null then raise exception 'METER_NAME_REQUIRED'; end if;
  if nullif(trim(coalesce(p_input->>'unit','')),'') is null then raise exception 'METER_UNIT_REQUIRED'; end if;
  insert into public.cmms_meter(equipment_id,name,meter_type,unit,rollover_value,active,created_by,source_data)
  values(trim(p_input->>'equipmentId'),trim(p_input->>'name'),upper(coalesce(nullif(p_input->>'meterType',''),'COUNTER')),trim(p_input->>'unit'),nullif(p_input->>'rolloverValue','')::numeric,true,auth.uid(),p_input)
  returning meter_id into v_id;
  return jsonb_build_object('meterId',v_id);
end $$;

create or replace function public.rpc_cmms_apply_checklist_template_to_work_order(p_work_order_id text,p_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_role text; v_count int:=0; v_base int:=0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role()::text;
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'CHECKLIST_APPLY_ROLE_DENIED'; end if;
  if not exists(select 1 from public.cmms_checklist_template where template_id=p_template_id and archived_at is null and active) then raise exception 'CHECKLIST_TEMPLATE_NOT_FOUND'; end if;
  select coalesce(max(sequence_no),0) into v_base from public.cmms_work_order_checklist_item where work_order_id=p_work_order_id;
  insert into public.cmms_work_order_checklist_item(work_order_id,sequence_no,title,description,response_type,required)
  select p_work_order_id,v_base+row_number() over(order by i.sequence_no),i.label,i.description,i.item_type,i.required
  from public.cmms_checklist_template_item i where i.template_id=p_template_id order by i.sequence_no;
  get diagnostics v_count=row_count;
  return jsonb_build_object('workOrderId',p_work_order_id,'templateId',p_template_id,'appliedCount',v_count);
end $$;

create or replace function public.rpc_cmms_entity_custom_values(p_entity_type text,p_entity_id text)
returns jsonb language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('fieldId',d.field_id,'label',d.label,'fieldType',d.field_type,'required',d.required,'choices',d.choices,'value',v.value) order by d.sort_order,d.label),'[]'::jsonb)
  from public.cmms_custom_field_definition d
  left join public.cmms_custom_field_value v on v.field_id=d.field_id and v.entity_id=trim(p_entity_id)
  where d.active and d.entity_type=upper(trim(p_entity_type));
$$;

create or replace function public.rpc_cmms_save_custom_field_values(p_entity_type text,p_entity_id text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_item jsonb; v_count int:=0; v_field uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role()::text;
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'CUSTOM_FIELD_VALUE_ROLE_DENIED'; end if;
  for v_item in select * from jsonb_array_elements(coalesce(p_values,'[]'::jsonb)) loop
    v_field:=nullif(v_item->>'fieldId','')::uuid;
    if v_field is null then continue; end if;
    if not exists(select 1 from public.cmms_custom_field_definition d where d.field_id=v_field and d.active and d.entity_type=upper(trim(p_entity_type))) then raise exception 'CUSTOM_FIELD_INVALID'; end if;
    insert into public.cmms_custom_field_value(field_id,entity_type,entity_id,value,updated_by)
    values(v_field,upper(trim(p_entity_type)),trim(p_entity_id),v_item->'value',auth.uid())
    on conflict(field_id,entity_id) do update set value=excluded.value,entity_type=excluded.entity_type,updated_by=auth.uid(),updated_at=now();
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('savedCount',v_count);
end $$;

revoke all on function public.rpc_cmms_save_meter(jsonb), public.rpc_cmms_apply_checklist_template_to_work_order(text,uuid), public.rpc_cmms_entity_custom_values(text,text), public.rpc_cmms_save_custom_field_values(text,text,jsonb) from public,anon;
grant execute on function public.rpc_cmms_save_meter(jsonb), public.rpc_cmms_apply_checklist_template_to_work_order(text,uuid), public.rpc_cmms_entity_custom_values(text,text), public.rpc_cmms_save_custom_field_values(text,text,jsonb) to authenticated;
