insert into public.cmms_part(
  part_id,part_number,name,manufacturer,barcode,unit,min_stock,reorder_point,lead_time_days,critical,active,source_data
)
select
  trim(s.part_id),
  coalesce(nullif(trim(s.part_number),''),trim(s.part_id)),
  trim(s.part_name),
  nullif(trim(coalesce(s.maker,'')),''),
  nullif(trim(coalesce(s.barcode,'')),''),
  'EA',
  greatest(coalesce(s.min_qty,0),0),
  greatest(coalesce(s.min_qty,0),0),
  s.lead_time_days,
  coalesce(s.stops_production,false) or coalesce(s.quality_safety_impact,false) or coalesce(s.lead_time_exceeds_recovery,false),
  true,
  jsonb_build_object('source','spare_part_master','backfilledAt',now())
from public.spare_part_master s
where coalesce(s.active,true)=true
on conflict(part_id) do nothing;

insert into public.cmms_stock_location(code,name,location_type,source_data)
select distinct
  case when nullif(trim(coalesce(s.location,'')),'') is null then 'LEGACY-UNASSIGNED' else 'LEGACY-'||upper(substr(md5(trim(s.location)),1,8)) end,
  coalesce(nullif(trim(coalesce(s.location,'')),''),'Chưa phân vị trí'),
  'STOCKROOM',
  jsonb_build_object('source','spare_part_master','legacyLocation',coalesce(nullif(trim(coalesce(s.location,'')),''),'UNASSIGNED'))
from public.spare_part_master s
where coalesce(s.active,true)=true and coalesce(s.stock_qty,0)>0
on conflict(code) do nothing;

insert into public.cmms_part_stock(part_id,stock_location_id,quantity_on_hand,quantity_reserved)
select trim(s.part_id),l.stock_location_id,greatest(coalesce(s.stock_qty,0),0),0
from public.spare_part_master s
join public.cmms_stock_location l on l.code = case when nullif(trim(coalesce(s.location,'')),'') is null then 'LEGACY-UNASSIGNED' else 'LEGACY-'||upper(substr(md5(trim(s.location)),1,8)) end
join public.cmms_part p on p.part_id=trim(s.part_id)
where coalesce(s.active,true)=true and coalesce(s.stock_qty,0)>0
on conflict(part_id,stock_location_id) do nothing;

insert into public.cmms_stock_transaction(part_id,stock_location_id,transaction_type,quantity,reference_type,reference_id,note,source_data)
select trim(s.part_id),l.stock_location_id,'RECEIPT',greatest(coalesce(s.stock_qty,0),0),'LEGACY_BACKFILL',trim(s.part_id),'Tồn đầu kỳ chuyển từ spare_part_master',jsonb_build_object('source','spare_part_master','backfilledAt',now())
from public.spare_part_master s
join public.cmms_stock_location l on l.code = case when nullif(trim(coalesce(s.location,'')),'') is null then 'LEGACY-UNASSIGNED' else 'LEGACY-'||upper(substr(md5(trim(s.location)),1,8)) end
join public.cmms_part p on p.part_id=trim(s.part_id)
where coalesce(s.active,true)=true and coalesce(s.stock_qty,0)>0
  and not exists (
    select 1 from public.cmms_stock_transaction t
    where t.part_id=trim(s.part_id) and t.reference_type='LEGACY_BACKFILL' and t.reference_id=trim(s.part_id)
  );
