-- Bridge legacy spare-part creation to the CMMS inventory ledger.
-- New parts are mirrored into cmms_part. Initial stock is posted once as ADJUSTMENT_IN
-- with reference_type=INITIAL_STOCK, using only the stock location entered by the user.

create or replace function public.rpc_cmms_save_spare_part_v2(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_saved jsonb;
  v_part_id text;
  v_part_number text;
  v_location text;
  v_location_id uuid;
  v_stock numeric;
  v_min_stock numeric;
  v_cmms_existed boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.current_app_role() not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'SPARE_PART_ROLE_DENIED'; end if;

  v_saved := public.rpc_save_spare_part(p_input);
  v_part_id := nullif(btrim(coalesce(v_saved->>'part_id','')), '');
  if v_part_id is null then raise exception 'SPARE_PART_SAVE_RESULT_INVALID'; end if;

  v_part_number := coalesce(nullif(btrim(coalesce(p_input->>'partNumber','')), ''), v_part_id);
  v_location := nullif(btrim(coalesce(p_input->>'location','')), '');
  v_stock := greatest(coalesce(nullif(p_input->>'stockQty','')::numeric,0),0);
  v_min_stock := greatest(coalesce(nullif(p_input->>'minQty','')::numeric,0),0);
  v_cmms_existed := exists(select 1 from public.cmms_part where part_id=v_part_id);

  if exists(select 1 from public.cmms_part where part_number=v_part_number and part_id<>v_part_id) then
    raise exception 'CMMS_PART_NUMBER_DUPLICATE';
  end if;

  insert into public.cmms_part(
    part_id,part_number,name,manufacturer,manufacturer_part_number,barcode,unit,min_stock,
    active,archived_at,source_data,created_by
  ) values (
    v_part_id,
    v_part_number,
    btrim(coalesce(p_input->>'partName','')),
    nullif(btrim(coalesce(p_input->>'maker','')), ''),
    nullif(btrim(coalesce(p_input->>'partNumber','')), ''),
    nullif(btrim(coalesce(p_input->>'barcode','')), ''),
    'EA',
    v_min_stock,
    true,
    null,
    jsonb_build_object('legacySparePart',true),
    auth.uid()
  )
  on conflict(part_id) do update set
    part_number=excluded.part_number,
    name=excluded.name,
    manufacturer=excluded.manufacturer,
    manufacturer_part_number=excluded.manufacturer_part_number,
    barcode=excluded.barcode,
    min_stock=excluded.min_stock,
    active=true,
    archived_at=null,
    source_data=coalesce(public.cmms_part.source_data,'{}'::jsonb) || jsonb_build_object('legacySparePart',true),
    updated_at=now();

  if not v_cmms_existed and v_stock > 0 then
    if v_location is null then raise exception 'INITIAL_STOCK_LOCATION_REQUIRED'; end if;

    insert into public.cmms_stock_location(code,name,location_type,active,archived_at,source_data)
    values(v_location,v_location,'STOCKROOM',true,null,jsonb_build_object('createdFrom','sparePartForm'))
    on conflict(code) do update set active=true, archived_at=null, updated_at=now()
    returning stock_location_id into v_location_id;

    insert into public.cmms_part_stock(part_id,stock_location_id,quantity_on_hand,quantity_reserved)
    values(v_part_id,v_location_id,v_stock,0)
    on conflict(part_id,stock_location_id) do update set
      quantity_on_hand=excluded.quantity_on_hand,
      updated_at=now();

    insert into public.cmms_stock_transaction(
      part_id,stock_location_id,transaction_type,quantity,reference_type,reference_id,note,performed_by,source_data
    ) values (
      v_part_id,v_location_id,'ADJUSTMENT_IN',v_stock,'INITIAL_STOCK',v_part_id,
      'Initial stock from spare part creation',auth.uid(),jsonb_build_object('source','rpc_cmms_save_spare_part_v2')
    );
  end if;

  return v_saved || jsonb_build_object(
    'inventoryPartId',v_part_id,
    'inventoryInitialized',((not v_cmms_existed) and v_stock > 0),
    'stockLocationId',v_location_id
  );
end $$;

revoke all on function public.rpc_cmms_save_spare_part_v2(jsonb) from public, anon;
grant execute on function public.rpc_cmms_save_spare_part_v2(jsonb) to authenticated;
