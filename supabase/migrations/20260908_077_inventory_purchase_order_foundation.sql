-- CMMS inventory / spare parts / purchase order foundation.
-- Additive only; designed to integrate with cmms_work_order_part_usage without changing existing UI.

create table if not exists public.cmms_part (
  part_id text primary key,
  part_number text not null unique,
  name text not null,
  description text,
  category text,
  manufacturer text,
  manufacturer_part_number text,
  barcode text,
  unit text not null default 'EA',
  unit_cost numeric,
  min_stock numeric not null default 0,
  max_stock numeric,
  reorder_point numeric,
  reorder_quantity numeric,
  lead_time_days integer,
  critical boolean not null default false,
  active boolean not null default true,
  archived_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_part_number_not_blank check (btrim(part_number) <> ''),
  constraint cmms_part_name_not_blank check (btrim(name) <> ''),
  constraint cmms_part_unit_cost_nonnegative check (unit_cost is null or unit_cost >= 0),
  constraint cmms_part_min_stock_nonnegative check (min_stock >= 0),
  constraint cmms_part_max_stock_valid check (max_stock is null or max_stock >= min_stock),
  constraint cmms_part_reorder_point_nonnegative check (reorder_point is null or reorder_point >= 0),
  constraint cmms_part_reorder_qty_positive check (reorder_quantity is null or reorder_quantity > 0),
  constraint cmms_part_lead_time_nonnegative check (lead_time_days is null or lead_time_days >= 0)
);

create table if not exists public.cmms_stock_location (
  stock_location_id uuid primary key default gen_random_uuid(),
  cmms_location_id uuid references public.cmms_location(location_id) on delete set null,
  parent_stock_location_id uuid references public.cmms_stock_location(stock_location_id) on delete restrict,
  code text not null unique,
  name text not null,
  location_type text not null default 'STOCKROOM',
  active boolean not null default true,
  archived_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_stock_location_code_not_blank check (btrim(code) <> ''),
  constraint cmms_stock_location_name_not_blank check (btrim(name) <> ''),
  constraint cmms_stock_location_type_valid check (location_type in ('WAREHOUSE','STOCKROOM','BIN','VAN','LINE_SIDE','CONSIGNMENT','OTHER')),
  constraint cmms_stock_location_not_self_parent check (parent_stock_location_id is null or parent_stock_location_id <> stock_location_id)
);

create table if not exists public.cmms_part_stock (
  part_id text not null references public.cmms_part(part_id) on delete cascade,
  stock_location_id uuid not null references public.cmms_stock_location(stock_location_id) on delete cascade,
  quantity_on_hand numeric not null default 0,
  quantity_reserved numeric not null default 0,
  average_unit_cost numeric,
  updated_at timestamptz not null default now(),
  primary key(part_id, stock_location_id),
  constraint cmms_part_stock_on_hand_nonnegative check (quantity_on_hand >= 0),
  constraint cmms_part_stock_reserved_nonnegative check (quantity_reserved >= 0),
  constraint cmms_part_stock_reserved_valid check (quantity_reserved <= quantity_on_hand),
  constraint cmms_part_stock_avg_cost_nonnegative check (average_unit_cost is null or average_unit_cost >= 0)
);

create table if not exists public.cmms_part_vendor (
  part_id text not null references public.cmms_part(part_id) on delete cascade,
  vendor_id uuid not null references public.cmms_business_party(party_id) on delete cascade,
  vendor_part_number text,
  preferred boolean not null default false,
  unit_cost numeric,
  currency_code text,
  min_order_quantity numeric,
  lead_time_days integer,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(part_id, vendor_id),
  constraint cmms_part_vendor_cost_nonnegative check (unit_cost is null or unit_cost >= 0),
  constraint cmms_part_vendor_moq_positive check (min_order_quantity is null or min_order_quantity > 0),
  constraint cmms_part_vendor_lead_nonnegative check (lead_time_days is null or lead_time_days >= 0)
);

