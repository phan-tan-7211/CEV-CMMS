-- Batch 4: barcode is a first-class Part identifier for mobile/server scan search.
alter table public.spare_part_master add column if not exists barcode text;

create unique index if not exists spare_part_master_barcode_unique
  on public.spare_part_master (upper(trim(barcode)))
  where barcode is not null and trim(barcode) <> '';

-- Keep the existing save RPC compatible while persisting the new barcode field.
create or replace function public.rpc_save_spare_part(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_actor text;
  v_part_id text;
  v_part_name text;
  v_equipment_id text;
  v_is_new boolean;
  v_duplicate_id text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'SPARE_PART_ROLE_DENIED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text,'unknown');
  v_part_id:=upper(trim(coalesce(p_input->>'partId','')));
  v_part_name:=trim(coalesce(p_input->>'partName',''));
  if v_part_name='' then raise exception 'PART_NAME_REQUIRED'; end if;
  v_is_new := v_part_id='';
  if v_is_new then
    if nullif(trim(coalesce(p_input->>'partNumber','')),'') is not null then
      select part_id into v_duplicate_id from public.spare_part_master where upper(coalesce(part_number,''))=upper(trim(p_input->>'partNumber')) and upper(coalesce(maker,''))=upper(trim(coalesce(p_input->>'maker',''))) and active limit 1;
      if v_duplicate_id is not null then raise exception 'SPARE_PART_POSSIBLE_DUPLICATE:%', v_duplicate_id; end if;
    end if;
    v_part_id:=public.next_spare_part_id();
  elsif not exists(select 1 from public.spare_part_master where part_id=v_part_id) then raise exception 'SPARE_PART_EDIT_NOT_FOUND'; end if;
  insert into public.spare_part_master(part_id,part_name,barcode,part_number,maker,stock_qty,min_qty,location,lead_time_days,stops_production,quality_safety_impact,lead_time_exceeds_recovery,rationale_note,active,created_by,updated_by)
  values(v_part_id,v_part_name,nullif(trim(coalesce(p_input->>'barcode','')), ''),nullif(trim(coalesce(p_input->>'partNumber','')),''),nullif(trim(coalesce(p_input->>'maker','')),''),greatest(coalesce((p_input->>'stockQty')::integer,0),0),greatest(coalesce((p_input->>'minQty')::integer,0),0),nullif(trim(coalesce(p_input->>'location','')),''),nullif(p_input->>'leadTimeDays','')::integer,coalesce((p_input->>'stopsProduction')::boolean,false),coalesce((p_input->>'qualitySafetyImpact')::boolean,false),coalesce((p_input->>'leadTimeExceedsRecovery')::boolean,false),nullif(trim(coalesce(p_input->>'rationaleNote','')),''),true,v_actor,v_actor)
  on conflict(part_id) do update set part_name=excluded.part_name,barcode=excluded.barcode,part_number=excluded.part_number,maker=excluded.maker,stock_qty=excluded.stock_qty,min_qty=excluded.min_qty,location=excluded.location,lead_time_days=excluded.lead_time_days,stops_production=excluded.stops_production,quality_safety_impact=excluded.quality_safety_impact,lead_time_exceeds_recovery=excluded.lead_time_exceeds_recovery,rationale_note=excluded.rationale_note,active=true,updated_by=v_actor,updated_at=now();
  delete from public.equipment_spare_part where part_id=v_part_id;
  for v_equipment_id in select jsonb_array_elements_text(coalesce(p_input->'equipmentIds','[]'::jsonb)) loop
    if exists(select 1 from public.equipment_master where equipment_id=v_equipment_id) then insert into public.equipment_spare_part(part_id,equipment_id) values(v_part_id,v_equipment_id) on conflict do nothing; end if;
  end loop;
  insert into public.audit_log(audit_id,entity_type,entity_id,action,actor_email,detail) values('AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),'Spare_Part',v_part_id,case when v_is_new then 'CREATE_SPARE_PART_AUTO_ID' else 'UPDATE_SPARE_PART' end,v_actor,jsonb_build_object('barcode',coalesce(p_input->>'barcode',''),'equipmentIds',coalesce(p_input->'equipmentIds','[]'::jsonb)));
  return (select to_jsonb(v) from public.spare_part_overview v where v.part_id=v_part_id);
end $$;

revoke all on function public.rpc_save_spare_part(jsonb) from public, anon;
grant execute on function public.rpc_save_spare_part(jsonb) to authenticated;
