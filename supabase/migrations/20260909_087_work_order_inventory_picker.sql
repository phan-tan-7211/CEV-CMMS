-- Work Order inventory picker and issue hardening.
-- Provides a normalized stock-row picker for Mobile and validates WO state before stock mutation.

create or replace function public.rpc_cmms_inventory_available_parts(
  p_search text default null,
  p_stock_location_id uuid default null,
  p_limit integer default 200,
  p_offset integer default 0
) returns table(
  part_id text,
  part_number text,
  part_name text,
  barcode text,
  unit text,
  stock_location_id uuid,
  stock_location_code text,
  stock_location_name text,
  quantity_on_hand numeric,
  quantity_reserved numeric,
  quantity_available numeric,
  average_unit_cost numeric
)
language sql
security invoker
set search_path=public
as $$
  select
    p.part_id,
    p.part_number,
    p.name as part_name,
    coalesce(p.barcode,''),
    p.unit,
    s.stock_location_id,
    l.code as stock_location_code,
    l.name as stock_location_name,
    s.quantity_on_hand,
    s.quantity_reserved,
    (s.quantity_on_hand-s.quantity_reserved) as quantity_available,
    s.average_unit_cost
  from public.cmms_part_stock s
  join public.cmms_part p on p.part_id=s.part_id
  join public.cmms_stock_location l on l.stock_location_id=s.stock_location_id
  where p.active=true
    and p.archived_at is null
    and l.active=true
    and l.archived_at is null
    and (s.quantity_on_hand-s.quantity_reserved) > 0
    and (p_stock_location_id is null or s.stock_location_id=p_stock_location_id)
    and (
      nullif(btrim(coalesce(p_search,'')),'') is null
      or p.part_number ilike '%'||btrim(p_search)||'%'
      or p.name ilike '%'||btrim(p_search)||'%'
      or coalesce(p.barcode,'') ilike '%'||btrim(p_search)||'%'
      or l.code ilike '%'||btrim(p_search)||'%'
      or l.name ilike '%'||btrim(p_search)||'%'
    )
  order by p.name, p.part_number, l.code
  limit greatest(1,least(coalesce(p_limit,200),500))
  offset greatest(coalesce(p_offset,0),0)
$$;

revoke all on function public.rpc_cmms_inventory_available_parts(text,uuid,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_inventory_available_parts(text,uuid,integer,integer) to authenticated;

create or replace function public.rpc_cmms_inventory_issue_to_work_order(
  p_work_order_id text,
  p_part_id text,
  p_stock_location_id uuid,
  p_quantity numeric,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_wo public.maintenance_work_order%rowtype;
  v_stock public.cmms_part_stock%rowtype;
  v_part public.cmms_part%rowtype;
  v_txn uuid;
  v_usage uuid;
  v_available numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_ISSUE_ROLE_DENIED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'ISSUE_QUANTITY_REQUIRED'; end if;

  select * into v_wo
  from public.maintenance_work_order
  where work_order_id=trim(p_work_order_id)
  for update;
  if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if v_wo.status <> 'IN_PROGRESS' then raise exception 'WORK_ORDER_NOT_IN_PROGRESS'; end if;

  select * into v_part
  from public.cmms_part
  where part_id=trim(p_part_id) and active=true and archived_at is null;
  if not found then raise exception 'ACTIVE_PART_NOT_FOUND'; end if;

  select * into v_stock
  from public.cmms_part_stock
  where part_id=v_part.part_id and stock_location_id=p_stock_location_id
  for update;
  if not found then raise exception 'PART_STOCK_NOT_FOUND'; end if;

  v_available := v_stock.quantity_on_hand-v_stock.quantity_reserved;
  if v_available < p_quantity then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;

  update public.cmms_part_stock
  set quantity_on_hand=quantity_on_hand-p_quantity, updated_at=now()
  where part_id=v_part.part_id and stock_location_id=p_stock_location_id;

  insert into public.cmms_stock_transaction(
    part_id,stock_location_id,transaction_type,quantity,unit_cost,work_order_id,note,performed_by
  ) values(
    v_part.part_id,p_stock_location_id,'ISSUE',-p_quantity,
    coalesce(v_stock.average_unit_cost,v_part.unit_cost),v_wo.work_order_id,p_note,auth.uid()
  ) returning transaction_id into v_txn;

  insert into public.cmms_work_order_part_usage(
    work_order_id,spare_part_id,part_name,quantity,unit,unit_cost,issued_by,notes,
    inventory_part_id,stock_location_id,stock_transaction_id
  ) values(
    v_wo.work_order_id,v_part.part_id,v_part.name,p_quantity,v_part.unit,
    coalesce(v_stock.average_unit_cost,v_part.unit_cost),auth.uid(),p_note,
    v_part.part_id,p_stock_location_id,v_txn
  ) returning usage_id into v_usage;

  return jsonb_build_object(
    'workOrderId',v_wo.work_order_id,
    'partId',v_part.part_id,
    'stockLocationId',p_stock_location_id,
    'quantity',p_quantity,
    'quantityAvailableBefore',v_available,
    'quantityAvailableAfter',v_available-p_quantity,
    'transactionId',v_txn,
    'usageId',v_usage
  );
end $$;

revoke all on function public.rpc_cmms_inventory_issue_to_work_order(text,text,uuid,numeric,text) from public, anon;
grant execute on function public.rpc_cmms_inventory_issue_to_work_order(text,text,uuid,numeric,text) to authenticated;
