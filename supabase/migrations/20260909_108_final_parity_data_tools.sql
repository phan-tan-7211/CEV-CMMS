create or replace function public.rpc_cmms_export_dataset(p_entity_type text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text:=upper(trim(coalesce(p_entity_type,'')));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_type='ASSET' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'equipmentId',equipment_id,'equipmentType',equipment_type::text,'equipmentName',coalesce(equipment_name,''),
      'model',coalesce(model,''),'manufacturer',coalesce(manufacturer,''),'serialNumber',coalesce(serial_number,''),
      'department',coalesce(department,''),'status',coalesce(status,''),'locationId',location_id,
      'currentArea',coalesce(source_data->>'currentArea',''),'currentLine',coalesce(source_data->>'currentLine',''),
      'criticality',coalesce(source_data->>'criticality','')
    ) order by equipment_id),'[]'::jsonb) into v_result
    from public.equipment_master where active=true and archived_at is null;
  elsif v_type='PART' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'partId',part_id,'partName',part_name,'partNumber',coalesce(part_number,''),'barcode',coalesce(barcode,''),
      'maker',coalesce(maker,''),'stockQty',stock_qty,'minQty',min_qty,'location',coalesce(location,'')
    ) order by part_id),'[]'::jsonb) into v_result
    from public.spare_part_master where active=true;
  elsif v_type='LOCATION' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'locationId',location_id,'parentLocationId',parent_location_id,'name',name,'address',coalesce(address,''),'description',coalesce(description,'')
    ) order by name),'[]'::jsonb) into v_result
    from public.cmms_location where archived_at is null;
  elsif v_type='METER' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'meterId',meter_id,'equipmentId',equipment_id,'name',name,'meterType',meter_type,'unit',unit,'rolloverValue',rollover_value
    ) order by name),'[]'::jsonb) into v_result
    from public.cmms_meter where active=true and archived_at is null;
  elsif v_type='WORK_ORDER' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'workOrderId',work_order_id,'equipmentId',equipment_id,'status',status,'priority',coalesce(priority,''),
      'reason',coalesce(reason,''),'plannedStartAt',planned_start_at,'plannedEndAt',planned_end_at,'createdAt',created_at
    ) order by created_at desc),'[]'::jsonb) into v_result
    from public.maintenance_work_order;
  else
    raise exception 'EXPORT_ENTITY_UNSUPPORTED';
  end if;
  return v_result;
end $$;

