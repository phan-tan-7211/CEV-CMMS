-- Purchase order workflow, reorder conversion and receiving RPCs.

create or replace function public.rpc_cmms_create_purchase_order_from_reorders(
  p_reorder_request_ids uuid[],
  p_vendor_id uuid,
  p_currency_code text default null,
  p_expected_date date default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_role public.app_role; v_po_id text; v_po_number text; v_line integer:=0; v_subtotal numeric:=0; r record; v_cost numeric; v_total numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'PO_CREATE_ROLE_DENIED'; end if;
  if p_reorder_request_ids is null or cardinality(p_reorder_request_ids)=0 then raise exception 'REORDER_REQUEST_REQUIRED'; end if;
  if not exists(select 1 from public.cmms_business_party where party_id=p_vendor_id and party_kind in ('VENDOR','BOTH') and active=true and archived_at is null) then raise exception 'ACTIVE_VENDOR_NOT_FOUND'; end if;

  v_po_id:='PO-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  v_po_number:='PO-'||to_char(current_date,'YYYYMMDD')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.cmms_purchase_order(purchase_order_id,po_number,vendor_id,status,order_date,expected_date,currency_code,created_by)
  values(v_po_id,v_po_number,p_vendor_id,'DRAFT',current_date,p_expected_date,upper(nullif(trim(coalesce(p_currency_code,'')),'')),auth.uid());

  for r in
    select rr.*,p.name as part_name,p.unit,p.unit_cost,pv.unit_cost as vendor_unit_cost
    from public.cmms_reorder_request rr
    join public.cmms_part p on p.part_id=rr.part_id
    left join public.cmms_part_vendor pv on pv.part_id=rr.part_id and pv.vendor_id=p_vendor_id
    where rr.reorder_request_id=any(p_reorder_request_ids) and rr.status='OPEN'
    for update of rr
  loop
    v_line:=v_line+1;
    v_cost:=coalesce(r.vendor_unit_cost,r.unit_cost,0);
    v_total:=r.requested_quantity*v_cost;
    v_subtotal:=v_subtotal+v_total;
    insert into public.cmms_purchase_order_line(purchase_order_id,line_no,part_id,description,quantity_ordered,unit,unit_cost,line_total,stock_location_id)
    values(v_po_id,v_line,r.part_id,r.part_name,r.requested_quantity,r.unit,v_cost,v_total,r.stock_location_id);
    update public.cmms_reorder_request set status='IN_PURCHASE_ORDER',purchase_order_id=v_po_id,updated_at=now() where reorder_request_id=r.reorder_request_id;
  end loop;

  if v_line=0 then raise exception 'NO_OPEN_REORDER_REQUESTS'; end if;
  update public.cmms_purchase_order set subtotal=v_subtotal,total_amount=v_subtotal,updated_at=now() where purchase_order_id=v_po_id;
  return jsonb_build_object('purchaseOrderId',v_po_id,'poNumber',v_po_number,'lineCount',v_line,'subtotal',v_subtotal);
end $$;
revoke all on function public.rpc_cmms_create_purchase_order_from_reorders(uuid[],uuid,text,date) from public,anon;
grant execute on function public.rpc_cmms_create_purchase_order_from_reorders(uuid[],uuid,text,date) to authenticated;

create or replace function public.rpc_cmms_transition_purchase_order(p_purchase_order_id text,p_action text)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_po public.cmms_purchase_order%rowtype; v_action text:=upper(trim(coalesce(p_action,''))); v_next text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  select * into v_po from public.cmms_purchase_order where purchase_order_id=trim(p_purchase_order_id) for update;
  if not found then raise exception 'PURCHASE_ORDER_NOT_FOUND'; end if;
  case v_action
    when 'SUBMIT' then if v_po.status<>'DRAFT' then raise exception 'INVALID_PO_TRANSITION'; end if; v_next:='PENDING_APPROVAL';
    when 'APPROVE' then if v_role not in ('MANAGER','ADMIN') then raise exception 'PO_APPROVE_ROLE_DENIED'; end if; if v_po.status not in ('DRAFT','PENDING_APPROVAL') then raise exception 'INVALID_PO_TRANSITION'; end if; v_next:='APPROVED';
    when 'ORDER' then if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'PO_ORDER_ROLE_DENIED'; end if; if v_po.status<>'APPROVED' then raise exception 'INVALID_PO_TRANSITION'; end if; v_next:='ORDERED';
    when 'CANCEL' then if v_role not in ('MANAGER','ADMIN') then raise exception 'PO_CANCEL_ROLE_DENIED'; end if; if v_po.status in ('RECEIVED','CLOSED','CANCELLED') then raise exception 'INVALID_PO_TRANSITION'; end if; v_next:='CANCELLED';
    when 'CLOSE' then if v_role not in ('MANAGER','ADMIN') then raise exception 'PO_CLOSE_ROLE_DENIED'; end if; if v_po.status not in ('RECEIVED','PARTIALLY_RECEIVED') then raise exception 'INVALID_PO_TRANSITION'; end if; v_next:='CLOSED';
    else raise exception 'UNKNOWN_PO_ACTION';
  end case;
  update public.cmms_purchase_order set status=v_next,
    approved_by=case when v_action='APPROVE' then auth.uid() else approved_by end,
    approved_at=case when v_action='APPROVE' then now() else approved_at end,
    updated_at=now() where purchase_order_id=v_po.purchase_order_id;
  if v_action='ORDER' then update public.cmms_reorder_request set status='ORDERED',updated_at=now() where purchase_order_id=v_po.purchase_order_id and status='IN_PURCHASE_ORDER'; end if;
  if v_action='CANCEL' then update public.cmms_reorder_request set status='OPEN',purchase_order_id=null,updated_at=now() where purchase_order_id=v_po.purchase_order_id and status in ('IN_PURCHASE_ORDER','ORDERED'); end if;
  return jsonb_build_object('purchaseOrderId',v_po.purchase_order_id,'status',v_next);
end $$;
revoke all on function public.rpc_cmms_transition_purchase_order(text,text) from public,anon;
grant execute on function public.rpc_cmms_transition_purchase_order(text,text) to authenticated;

create or replace function public.rpc_cmms_receive_purchase_order_line(
  p_purchase_order_line_id uuid,
  p_quantity numeric,
  p_stock_location_id uuid default null,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_role public.app_role; v_line public.cmms_purchase_order_line%rowtype; v_po public.cmms_purchase_order%rowtype; v_location uuid; v_remaining numeric; v_new_received numeric; v_txn uuid; v_new_status text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'PO_RECEIVE_ROLE_DENIED'; end if;
  if p_quantity is null or p_quantity<=0 then raise exception 'RECEIVE_QUANTITY_REQUIRED'; end if;
  select * into v_line from public.cmms_purchase_order_line where purchase_order_line_id=p_purchase_order_line_id for update;
  if not found then raise exception 'PURCHASE_ORDER_LINE_NOT_FOUND'; end if;
  select * into v_po from public.cmms_purchase_order where purchase_order_id=v_line.purchase_order_id for update;
  if v_po.status not in ('ORDERED','PARTIALLY_RECEIVED') then raise exception 'PO_NOT_RECEIVABLE'; end if;
  if v_line.part_id is null then raise exception 'INVENTORY_PART_REQUIRED'; end if;
  v_remaining:=v_line.quantity_ordered-v_line.quantity_received;
  if p_quantity>v_remaining then raise exception 'RECEIVE_EXCEEDS_REMAINING'; end if;
  v_location:=coalesce(p_stock_location_id,v_line.stock_location_id);
  if v_location is null then raise exception 'STOCK_LOCATION_REQUIRED'; end if;

  insert into public.cmms_part_stock(part_id,stock_location_id,quantity_on_hand,average_unit_cost)
  values(v_line.part_id,v_location,0,v_line.unit_cost)
  on conflict(part_id,stock_location_id) do nothing;
  update public.cmms_part_stock set
    average_unit_cost=case when quantity_on_hand+p_quantity=0 then coalesce(average_unit_cost,v_line.unit_cost)
      else ((quantity_on_hand*coalesce(average_unit_cost,v_line.unit_cost))+(p_quantity*v_line.unit_cost))/(quantity_on_hand+p_quantity) end,
    quantity_on_hand=quantity_on_hand+p_quantity,
    updated_at=now()
  where part_id=v_line.part_id and stock_location_id=v_location;

  insert into public.cmms_stock_transaction(part_id,stock_location_id,transaction_type,quantity,unit_cost,purchase_order_id,reference_type,reference_id,note,performed_by)
  values(v_line.part_id,v_location,'RECEIPT',p_quantity,v_line.unit_cost,v_line.purchase_order_id,'PURCHASE_ORDER_LINE',p_purchase_order_line_id::text,p_note,auth.uid())
  returning transaction_id into v_txn;

  v_new_received:=v_line.quantity_received+p_quantity;
  update public.cmms_purchase_order_line set quantity_received=v_new_received,stock_location_id=v_location,updated_at=now() where purchase_order_line_id=p_purchase_order_line_id;

  if exists(select 1 from public.cmms_purchase_order_line where purchase_order_id=v_line.purchase_order_id and quantity_received<quantity_ordered) then v_new_status:='PARTIALLY_RECEIVED'; else v_new_status:='RECEIVED'; end if;
  update public.cmms_purchase_order set status=v_new_status,updated_at=now() where purchase_order_id=v_line.purchase_order_id;

  if v_new_status='RECEIVED' then
    update public.cmms_reorder_request set status='FULFILLED',updated_at=now() where purchase_order_id=v_line.purchase_order_id and status in ('IN_PURCHASE_ORDER','ORDERED');
  end if;

  return jsonb_build_object('purchaseOrderId',v_line.purchase_order_id,'lineId',p_purchase_order_line_id,'received',v_new_received,'remaining',v_line.quantity_ordered-v_new_received,'status',v_new_status,'transactionId',v_txn);
end $$;
revoke all on function public.rpc_cmms_receive_purchase_order_line(uuid,numeric,uuid,text) from public,anon;
grant execute on function public.rpc_cmms_receive_purchase_order_line(uuid,numeric,uuid,text) to authenticated;

create or replace function public.rpc_cmms_purchase_order_detail(p_purchase_order_id text)
returns jsonb language sql security invoker set search_path=public as $$
  select jsonb_build_object(
    'purchaseOrder',to_jsonb(po),
    'vendor',case when v.party_id is null then null else to_jsonb(v) end,
    'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.line_no) from public.cmms_purchase_order_line l where l.purchase_order_id=po.purchase_order_id),'[]'::jsonb),
    'reorderRequests',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.cmms_reorder_request r where r.purchase_order_id=po.purchase_order_id),'[]'::jsonb)
  )
  from public.cmms_purchase_order po
  left join public.cmms_business_party v on v.party_id=po.vendor_id
  where po.purchase_order_id=trim(p_purchase_order_id)
$$;
revoke all on function public.rpc_cmms_purchase_order_detail(text) from public,anon;
grant execute on function public.rpc_cmms_purchase_order_detail(text) to authenticated;
