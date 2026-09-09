create table if not exists public.cmms_work_order_signature_requirement (
  work_order_id text primary key references public.maintenance_work_order(work_order_id) on delete cascade,
  required boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create table if not exists public.cmms_work_order_signature (
  signature_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  signer_name text not null,
  signer_role text,
  signature_text text not null,
  signed_at timestamptz not null default now(),
  signed_by uuid default auth.uid()
);
create table if not exists public.cmms_checklist_template_rule (
  template_item_id uuid primary key references public.cmms_checklist_template_item(template_item_id) on delete cascade,
  locked boolean not null default false,
  restricted_role text,
  condition_item_id uuid references public.cmms_checklist_template_item(template_item_id) on delete set null,
  condition_operator text,
  condition_value text,
  updated_at timestamptz not null default now()
);
create table if not exists public.cmms_asset_financial_profile (
  equipment_id text primary key references public.equipment_master(equipment_id) on delete cascade,
  purchase_date date,
  purchase_cost numeric(18,2),
  warranty_expiry date,
  useful_life_months integer,
  salvage_value numeric(18,2),
  depreciation_method text not null default 'STRAIGHT_LINE',
  replacement_target_date date,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);
create table if not exists public.cmms_tag (
  tag_id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create unique index if not exists cmms_tag_name_unique on public.cmms_tag(lower(name)) where active;
create table if not exists public.cmms_entity_tag (
  entity_type text not null,
  entity_id text not null,
  tag_id uuid not null references public.cmms_tag(tag_id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  primary key(entity_type, entity_id, tag_id)
);
alter table public.cmms_work_order_signature_requirement enable row level security;
alter table public.cmms_work_order_signature enable row level security;
alter table public.cmms_checklist_template_rule enable row level security;
alter table public.cmms_asset_financial_profile enable row level security;
alter table public.cmms_tag enable row level security;
alter table public.cmms_entity_tag enable row level security;
revoke all on public.cmms_work_order_signature_requirement, public.cmms_work_order_signature, public.cmms_checklist_template_rule, public.cmms_asset_financial_profile, public.cmms_tag, public.cmms_entity_tag from anon, authenticated;

create or replace function public.rpc_cmms_mobile_last_parity_snapshot(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'workOrders', coalesce((select jsonb_agg(jsonb_build_object('id',w.work_order_id,'status',w.status,'reason',w.reason,'equipmentId',w.equipment_id,'signatureRequired',coalesce(r.required,false),'signatures',coalesce((select jsonb_agg(jsonb_build_object('id',s.signature_id,'name',s.signer_name,'role',s.signer_role,'text',s.signature_text,'signedAt',s.signed_at) order by s.signed_at desc) from public.cmms_work_order_signature s where s.work_order_id=w.work_order_id),'[]'::jsonb))) from (select * from public.maintenance_work_order order by created_at desc limit greatest(1,least(coalesce(p_limit,100),300))) w left join public.cmms_work_order_signature_requirement r on r.work_order_id=w.work_order_id),'[]'::jsonb),
    'equipment', coalesce((select jsonb_agg(jsonb_build_object('id',e.equipment_id,'name',e.equipment_name,'profile',case when f.equipment_id is null then null else jsonb_build_object('purchaseDate',f.purchase_date,'purchaseCost',f.purchase_cost,'warrantyExpiry',f.warranty_expiry,'usefulLifeMonths',f.useful_life_months,'salvageValue',f.salvage_value,'depreciationMethod',f.depreciation_method,'replacementTargetDate',f.replacement_target_date) end)) from (select * from public.equipment_master where active=true order by equipment_name limit greatest(1,least(coalesce(p_limit,100),300))) e left join public.cmms_asset_financial_profile f on f.equipment_id=e.equipment_id),'[]'::jsonb),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id',t.tag_id,'name',t.name,'color',t.color,'usageCount',(select count(*) from public.cmms_entity_tag et where et.tag_id=t.tag_id)) order by t.name) from public.cmms_tag t where t.active),'[]'::jsonb),
    'checklistRules', coalesce((select jsonb_agg(jsonb_build_object('templateItemId',i.template_item_id,'templateId',i.template_id,'label',i.label,'locked',coalesce(r.locked,false),'restrictedRole',r.restricted_role,'conditionItemId',r.condition_item_id,'conditionOperator',r.condition_operator,'conditionValue',r.condition_value) order by i.template_id,i.sequence_no) from public.cmms_checklist_template_item i left join public.cmms_checklist_template_rule r on r.template_item_id=i.template_item_id),'[]'::jsonb),
    'entityTags', coalesce((select jsonb_agg(jsonb_build_object('entityType',et.entity_type,'entityId',et.entity_id,'tagId',et.tag_id)) from public.cmms_entity_tag et),'[]'::jsonb)
  );
end $$;
create or replace function public.rpc_cmms_set_signature_requirement(p_work_order_id text,p_required boolean)
returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; insert into public.cmms_work_order_signature_requirement(work_order_id,required,updated_at,updated_by) values(p_work_order_id,coalesce(p_required,true),now(),auth.uid()) on conflict(work_order_id) do update set required=excluded.required,updated_at=now(),updated_by=auth.uid(); end $$;
create or replace function public.rpc_cmms_sign_work_order(p_work_order_id text,p_signer_name text,p_signer_role text,p_signature_text text)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if nullif(trim(p_signer_name),'') is null or nullif(trim(p_signature_text),'') is null then raise exception 'SIGNATURE_REQUIRED'; end if; insert into public.cmms_work_order_signature(work_order_id,signer_name,signer_role,signature_text,signed_by) values(p_work_order_id,trim(p_signer_name),nullif(trim(p_signer_role),''),p_signature_text,auth.uid()) returning signature_id into v_id; return v_id; end $$;
create or replace function public.rpc_cmms_save_checklist_rule(p_template_item_id uuid,p_locked boolean,p_restricted_role text,p_condition_item_id uuid,p_condition_operator text,p_condition_value text)
returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; insert into public.cmms_checklist_template_rule(template_item_id,locked,restricted_role,condition_item_id,condition_operator,condition_value,updated_at) values(p_template_item_id,coalesce(p_locked,false),nullif(trim(p_restricted_role),''),p_condition_item_id,nullif(trim(p_condition_operator),''),nullif(p_condition_value,''),now()) on conflict(template_item_id) do update set locked=excluded.locked,restricted_role=excluded.restricted_role,condition_item_id=excluded.condition_item_id,condition_operator=excluded.condition_operator,condition_value=excluded.condition_value,updated_at=now(); end $$;
create or replace function public.rpc_cmms_save_asset_financial_profile(p_equipment_id text,p_purchase_date date,p_purchase_cost numeric,p_warranty_expiry date,p_useful_life_months integer,p_salvage_value numeric,p_depreciation_method text,p_replacement_target_date date)
returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; insert into public.cmms_asset_financial_profile(equipment_id,purchase_date,purchase_cost,warranty_expiry,useful_life_months,salvage_value,depreciation_method,replacement_target_date,updated_at,updated_by) values(p_equipment_id,p_purchase_date,p_purchase_cost,p_warranty_expiry,p_useful_life_months,p_salvage_value,coalesce(nullif(trim(p_depreciation_method),''),'STRAIGHT_LINE'),p_replacement_target_date,now(),auth.uid()) on conflict(equipment_id) do update set purchase_date=excluded.purchase_date,purchase_cost=excluded.purchase_cost,warranty_expiry=excluded.warranty_expiry,useful_life_months=excluded.useful_life_months,salvage_value=excluded.salvage_value,depreciation_method=excluded.depreciation_method,replacement_target_date=excluded.replacement_target_date,updated_at=now(),updated_by=auth.uid(); end $$;
create or replace function public.rpc_cmms_create_tag(p_name text,p_color text default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if nullif(trim(p_name),'') is null then raise exception 'TAG_NAME_REQUIRED'; end if; insert into public.cmms_tag(name,color,created_by) values(trim(p_name),nullif(trim(p_color),''),auth.uid()) returning tag_id into v_id; return v_id; exception when unique_violation then select tag_id into v_id from public.cmms_tag where active and lower(name)=lower(trim(p_name)) limit 1; return v_id; end $$;
create or replace function public.rpc_cmms_set_entity_tag(p_entity_type text,p_entity_id text,p_tag_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if coalesce(p_enabled,true) then insert into public.cmms_entity_tag(entity_type,entity_id,tag_id,created_by) values(upper(trim(p_entity_type)),trim(p_entity_id),p_tag_id,auth.uid()) on conflict do nothing; else delete from public.cmms_entity_tag where entity_type=upper(trim(p_entity_type)) and entity_id=trim(p_entity_id) and tag_id=p_tag_id; end if; end $$;
revoke all on function public.rpc_cmms_mobile_last_parity_snapshot(integer), public.rpc_cmms_set_signature_requirement(text,boolean), public.rpc_cmms_sign_work_order(text,text,text,text), public.rpc_cmms_save_checklist_rule(uuid,boolean,text,uuid,text,text), public.rpc_cmms_save_asset_financial_profile(text,date,numeric,date,integer,numeric,text,date), public.rpc_cmms_create_tag(text,text), public.rpc_cmms_set_entity_tag(text,text,uuid,boolean) from public, anon;
grant execute on function public.rpc_cmms_mobile_last_parity_snapshot(integer), public.rpc_cmms_set_signature_requirement(text,boolean), public.rpc_cmms_sign_work_order(text,text,text,text), public.rpc_cmms_save_checklist_rule(uuid,boolean,text,uuid,text,text), public.rpc_cmms_save_asset_financial_profile(text,date,numeric,date,integer,numeric,text,date), public.rpc_cmms_create_tag(text,text), public.rpc_cmms_set_entity_tag(text,text,uuid,boolean) to authenticated;
