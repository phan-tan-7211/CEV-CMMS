create or replace function public.rpc_cmms_inventory_move(
  p_part_id text,
  p_stock_location_id uuid,
  p_action text,
  p_quantity numeric,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_action text := upper(trim(coalesce(p_action,'')));
  v_part_id text := trim(coalesce(p_part_id,''));
  v_delta numeric;
  v_type text;
  v_new numeric;
  v_txn uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_MOVE_ROLE_DENIED'; end if;
  if v_part_id = '' then raise exception 'PART_ID_REQUIRED'; end if;
  if p_stock_location_id is null then raise exception 'STOCK_LOCATION_REQUIRED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'POSITIVE_QUANTITY_REQUIRED'; end if;

  if v_action = 'RECEIVE' then v_delta := p_quantity; v_type := 'RECEIPT';
  elsif v_action = 'ISSUE' then v_delta := -p_quantity; v_type := 'ISSUE';
  elsif v_action = 'ADJUST_IN' then v_delta := p_quantity; v_type := 'ADJUSTMENT_IN';
  elsif v_action = 'ADJUST_OUT' then v_delta := -p_quantity; v_type := 'ADJUSTMENT_OUT';
  else raise exception 'INVENTORY_ACTION_INVALID';
  end if;

  if v_delta > 0 then
    insert into public.cmms_part_stock(part_id,stock_location_id,quantity_on_hand,quantity_reserved)
    values(v_part_id,p_stock_location_id,0,0)
    on conflict(part_id,stock_location_id) do nothing;
  end if;

  update public.cmms_part_stock
  set quantity_on_hand = quantity_on_hand + v_delta, updated_at = now()
  where part_id = v_part_id and stock_location_id = p_stock_location_id
    and quantity_on_hand + v_delta >= quantity_reserved
    and quantity_on_hand + v_delta >= 0
  returning quantity_on_hand into v_new;

  if not found then raise exception 'INSUFFICIENT_OR_RESERVED_STOCK'; end if;

  insert into public.cmms_stock_transaction(part_id,stock_location_id,transaction_type,quantity,note,performed_by)
  values(v_part_id,p_stock_location_id,v_type,v_delta,nullif(trim(coalesce(p_note,'')),''),auth.uid())
  returning transaction_id into v_txn;

  return jsonb_build_object('partId',v_part_id,'stockLocationId',p_stock_location_id,'quantityOnHand',v_new,'transactionId',v_txn,'transactionType',v_type);
end $$;

create or replace function public.rpc_cmms_inventory_snapshot(
  p_part_id text default null,
  p_search text default null,
  p_transaction_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_part text := nullif(trim(coalesce(p_part_id,'')),'');
  v_search text := nullif(trim(coalesce(p_search,'')),'');
  v_limit integer := greatest(1,least(coalesce(p_transaction_limit,100),300));
  v_parts jsonb;
  v_locations jsonb;
  v_stock jsonb;
  v_transactions jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.risk_rank desc, x.name, x.part_id),'[]'::jsonb)
  into v_parts
  from (
    select r.part_id,r.part_number,r.name,p.barcode,p.manufacturer,p.unit,
           r.min_stock,r.reorder_point,r.quantity_on_hand,r.quantity_reserved,r.quantity_available,
           r.stock_value,r.risk_state,r.suggested_order_quantity,
           case when r.risk_state in ('OUT_OF_STOCK','CRITICAL') then 3 when r.risk_state in ('LOW_STOCK','REORDER') then 2 else 1 end risk_rank
    from public.cmms_analytics_inventory_risk_v r
    join public.cmms_part p on p.part_id=r.part_id
    where p.active=true and p.archived_at is null
      and (v_part is null or p.part_id=v_part)
      and (v_search is null or p.part_id ilike '%'||v_search||'%' or coalesce(p.part_number,'') ilike '%'||v_search||'%' or p.name ilike '%'||v_search||'%' or coalesce(p.barcode,'') ilike '%'||v_search||'%')
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.code),'[]'::jsonb)
  into v_locations
  from (
    select stock_location_id,code,name,location_type
    from public.cmms_stock_location
    where active=true and archived_at is null
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.location_name,x.part_id),'[]'::jsonb)
  into v_stock
  from (
    select s.part_id,s.stock_location_id,l.code location_code,l.name location_name,
           s.quantity_on_hand,s.quantity_reserved,(s.quantity_on_hand-s.quantity_reserved) quantity_available,s.average_unit_cost,s.updated_at
    from public.cmms_part_stock s
    join public.cmms_stock_location l on l.stock_location_id=s.stock_location_id
    where (v_part is null or s.part_id=v_part)
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc),'[]'::jsonb)
  into v_transactions
  from (
    select t.transaction_id,t.part_id,t.stock_location_id,l.code location_code,l.name location_name,
           t.transaction_type,t.quantity,t.unit_cost,t.work_order_id,t.purchase_order_id,t.reference_type,t.reference_id,t.note,t.performed_by,t.occurred_at
    from public.cmms_stock_transaction t
    join public.cmms_stock_location l on l.stock_location_id=t.stock_location_id
    where (v_part is null or t.part_id=v_part)
    order by t.occurred_at desc
    limit v_limit
  ) x;

  return jsonb_build_object('parts',v_parts,'locations',v_locations,'stock',v_stock,'transactions',v_transactions);
end $$;

revoke all on function public.rpc_cmms_inventory_move(text,uuid,text,numeric,text) from public, anon;
revoke all on function public.rpc_cmms_inventory_snapshot(text,text,integer) from public, anon;
grant execute on function public.rpc_cmms_inventory_move(text,uuid,text,numeric,text) to authenticated;
grant execute on function public.rpc_cmms_inventory_snapshot(text,text,integer) to authenticated;