create table if not exists public.cmms_stock_transaction (
  transaction_id uuid primary key default gen_random_uuid(),
  part_id text not null references public.cmms_part(part_id) on delete restrict,
  stock_location_id uuid not null references public.cmms_stock_location(stock_location_id) on delete restrict,
  transaction_type text not null,
  quantity numeric not null,
  unit_cost numeric,
  work_order_id text references public.maintenance_work_order(work_order_id) on delete set null,
  purchase_order_id text,
  reference_type text,
  reference_id text,
  note text,
  performed_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  source_data jsonb not null default '{}'::jsonb,
  constraint cmms_stock_txn_quantity_nonzero check (quantity <> 0),
  constraint cmms_stock_txn_cost_nonnegative check (unit_cost is null or unit_cost >= 0),
  constraint cmms_stock_txn_type_valid check (transaction_type in ('RECEIPT','ISSUE','RETURN','TRANSFER_IN','TRANSFER_OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT','RESERVE','UNRESERVE'))
);

create table if not exists public.cmms_purchase_order (
  purchase_order_id text primary key,
  po_number text not null unique,
  vendor_id uuid references public.cmms_business_party(party_id) on delete restrict,
  status text not null default 'DRAFT',
  order_date date,
  expected_date date,
  currency_code text,
  shipping_address text,
  notes text,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  shipping_amount numeric not null default 0,
  total_amount numeric not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_po_number_not_blank check (btrim(po_number) <> ''),
  constraint cmms_po_status_valid check (status in ('DRAFT','PENDING_APPROVAL','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','CLOSED')),
  constraint cmms_po_amounts_nonnegative check (subtotal >= 0 and tax_amount >= 0 and shipping_amount >= 0 and total_amount >= 0),
  constraint cmms_po_expected_valid check (expected_date is null or order_date is null or expected_date >= order_date)
);

create table if not exists public.cmms_purchase_order_line (
  purchase_order_line_id uuid primary key default gen_random_uuid(),
  purchase_order_id text not null references public.cmms_purchase_order(purchase_order_id) on delete cascade,
  line_no integer not null,
  part_id text references public.cmms_part(part_id) on delete set null,
  description text not null,
  quantity_ordered numeric not null,
  quantity_received numeric not null default 0,
  unit text,
  unit_cost numeric not null default 0,
  tax_rate numeric,
  line_total numeric not null default 0,
  stock_location_id uuid references public.cmms_stock_location(stock_location_id) on delete set null,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(purchase_order_id, line_no),
  constraint cmms_po_line_qty_positive check (quantity_ordered > 0),
  constraint cmms_po_line_received_valid check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  constraint cmms_po_line_cost_nonnegative check (unit_cost >= 0),
  constraint cmms_po_line_total_nonnegative check (line_total >= 0)
);

create table if not exists public.cmms_reorder_request (
  reorder_request_id uuid primary key default gen_random_uuid(),
  part_id text not null references public.cmms_part(part_id) on delete cascade,
  stock_location_id uuid references public.cmms_stock_location(stock_location_id) on delete set null,
  requested_quantity numeric not null,
  reason text not null default 'LOW_STOCK',
  status text not null default 'OPEN',
  purchase_order_id text references public.cmms_purchase_order(purchase_order_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_reorder_qty_positive check (requested_quantity > 0),
  constraint cmms_reorder_status_valid check (status in ('OPEN','IN_PURCHASE_ORDER','ORDERED','FULFILLED','CANCELLED'))
);

create unique index if not exists cmms_reorder_open_unique
  on public.cmms_reorder_request(part_id, coalesce(stock_location_id,'00000000-0000-0000-0000-000000000000'::uuid))
  where status='OPEN';
create index if not exists cmms_stock_txn_part_date_idx on public.cmms_stock_transaction(part_id, occurred_at desc);
create index if not exists cmms_stock_txn_wo_idx on public.cmms_stock_transaction(work_order_id, occurred_at desc);
create index if not exists cmms_po_status_date_idx on public.cmms_purchase_order(status, created_at desc);
create index if not exists cmms_po_vendor_idx on public.cmms_purchase_order(vendor_id, created_at desc);

alter table public.cmms_work_order_part_usage
  add column if not exists inventory_part_id text references public.cmms_part(part_id) on delete set null,
  add column if not exists stock_location_id uuid references public.cmms_stock_location(stock_location_id) on delete set null,
  add column if not exists stock_transaction_id uuid references public.cmms_stock_transaction(transaction_id) on delete set null;

-- RLS and direct-management policies.
do $$
declare t text;
begin
  foreach t in array array[
    'cmms_part','cmms_stock_location','cmms_part_stock','cmms_part_vendor','cmms_stock_transaction',
    'cmms_purchase_order','cmms_purchase_order_line','cmms_reorder_request'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_authenticated())', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_manage', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_app_role() in (''MANAGER'',''ADMIN'')) with check (public.current_app_role() in (''MANAGER'',''ADMIN''))', t || '_manage', t);
  end loop;
