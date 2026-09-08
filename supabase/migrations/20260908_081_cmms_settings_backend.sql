-- CMMS organization/module/work-order settings and per-user dashboard preferences.
-- Additive backend for mobile/web settings screens.

create table if not exists public.cmms_organization_settings (
  settings_id smallint primary key default 1 check (settings_id = 1),
  language_code text not null default 'vi',
  date_format text not null default 'DD/MM/YYYY',
  currency_code text not null default 'VND',
  timezone_name text not null default 'Asia/Ho_Chi_Minh',
  automation_enabled boolean not null default true,
  multi_site_enabled boolean not null default false,
  extra jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cmms_module_settings (
  settings_id smallint primary key default 1 check (settings_id = 1),
  assets_enabled boolean not null default true,
  parts_inventory_enabled boolean not null default true,
  requests_enabled boolean not null default true,
  work_orders_enabled boolean not null default true,
  purchase_orders_enabled boolean not null default true,
  meters_enabled boolean not null default true,
  tags_enabled boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cmms_work_order_settings (
  settings_id smallint primary key default 1 check (settings_id = 1),
  feedback_enabled boolean not null default true,
  completion_note_required boolean not null default false,
  number_start_count bigint not null default 1 check (number_start_count >= 1),
  forms_enabled boolean not null default true,
  custom_statuses_enabled boolean not null default true,
  custom_fields_enabled boolean not null default true,
  categories_enabled boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.cmms_user_dashboard_preference (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dashboard_key text not null default 'WORK_ORDER',
  visible_cards text[] not null default array['due-today','high-priority','overdue','open','in-progress','pm','completed','all']::text[],
  card_order text[] not null default array['due-today','high-priority','overdue','open','in-progress','pm','completed','all']::text[],
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.cmms_organization_settings(settings_id) values(1) on conflict do nothing;
insert into public.cmms_module_settings(settings_id) values(1) on conflict do nothing;
insert into public.cmms_work_order_settings(settings_id) values(1) on conflict do nothing;

alter table public.cmms_organization_settings enable row level security;
alter table public.cmms_module_settings enable row level security;
alter table public.cmms_work_order_settings enable row level security;
alter table public.cmms_user_dashboard_preference enable row level security;

create policy cmms_organization_settings_read on public.cmms_organization_settings for select to authenticated using (public.is_authenticated());
create policy cmms_module_settings_read on public.cmms_module_settings for select to authenticated using (public.is_authenticated());
create policy cmms_work_order_settings_read on public.cmms_work_order_settings for select to authenticated using (public.is_authenticated());
create policy cmms_dashboard_preference_self_read on public.cmms_user_dashboard_preference for select to authenticated using (user_id = auth.uid());
create policy cmms_dashboard_preference_self_insert on public.cmms_user_dashboard_preference for insert to authenticated with check (user_id = auth.uid());
create policy cmms_dashboard_preference_self_update on public.cmms_user_dashboard_preference for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.cmms_organization_settings, public.cmms_module_settings, public.cmms_work_order_settings to authenticated;
grant select,insert,update on public.cmms_user_dashboard_preference to authenticated;

create or replace function public.rpc_cmms_settings_bundle()
returns jsonb
language sql
security invoker
set search_path=public
as $$
  select jsonb_build_object(
    'organization',(select to_jsonb(s) - 'updated_by' from public.cmms_organization_settings s where settings_id=1),
    'modules',(select to_jsonb(s) - 'updated_by' from public.cmms_module_settings s where settings_id=1),
    'workOrders',(select to_jsonb(s) - 'updated_by' from public.cmms_work_order_settings s where settings_id=1),
    'dashboard',coalesce((select to_jsonb(d) from public.cmms_user_dashboard_preference d where user_id=auth.uid()),jsonb_build_object('user_id',auth.uid(),'dashboard_key','WORK_ORDER','visible_cards',array['due-today','high-priority','overdue','open','in-progress','pm','completed','all'],'card_order',array['due-today','high-priority','overdue','open','in-progress','pm','completed','all']))
  )
$$;
revoke all on function public.rpc_cmms_settings_bundle() from public, anon;
grant execute on function public.rpc_cmms_settings_bundle() to authenticated;

create or replace function public.rpc_cmms_update_organization_settings(p_input jsonb)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_row public.cmms_organization_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.current_app_role() <> 'ADMIN' then raise exception 'SETTINGS_ADMIN_REQUIRED'; end if;
  update public.cmms_organization_settings set
    language_code=coalesce(nullif(trim(p_input->>'languageCode'),''),language_code),
    date_format=coalesce(nullif(trim(p_input->>'dateFormat'),''),date_format),
    currency_code=coalesce(nullif(upper(trim(p_input->>'currencyCode')),''),currency_code),
    timezone_name=coalesce(nullif(trim(p_input->>'timezoneName'),''),timezone_name),
    automation_enabled=coalesce((p_input->>'automationEnabled')::boolean,automation_enabled),
    multi_site_enabled=coalesce((p_input->>'multiSiteEnabled')::boolean,multi_site_enabled),
    extra=coalesce(p_input->'extra',extra), updated_by=auth.uid(), updated_at=now()
  where settings_id=1 returning * into v_row;
  return to_jsonb(v_row)-'updated_by';
end $$;
revoke all on function public.rpc_cmms_update_organization_settings(jsonb) from public, anon;
grant execute on function public.rpc_cmms_update_organization_settings(jsonb) to authenticated;

create or replace function public.rpc_cmms_update_module_settings(p_input jsonb)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_row public.cmms_module_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.current_app_role() <> 'ADMIN' then raise exception 'SETTINGS_ADMIN_REQUIRED'; end if;
  update public.cmms_module_settings set
    assets_enabled=coalesce((p_input->>'assetsEnabled')::boolean,assets_enabled),
    parts_inventory_enabled=coalesce((p_input->>'partsInventoryEnabled')::boolean,parts_inventory_enabled),
    requests_enabled=coalesce((p_input->>'requestsEnabled')::boolean,requests_enabled),
    work_orders_enabled=coalesce((p_input->>'workOrdersEnabled')::boolean,work_orders_enabled),
    purchase_orders_enabled=coalesce((p_input->>'purchaseOrdersEnabled')::boolean,purchase_orders_enabled),
    meters_enabled=coalesce((p_input->>'metersEnabled')::boolean,meters_enabled),
    tags_enabled=coalesce((p_input->>'tagsEnabled')::boolean,tags_enabled),
    extra=coalesce(p_input->'extra',extra), updated_by=auth.uid(), updated_at=now()
  where settings_id=1 returning * into v_row;
  return to_jsonb(v_row)-'updated_by';
end $$;
revoke all on function public.rpc_cmms_update_module_settings(jsonb) from public, anon;
grant execute on function public.rpc_cmms_update_module_settings(jsonb) to authenticated;

create or replace function public.rpc_cmms_update_work_order_settings(p_input jsonb)
returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_row public.cmms_work_order_settings%rowtype; v_start bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.current_app_role() <> 'ADMIN' then raise exception 'SETTINGS_ADMIN_REQUIRED'; end if;
  if p_input ? 'numberStartCount' then v_start := (p_input->>'numberStartCount')::bigint; if v_start < 1 then raise exception 'WO_NUMBER_START_INVALID'; end if; end if;
  update public.cmms_work_order_settings set
    feedback_enabled=coalesce((p_input->>'feedbackEnabled')::boolean,feedback_enabled),
    completion_note_required=coalesce((p_input->>'completionNoteRequired')::boolean,completion_note_required),
    number_start_count=coalesce(v_start,number_start_count),
    forms_enabled=coalesce((p_input->>'formsEnabled')::boolean,forms_enabled),
    custom_statuses_enabled=coalesce((p_input->>'customStatusesEnabled')::boolean,custom_statuses_enabled),
    custom_fields_enabled=coalesce((p_input->>'customFieldsEnabled')::boolean,custom_fields_enabled),
    categories_enabled=coalesce((p_input->>'categoriesEnabled')::boolean,categories_enabled),
    extra=coalesce(p_input->'extra',extra), updated_by=auth.uid(), updated_at=now()
  where settings_id=1 returning * into v_row;
  return to_jsonb(v_row)-'updated_by';
end $$;
revoke all on function public.rpc_cmms_update_work_order_settings(jsonb) from public, anon;
grant execute on function public.rpc_cmms_update_work_order_settings(jsonb) to authenticated;

create or replace function public.rpc_cmms_save_dashboard_preference(p_visible_cards text[],p_card_order text[] default null,p_extra jsonb default '{}'::jsonb)
returns public.cmms_user_dashboard_preference
language plpgsql security invoker set search_path=public as $$
declare v_row public.cmms_user_dashboard_preference%rowtype; v_allowed text[]:=array['due-today','high-priority','overdue','open','in-progress','pm','completed','all'];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_visible_cards is null or exists(select 1 from unnest(p_visible_cards) x where not (x=any(v_allowed))) then raise exception 'DASHBOARD_CARD_INVALID'; end if;
  if p_card_order is not null and exists(select 1 from unnest(p_card_order) x where not (x=any(v_allowed))) then raise exception 'DASHBOARD_ORDER_INVALID'; end if;
  insert into public.cmms_user_dashboard_preference(user_id,visible_cards,card_order,extra,updated_at)
  values(auth.uid(),p_visible_cards,coalesce(p_card_order,v_allowed),coalesce(p_extra,'{}'::jsonb),now())
  on conflict(user_id) do update set visible_cards=excluded.visible_cards,card_order=excluded.card_order,extra=excluded.extra,updated_at=now()
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.rpc_cmms_save_dashboard_preference(text[],text[],jsonb) from public, anon;
grant execute on function public.rpc_cmms_save_dashboard_preference(text[],text[],jsonb) to authenticated;
