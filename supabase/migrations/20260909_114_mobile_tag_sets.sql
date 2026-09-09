create table if not exists public.cmms_tag_set (
  set_id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create unique index if not exists cmms_tag_set_name_unique on public.cmms_tag_set(lower(name)) where active;
create table if not exists public.cmms_tag_set_member (
  set_id uuid not null references public.cmms_tag_set(set_id) on delete cascade,
  tag_id uuid not null references public.cmms_tag(tag_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(set_id,tag_id)
);
alter table public.cmms_tag_set enable row level security;
alter table public.cmms_tag_set_member enable row level security;
revoke all on public.cmms_tag_set,public.cmms_tag_set_member from anon,authenticated;

create or replace function public.rpc_cmms_create_tag_set(p_name text,p_description text default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'TAG_SET_NAME_REQUIRED'; end if;
 insert into public.cmms_tag_set(name,description,created_by) values(trim(p_name),nullif(trim(p_description),''),auth.uid()) returning set_id into v_id;
 return v_id;
exception when unique_violation then select set_id into v_id from public.cmms_tag_set where active and lower(name)=lower(trim(p_name)) limit 1; return v_id; end $$;
create or replace function public.rpc_cmms_set_tag_set_member(p_set_id uuid,p_tag_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 if coalesce(p_enabled,true) then insert into public.cmms_tag_set_member(set_id,tag_id) values(p_set_id,p_tag_id) on conflict do nothing;
 else delete from public.cmms_tag_set_member where set_id=p_set_id and tag_id=p_tag_id; end if;
end $$;

create or replace function public.rpc_cmms_mobile_last_parity_snapshot(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'workOrders', coalesce((select jsonb_agg(jsonb_build_object('id',w.work_order_id,'status',w.status,'reason',w.reason,'equipmentId',w.equipment_id,'signatureRequired',coalesce(r.required,false),'signatures',coalesce((select jsonb_agg(jsonb_build_object('id',s.signature_id,'name',s.signer_name,'role',s.signer_role,'text',s.signature_text,'signedAt',s.signed_at) order by s.signed_at desc) from public.cmms_work_order_signature s where s.work_order_id=w.work_order_id),'[]'::jsonb))) from (select * from public.maintenance_work_order order by created_at desc limit greatest(1,least(coalesce(p_limit,100),300))) w left join public.cmms_work_order_signature_requirement r on r.work_order_id=w.work_order_id),'[]'::jsonb),
    'equipment', coalesce((select jsonb_agg(jsonb_build_object('id',e.equipment_id,'name',e.equipment_name,'profile',case when f.equipment_id is null then null else jsonb_build_object('purchaseDate',f.purchase_date,'purchaseCost',f.purchase_cost,'warrantyExpiry',f.warranty_expiry,'usefulLifeMonths',f.useful_life_months,'salvageValue',f.salvage_value,'depreciationMethod',f.depreciation_method,'replacementTargetDate',f.replacement_target_date) end)) from (select * from public.equipment_master where active=true order by equipment_name limit greatest(1,least(coalesce(p_limit,100),300))) e left join public.cmms_asset_financial_profile f on f.equipment_id=e.equipment_id),'[]'::jsonb),
    'tags', coalesce((select jsonb_agg(jsonb_build_object('id',t.tag_id,'name',t.name,'color',t.color,'usageCount',(select count(*) from public.cmms_entity_tag et where et.tag_id=t.tag_id)) order by t.name) from public.cmms_tag t where t.active),'[]'::jsonb),
    'tagSets', coalesce((select jsonb_agg(jsonb_build_object('id',s.set_id,'name',s.name,'description',s.description,'tagIds',coalesce((select jsonb_agg(m.tag_id) from public.cmms_tag_set_member m where m.set_id=s.set_id),'[]'::jsonb)) order by s.name) from public.cmms_tag_set s where s.active),'[]'::jsonb),
    'checklistRules', coalesce((select jsonb_agg(jsonb_build_object('templateItemId',i.template_item_id,'templateId',i.template_id,'label',i.label,'locked',coalesce(r.locked,false),'restrictedRole',r.restricted_role,'conditionItemId',r.condition_item_id,'conditionOperator',r.condition_operator,'conditionValue',r.condition_value) order by i.template_id,i.sequence_no) from public.cmms_checklist_template_item i left join public.cmms_checklist_template_rule r on r.template_item_id=i.template_item_id),'[]'::jsonb),
    'entityTags', coalesce((select jsonb_agg(jsonb_build_object('entityType',et.entity_type,'entityId',et.entity_id,'tagId',et.tag_id)) from public.cmms_entity_tag et),'[]'::jsonb)
  );
end $$;
revoke all on function public.rpc_cmms_create_tag_set(text,text),public.rpc_cmms_set_tag_set_member(uuid,uuid,boolean) from public,anon;
grant execute on function public.rpc_cmms_create_tag_set(text,text),public.rpc_cmms_set_tag_set_member(uuid,uuid,boolean) to authenticated;
