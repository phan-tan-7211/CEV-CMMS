-- Contract checks for 20260909_087_work_order_inventory_picker.sql

do $$
begin
  if to_regprocedure('public.rpc_cmms_inventory_available_parts(text,uuid,integer,integer)') is null then
    raise exception 'missing rpc_cmms_inventory_available_parts';
  end if;
  if to_regprocedure('public.rpc_cmms_inventory_issue_to_work_order(text,text,uuid,numeric,text)') is null then
    raise exception 'missing rpc_cmms_inventory_issue_to_work_order';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='cmms_part_stock' and column_name='quantity_reserved'
  ) then raise exception 'cmms_part_stock.quantity_reserved required'; end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='cmms_work_order_part_usage' and column_name='stock_transaction_id'
  ) then raise exception 'cmms_work_order_part_usage.stock_transaction_id required'; end if;
end $$;
