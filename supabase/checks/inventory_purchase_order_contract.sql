-- Read-only contract checks for inventory / purchase order foundation.
begin;

do $$
declare t text; missing text[]:=array[]::text[];
begin
  foreach t in array array['cmms_part','cmms_stock_location','cmms_part_stock','cmms_part_vendor','cmms_stock_transaction','cmms_purchase_order','cmms_purchase_order_line','cmms_reorder_request'] loop
    if to_regclass('public.'||t) is null then missing:=array_append(missing,t); end if;
  end loop;
  if cardinality(missing)>0 then raise exception 'Inventory/PO tables missing: %',array_to_string(missing,', '); end if;
end $$;

do $$
declare bad text[];
begin
  select array_agg(c.relname order by c.relname) into bad
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array['cmms_part','cmms_stock_location','cmms_part_stock','cmms_part_vendor','cmms_stock_transaction','cmms_purchase_order','cmms_purchase_order_line','cmms_reorder_request']) and not c.relrowsecurity;
  if coalesce(cardinality(bad),0)>0 then raise exception 'RLS disabled on: %',array_to_string(bad,', '); end if;
end $$;

do $$
begin
  if to_regprocedure('public.rpc_cmms_inventory_issue_to_work_order(text,text,uuid,numeric,text)') is null then raise exception 'inventory issue RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_inventory_adjust(text,uuid,numeric,text)') is null then raise exception 'inventory adjust RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_low_stock(uuid,boolean)') is null then raise exception 'low stock RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_generate_reorder_requests(uuid)') is null then raise exception 'reorder generation RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_create_purchase_order_from_reorders(uuid[],uuid,text,date)') is null then raise exception 'PO create RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_transition_purchase_order(text,text)') is null then raise exception 'PO transition RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_receive_purchase_order_line(uuid,numeric,uuid,text)') is null then raise exception 'PO receive RPC missing'; end if;
  if to_regprocedure('public.rpc_cmms_purchase_order_detail(text)') is null then raise exception 'PO detail RPC missing'; end if;
end $$;

do $$
declare col text; missing text[]:=array[]::text[];
begin
  foreach col in array array['inventory_part_id','stock_location_id','stock_transaction_id'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='cmms_work_order_part_usage' and column_name=col) then missing:=array_append(missing,col); end if;
  end loop;
  if cardinality(missing)>0 then raise exception 'cmms_work_order_part_usage inventory links missing: %',array_to_string(missing,', '); end if;
end $$;

rollback;
