create table if not exists public.cmms_work_order_template (
  template_id uuid primary key default gen_random_uuid(), name text not null, description text not null default '', reason text not null default '', priority text not null default 'MEDIUM', checklist_template_id uuid null references public.cmms_checklist_template(template_id) on delete set null, category_code text null, active boolean not null default true, created_by uuid null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cmms_work_order_category (
  category_id uuid primary key default gen_random_uuid(), code text not null, name text not null, description text not null default '', active boolean not null default true, created_by uuid null default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists cmms_work_order_category_code_uq on public.cmms_work_order_category(lower(btrim(code))) where active=true;
create table if not exists public.cmms_asset_custody_event (
  custody_event_id uuid primary key default gen_random_uuid(), equipment_id text not null references public.equipment_master(equipment_id), action text not null check (action in ('CHECK_OUT','CHECK_IN')), holder_name text null, holder_user_id uuid null, note text not null default '', event_at timestamptz not null default now(), created_by uuid null default auth.uid(), created_at timestamptz not null default now()
);
create index if not exists cmms_asset_custody_event_equipment_idx on public.cmms_asset_custody_event(equipment_id,event_at desc);
alter table public.request_portal_settings add column if not exists portal_name text not null default 'CEV Request Portal';
alter table public.request_portal_settings add column if not exists instructions text not null default '';
alter table public.request_portal_settings add column if not exists allow_attachments boolean not null default true;
alter table public.request_portal_settings add column if not exists require_contact boolean not null default false;
alter table public.cmms_work_order_template enable row level security;
alter table public.cmms_work_order_category enable row level security;
alter table public.cmms_asset_custody_event enable row level security;
drop policy if exists cmms_work_order_template_auth_read on public.cmms_work_order_template; create policy cmms_work_order_template_auth_read on public.cmms_work_order_template for select to authenticated using (true);
drop policy if exists cmms_work_order_category_auth_read on public.cmms_work_order_category; create policy cmms_work_order_category_auth_read on public.cmms_work_order_category for select to authenticated using (true);
drop policy if exists cmms_asset_custody_event_auth_read on public.cmms_asset_custody_event; create policy cmms_asset_custody_event_auth_read on public.cmms_asset_custody_event for select to authenticated using (true);

create or replace function public.rpc_cmms_operations_parity_snapshot(p_equipment_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_portal jsonb; v_templates jsonb; v_categories jsonb; v_custody jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select to_jsonb(r) into v_portal from (select settings_id,enabled,can_create_work_order,can_create_request,portal_name,instructions,allow_attachments,require_contact,updated_at from public.request_portal_settings order by updated_at desc nulls last limit 1) r;
  select coalesce(jsonb_agg(jsonb_build_object('templateId',t.template_id,'name',t.name,'description',t.description,'reason',t.reason,'priority',t.priority,'checklistTemplateId',t.checklist_template_id,'categoryCode',t.category_code) order by t.name),'[]'::jsonb) into v_templates from public.cmms_work_order_template t where t.active=true;
  select coalesce(jsonb_agg(jsonb_build_object('categoryId',c.category_id,'code',c.code,'name',c.name,'description',c.description) order by c.name),'[]'::jsonb) into v_categories from public.cmms_work_order_category c where c.active=true;
  select coalesce(jsonb_agg(jsonb_build_object('custodyEventId',e.custody_event_id,'equipmentId',e.equipment_id,'action',e.action,'holderName',e.holder_name,'holderUserId',e.holder_user_id,'note',e.note,'eventAt',e.event_at) order by e.event_at desc),'[]'::jsonb) into v_custody from public.cmms_asset_custody_event e where p_equipment_id is null or e.equipment_id=p_equipment_id;
  return jsonb_build_object('portal',coalesce(v_portal,'{}'::jsonb),'templates',v_templates,'categories',v_categories,'custody',v_custody);
end $$;

create or replace function public.rpc_cmms_save_work_order_template(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_id uuid; v_row public.cmms_work_order_template;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role()::text; if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; v_id:=nullif(p_input->>'templateId','')::uuid; if coalesce(btrim(p_input->>'name'),'')='' then raise exception 'TEMPLATE_NAME_REQUIRED'; end if;
  if v_id is null then insert into public.cmms_work_order_template(name,description,reason,priority,checklist_template_id,category_code,created_by) values(btrim(p_input->>'name'),coalesce(p_input->>'description',''),coalesce(p_input->>'reason',''),upper(coalesce(nullif(p_input->>'priority',''),'MEDIUM')),nullif(p_input->>'checklistTemplateId','')::uuid,nullif(btrim(p_input->>'categoryCode'),''),auth.uid()) returning * into v_row;
  else update public.cmms_work_order_template set name=btrim(p_input->>'name'),description=coalesce(p_input->>'description',''),reason=coalesce(p_input->>'reason',''),priority=upper(coalesce(nullif(p_input->>'priority',''),'MEDIUM')),checklist_template_id=nullif(p_input->>'checklistTemplateId','')::uuid,category_code=nullif(btrim(p_input->>'categoryCode'),''),updated_at=now() where template_id=v_id returning * into v_row; end if;
  return jsonb_build_object('templateId',v_row.template_id,'name',v_row.name);
end $$;

create or replace function public.rpc_cmms_create_work_order_from_template(p_template_id uuid,p_equipment_id text,p_overrides jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.cmms_work_order_template; v_result jsonb; v_wo text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; select * into t from public.cmms_work_order_template where template_id=p_template_id and active=true; if not found then raise exception 'TEMPLATE_NOT_FOUND'; end if;
  v_result:=public.rpc_cmms_create_work_order_v2(jsonb_build_object('equipmentId',p_equipment_id,'reason',coalesce(nullif(p_overrides->>'reason',''),t.reason,t.name),'priority',coalesce(nullif(p_overrides->>'priority',''),t.priority),'sourceType','WORK_ORDER_TEMPLATE','sourceId',t.template_id::text,'plannedStartAt',coalesce(p_overrides->>'plannedStartAt',''),'plannedEndAt',coalesce(p_overrides->>'plannedEndAt',''),'personIds',coalesce(p_overrides->'personIds','[]'::jsonb),'teamIds',coalesce(p_overrides->'teamIds','[]'::jsonb)));
  v_wo:=coalesce(v_result->>'workOrderId',v_result->>'work_order_id'); if v_wo is not null and t.category_code is not null then update public.maintenance_work_order set source_data=coalesce(source_data,'{}'::jsonb)||jsonb_build_object('categoryCode',t.category_code) where work_order_id=v_wo; end if; if v_wo is not null and t.checklist_template_id is not null then perform public.rpc_cmms_apply_checklist_template_to_work_order(t.checklist_template_id,v_wo); end if; return v_result;
end $$;

create or replace function public.rpc_cmms_save_work_order_category(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_id uuid; v_code text; v_row public.cmms_work_order_category;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role()::text; if v_role not in ('MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; v_id:=nullif(p_input->>'categoryId','')::uuid; v_code:=upper(regexp_replace(coalesce(p_input->>'code',''),'[^A-Za-z0-9_-]','','g')); if v_code='' or coalesce(btrim(p_input->>'name'),'')='' then raise exception 'CATEGORY_REQUIRED'; end if;
  if v_id is null then insert into public.cmms_work_order_category(code,name,description,created_by) values(v_code,btrim(p_input->>'name'),coalesce(p_input->>'description',''),auth.uid()) returning * into v_row; else update public.cmms_work_order_category set code=v_code,name=btrim(p_input->>'name'),description=coalesce(p_input->>'description',''),updated_at=now() where category_id=v_id returning * into v_row; end if; return jsonb_build_object('categoryId',v_row.category_id,'code',v_row.code,'name',v_row.name);
end $$;

create or replace function public.rpc_cmms_set_asset_custody(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_eq text; v_action text; v_last text; v_row public.cmms_asset_custody_event;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role()::text; if v_role not in ('TECHNICIAN','SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; v_eq:=btrim(coalesce(p_input->>'equipmentId','')); v_action:=upper(btrim(coalesce(p_input->>'action',''))); if v_eq='' or v_action not in ('CHECK_OUT','CHECK_IN') then raise exception 'CUSTODY_INPUT_INVALID'; end if;
  select action into v_last from public.cmms_asset_custody_event where equipment_id=v_eq order by event_at desc limit 1; if v_action='CHECK_OUT' and v_last='CHECK_OUT' then raise exception 'ASSET_ALREADY_CHECKED_OUT'; end if; if v_action='CHECK_IN' and coalesce(v_last,'CHECK_IN')='CHECK_IN' then raise exception 'ASSET_NOT_CHECKED_OUT'; end if;
  insert into public.cmms_asset_custody_event(equipment_id,action,holder_name,holder_user_id,note,created_by) values(v_eq,v_action,nullif(btrim(p_input->>'holderName'),''),nullif(p_input->>'holderUserId','')::uuid,coalesce(p_input->>'note',''),auth.uid()) returning * into v_row; return jsonb_build_object('custodyEventId',v_row.custody_event_id,'equipmentId',v_row.equipment_id,'action',v_row.action,'eventAt',v_row.event_at);
end $$;

create or replace function public.rpc_cmms_save_request_portal_settings(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_id text; v_row public.request_portal_settings;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; v_role:=public.current_app_role()::text; if v_role not in ('MANAGER','ADMIN') then raise exception 'ROLE_DENIED'; end if; v_id:=coalesce(nullif(p_input->>'settingsId',''),'default');
  insert into public.request_portal_settings(settings_id,enabled,can_create_work_order,can_create_request,portal_name,instructions,allow_attachments,require_contact,updated_at) values(v_id,coalesce((p_input->>'enabled')::boolean,true),coalesce((p_input->>'canCreateWorkOrder')::boolean,false),coalesce((p_input->>'canCreateRequest')::boolean,true),coalesce(nullif(btrim(p_input->>'portalName'),''),'CEV Request Portal'),coalesce(p_input->>'instructions',''),coalesce((p_input->>'allowAttachments')::boolean,true),coalesce((p_input->>'requireContact')::boolean,false),now()) on conflict(settings_id) do update set enabled=excluded.enabled,can_create_work_order=excluded.can_create_work_order,can_create_request=excluded.can_create_request,portal_name=excluded.portal_name,instructions=excluded.instructions,allow_attachments=excluded.allow_attachments,require_contact=excluded.require_contact,updated_at=now() returning * into v_row; return to_jsonb(v_row);
end $$;

revoke all on function public.rpc_cmms_operations_parity_snapshot(text), public.rpc_cmms_save_work_order_template(jsonb), public.rpc_cmms_create_work_order_from_template(uuid,text,jsonb), public.rpc_cmms_save_work_order_category(jsonb), public.rpc_cmms_set_asset_custody(jsonb), public.rpc_cmms_save_request_portal_settings(jsonb) from public,anon;
grant execute on function public.rpc_cmms_operations_parity_snapshot(text), public.rpc_cmms_save_work_order_template(jsonb), public.rpc_cmms_create_work_order_from_template(uuid,text,jsonb), public.rpc_cmms_save_work_order_category(jsonb), public.rpc_cmms_set_asset_custody(jsonb), public.rpc_cmms_save_request_portal_settings(jsonb) to authenticated;