end $$;

-- Maintenance and supervisor roles may post inventory transactions only through RPCs.
grant select on public.cmms_part, public.cmms_stock_location, public.cmms_part_stock, public.cmms_part_vendor,
  public.cmms_stock_transaction, public.cmms_purchase_order, public.cmms_purchase_order_line, public.cmms_reorder_request to authenticated;

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
  v_stock public.cmms_part_stock%rowtype;
  v_part public.cmms_part%rowtype;
  v_txn uuid;
  v_usage uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_ISSUE_ROLE_DENIED'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'ISSUE_QUANTITY_REQUIRED'; end if;
  if not exists(select 1 from public.maintenance_work_order where work_order_id=trim(p_work_order_id)) then raise exception 'WORK_ORDER_NOT_FOUND'; end if;

  select * into v_part from public.cmms_part where part_id=trim(p_part_id) and active=true and archived_at is null;
  if not found then raise exception 'ACTIVE_PART_NOT_FOUND'; end if;

  select * into v_stock from public.cmms_part_stock
  where part_id=v_part.part_id and stock_location_id=p_stock_location_id
  for update;
  if not found or (v_stock.quantity_on_hand-v_stock.quantity_reserved) < p_quantity then raise exception 'INSUFFICIENT_AVAILABLE_STOCK'; end if;

  update public.cmms_part_stock
  set quantity_on_hand=quantity_on_hand-p_quantity, updated_at=now()
  where part_id=v_part.part_id and stock_location_id=p_stock_location_id;

  insert into public.cmms_stock_transaction(part_id,stock_location_id,transaction_type,quantity,unit_cost,work_order_id,note,performed_by)
  values(v_part.part_id,p_stock_location_id,'ISSUE',-p_quantity,coalesce(v_stock.average_unit_cost,v_part.unit_cost),trim(p_work_order_id),p_note,auth.uid())
  returning transaction_id into v_txn;

  insert into public.cmms_work_order_part_usage(work_order_id,spare_part_id,part_name,quantity,unit,unit_cost,issued_by,notes,inventory_part_id,stock_location_id,stock_transaction_id)
  values(trim(p_work_order_id),v_part.part_id,v_part.name,p_quantity,v_part.unit,coalesce(v_stock.average_unit_cost,v_part.unit_cost),auth.uid(),p_note,v_part.part_id,p_stock_location_id,v_txn)
  returning usage_id into v_usage;

  return jsonb_build_object('workOrderId',trim(p_work_order_id),'partId',v_part.part_id,'quantity',p_quantity,'transactionId',v_txn,'usageId',v_usage);
end $$;
revoke all on function public.rpc_cmms_inventory_issue_to_work_order(text,text,uuid,numeric,text) from public, anon;
grant execute on function public.rpc_cmms_inventory_issue_to_work_order(text,text,uuid,numeric,text) to authenticated;