create or replace function public.rpc_cmms_import_dataset(p_entity_type text,p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text;
  v_type text:=upper(trim(coalesce(p_entity_type,'')));
  v_row jsonb;
  v_result jsonb;
  v_items jsonb:='[]'::jsonb;
  v_ok int:=0;
  v_failed int:=0;
  v_index int:=0;
  v_required boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role()::text;
  if v_role not in ('MANAGER','ADMIN') then raise exception 'IMPORT_ROLE_DENIED'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'IMPORT_ROWS_ARRAY_REQUIRED'; end if;
  if jsonb_array_length(coalesce(p_rows,'[]'::jsonb))>500 then raise exception 'IMPORT_ROW_LIMIT_500'; end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_index:=v_index+1;
    begin
      if v_type='LOCATION' then
        v_result:=public.rpc_cmms_upsert_location(jsonb_build_object(
          'name',coalesce(v_row->>'name',v_row->>'Name',''),
          'parentLocationId',coalesce(v_row->>'parentLocationId',v_row->>'parent_location_id',''),
          'address',coalesce(v_row->>'address',''),
          'description',coalesce(v_row->>'description','')
        ));
      elsif v_type='PART' then
        v_result:=public.rpc_cmms_save_spare_part_v2(jsonb_build_object(
          'partName',coalesce(v_row->>'partName',v_row->>'part_name',v_row->>'name',''),
          'partNumber',coalesce(v_row->>'partNumber',v_row->>'part_number',''),
          'barcode',coalesce(v_row->>'barcode',''),
          'maker',coalesce(v_row->>'maker',v_row->>'manufacturer',''),
          'stockQty',coalesce(v_row->>'stockQty',v_row->>'stock_qty','0'),
          'minQty',coalesce(v_row->>'minQty',v_row->>'min_qty','0'),
          'location',coalesce(v_row->>'location',''),
          'equipmentIds',coalesce(v_row->'equipmentIds','[]'::jsonb)
        ));
      elsif v_type='METER' then
        v_result:=public.rpc_cmms_save_meter(jsonb_build_object(
          'equipmentId',coalesce(v_row->>'equipmentId',v_row->>'equipment_id',''),
          'name',coalesce(v_row->>'name',''),
          'meterType',coalesce(v_row->>'meterType',v_row->>'meter_type','COUNTER'),
          'unit',coalesce(v_row->>'unit',''),
          'rolloverValue',coalesce(v_row->>'rolloverValue',v_row->>'rollover_value','')
        ));
      elsif v_type='WORK_ORDER' then
        v_result:=public.rpc_cmms_create_work_order_v2(jsonb_build_object(
          'equipmentId',coalesce(v_row->>'equipmentId',v_row->>'equipment_id',''),
          'reason',coalesce(v_row->>'reason',v_row->>'title',''),
          'priority',coalesce(v_row->>'priority','MEDIUM'),
          'sourceType','IMPORT','sourceId',coalesce(v_row->>'sourceId','IMPORT'),
          'plannedStartAt',coalesce(v_row->>'plannedStartAt',v_row->>'planned_start_at',''),
          'plannedEndAt',coalesce(v_row->>'plannedEndAt',v_row->>'planned_end_at',''),
          'personIds',coalesce(v_row->'personIds','[]'::jsonb),
          'teamIds',coalesce(v_row->'teamIds','[]'::jsonb)
        ));
      elsif v_type='ASSET' then
        v_required := (v_row ? 'controlsProductQuality') and (v_row ? 'specialCharacteristicImpact') and (v_row ? 'stopsProduction') and (v_row ? 'hasBackup') and (v_row ? 'capacityImpact');
        if not v_required then raise exception 'ASSET_IMPORT_CRITICALITY_FACTS_REQUIRED'; end if;
        v_result:=public.rpc_create_equipment_auto(jsonb_build_object(
          'equipmentType',coalesce(v_row->>'equipmentType','PRODUCTION'),
          'equipmentName',coalesce(v_row->>'equipmentName',v_row->>'equipment_name',v_row->>'name',''),
          'model',coalesce(v_row->>'model',''),'manufacturer',coalesce(v_row->>'manufacturer',''),
          'serialNumber',coalesce(v_row->>'serialNumber',v_row->>'serial_number',''),
          'department',coalesce(v_row->>'department',''),'status',coalesce(v_row->>'status','RUNNING'),
          'currentArea',coalesce(v_row->>'currentArea',''),'currentLine',coalesce(v_row->>'currentLine',''),
          'controlsProductQuality',(v_row->>'controlsProductQuality')::boolean,
          'specialCharacteristicImpact',(v_row->>'specialCharacteristicImpact')::boolean,
          'stopsProduction',(v_row->>'stopsProduction')::boolean,
          'hasBackup',(v_row->>'hasBackup')::boolean,
          'capacityImpact',(v_row->>'capacityImpact')::boolean
        ));
      else
        raise exception 'IMPORT_ENTITY_UNSUPPORTED';
      end if;
      v_ok:=v_ok+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object('row',v_index,'ok',true,'result',v_result));
    exception when others then
      v_failed:=v_failed+1;
      v_items:=v_items||jsonb_build_array(jsonb_build_object('row',v_index,'ok',false,'error',sqlerrm));
    end;
  end loop;
  return jsonb_build_object('entityType',v_type,'successCount',v_ok,'failedCount',v_failed,'items',v_items);
end $$;

revoke all on function public.rpc_cmms_export_dataset(text), public.rpc_cmms_import_dataset(text,jsonb) from public,anon;
grant execute on function public.rpc_cmms_export_dataset(text), public.rpc_cmms_import_dataset(text,jsonb) to authenticated;