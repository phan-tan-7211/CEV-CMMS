create or replace function public.rpc_cmms_purchasing_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_reorders jsonb;
  v_orders jsonb;
  v_vendors jsonb;
  v_locations jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_reorders
  from (
    select r.reorder_request_id,r.part_id,p.part_number,p.name part_name,r.stock_location_id,l.code location_code,l.name location_name,
           r.requested_quantity,r.reason,r.status,r.purchase_order_id,r.created_at,r.updated_at
    from public.cmms_reorder_request r
    join public.cmms_part p on p.part_id=r.part_id
    left join public.cmms_stock_location l on l.stock_location_id=r.stock_location_id
    where r.status in ('OPEN','IN_PURCHASE_ORDER','ORDERED')
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_orders
  from (
    select po.purchase_order_id,po.po_number,po.vendor_id,v.company_name vendor_name,po.status,po.order_date,po.expected_date,
           po.currency_code,po.subtotal,po.total_amount,po.created_at,po.updated_at,
           coalesce((select count(*) from public.cmms_purchase_order_line l where l.purchase_order_id=po.purchase_order_id),0) line_count,
           coalesce((select sum(l.quantity_ordered-l.quantity_received) from public.cmms_purchase_order_line l where l.purchase_order_id=po.purchase_order_id),0) remaining_quantity
    from public.cmms_purchase_order po
    left join public.cmms_business_party v on v.party_id=po.vendor_id
    where po.status not in ('CLOSED','CANCELLED')
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.company_name),'[]'::jsonb)
  into v_vendors
  from (
    select party_id,party_kind,company_name,contact_name,email,phone,address
    from public.cmms_business_party
    where party_kind in ('VENDOR','BOTH') and active=true and archived_at is null
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.name,x.code),'[]'::jsonb)
  into v_locations
  from (
    select stock_location_id,code,name,location_type
    from public.cmms_stock_location
    where active=true and archived_at is null
  ) x;

  return jsonb_build_object('reorders',v_reorders,'orders',v_orders,'vendors',v_vendors,'locations',v_locations);
end $$;

revoke all on function public.rpc_cmms_purchasing_snapshot() from public, anon;
grant execute on function public.rpc_cmms_purchasing_snapshot() to authenticated;