create or replace function public.rpc_cmms_inventory_adjust(
  p_part_id text,
  p_stock_location_id uuid,
  p_quantity_delta numeric,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_txn uuid; v_new numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'INVENTORY_ADJUST_ROLE_DENIED'; end if;
  if p_quantity_delta is null or p_quantity_delta=0 then raise exception 'ADJUSTMENT_DELTA_REQUIRED'; end if;

  insert into public.cmms_part_stock(part_id,stock_location_id,quantity_on_hand)
  values(trim(p_part_id),p_stock_location_id,0)
  on conflict(part_id,stock_location_id) do nothing;

  update public.cmms_part_stock
  set quantity_on_hand=quantity_on_hand+p_quantity_delta, updated_at=now()
  where part_id=trim(p_part_id) and stock_location_id=p_stock_location_id
    and quantity_on_hand+p_quantity_delta >= quantity_reserved
  returning quantity_on_hand into v_new;
  if not found then raise exception 'ADJUSTMENT_WOULD_MAKE_STOCK_INVALID'; end if;

  insert into public.cmms_stock_transaction(part_id,stock_location_id,transaction_type,quantity,note,performed_by)
  values(trim(p_part_id),p_stock_location_id,case when p_quantity_delta>0 then 'ADJUSTMENT_IN' else 'ADJUSTMENT_OUT' end,p_quantity_delta,p_note,auth.uid())
  returning transaction_id into v_txn;

  return jsonb_build_object('partId',trim(p_part_id),'quantityOnHand',v_new,'transactionId',v_txn);
end $$;
revoke all on function public.rpc_cmms_inventory_adjust(text,uuid,numeric,text) from public, anon;
grant execute on function public.rpc_cmms_inventory_adjust(text,uuid,numeric,text) to authenticated;

create or replace function public.rpc_cmms_low_stock(
  p_stock_location_id uuid default null,
  p_only_below_reorder boolean default true
) returns table(
  part_id text, part_number text, part_name text, stock_location_id uuid, stock_location_name text,
  quantity_on_hand numeric, quantity_reserved numeric, quantity_available numeric, reorder_point numeric,
  reorder_quantity numeric, suggested_order_quantity numeric, preferred_vendor_id uuid
)
language sql security invoker set search_path=public as $$
  select p.part_id,p.part_number,p.name,s.stock_location_id,l.name,
         s.quantity_on_hand,s.quantity_reserved,(s.quantity_on_hand-s.quantity_reserved),
         coalesce(p.reorder_point,p.min_stock),p.reorder_quantity,
         greatest(coalesce(p.reorder_quantity,coalesce(p.max_stock,p.min_stock)-s.quantity_on_hand),0),
         (select pv.vendor_id from public.cmms_part_vendor pv where pv.part_id=p.part_id order by pv.preferred desc,pv.updated_at desc limit 1)
  from public.cmms_part p
  join public.cmms_part_stock s on s.part_id=p.part_id
  join public.cmms_stock_location l on l.stock_location_id=s.stock_location_id
  where p.active=true and p.archived_at is null and l.active=true and l.archived_at is null
    and (p_stock_location_id is null or s.stock_location_id=p_stock_location_id)
    and (not p_only_below_reorder or (s.quantity_on_hand-s.quantity_reserved) <= coalesce(p.reorder_point,p.min_stock))
  order by p.critical desc, p.name, l.name
$$;
revoke all on function public.rpc_cmms_low_stock(uuid,boolean) from public, anon;
grant execute on function public.rpc_cmms_low_stock(uuid,boolean) to authenticated;

create or replace function public.rpc_cmms_generate_reorder_requests(p_stock_location_id uuid default null)
returns integer
language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_count integer:=0; r record; v_qty numeric;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'REORDER_GENERATE_ROLE_DENIED'; end if;
  for r in select * from public.rpc_cmms_low_stock(p_stock_location_id,true) loop
    v_qty:=greatest(coalesce(r.suggested_order_quantity,0),1);
    insert into public.cmms_reorder_request(part_id,stock_location_id,requested_quantity,reason,status)
    values(r.part_id,r.stock_location_id,v_qty,'LOW_STOCK','OPEN')
    on conflict do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return v_count;
end $$;
revoke all on function public.rpc_cmms_generate_reorder_requests(uuid) from public, anon;
grant execute on function public.rpc_cmms_generate_reorder_requests(uuid) to authenticated;
