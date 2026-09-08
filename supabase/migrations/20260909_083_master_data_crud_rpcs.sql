-- Master-data CRUD RPCs for Locations and Vendors/Customers.
-- Depends on 070-072. Mutations are restricted to MANAGER/ADMIN.

create or replace function public.rpc_cmms_upsert_location(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_id uuid;
  v_parent uuid;
  v_name text:=btrim(coalesce(p_input->>'name',''));
  v_row public.cmms_location%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MANAGER','ADMIN') then raise exception 'MASTER_DATA_ROLE_DENIED'; end if;
  if v_name='' then raise exception 'LOCATION_NAME_REQUIRED'; end if;

  v_id:=nullif(p_input->>'locationId','')::uuid;
  v_parent:=nullif(p_input->>'parentLocationId','')::uuid;
  if v_parent is not null and not exists(select 1 from public.cmms_location where location_id=v_parent and archived_at is null) then
    raise exception 'PARENT_LOCATION_NOT_FOUND';
  end if;

  if v_id is null then
    insert into public.cmms_location(parent_location_id,name,address,description,latitude,longitude,timezone,active,created_by)
    values(
      v_parent,v_name,nullif(btrim(coalesce(p_input->>'address','')),''),nullif(btrim(coalesce(p_input->>'description','')),''),
      nullif(p_input->>'latitude','')::double precision,nullif(p_input->>'longitude','')::double precision,
      nullif(btrim(coalesce(p_input->>'timezone','')),''),coalesce((p_input->>'active')::boolean,true),auth.uid()
    ) returning * into v_row;
  else
    if not exists(select 1 from public.cmms_location where location_id=v_id) then raise exception 'LOCATION_NOT_FOUND'; end if;
    if v_parent=v_id then raise exception 'LOCATION_PARENT_INVALID'; end if;
    if v_parent is not null and v_parent in (select location_id from public.cmms_location_tree_ids(array[v_id])) then
      raise exception 'LOCATION_CYCLE_INVALID';
    end if;
    update public.cmms_location set
      parent_location_id=v_parent,
      name=v_name,
      address=case when p_input ? 'address' then nullif(btrim(coalesce(p_input->>'address','')),'') else address end,
      description=case when p_input ? 'description' then nullif(btrim(coalesce(p_input->>'description','')),'') else description end,
      latitude=case when p_input ? 'latitude' then nullif(p_input->>'latitude','')::double precision else latitude end,
      longitude=case when p_input ? 'longitude' then nullif(p_input->>'longitude','')::double precision else longitude end,
      timezone=case when p_input ? 'timezone' then nullif(btrim(coalesce(p_input->>'timezone','')),'') else timezone end,
      active=coalesce((p_input->>'active')::boolean,active),updated_at=now()
    where location_id=v_id returning * into v_row;
  end if;
  return to_jsonb(v_row);
end $$;
revoke all on function public.rpc_cmms_upsert_location(jsonb) from public,anon;
grant execute on function public.rpc_cmms_upsert_location(jsonb) to authenticated;

create or replace function public.rpc_cmms_archive_location(p_location_id uuid,p_archived boolean default true)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.current_app_role() not in ('MANAGER','ADMIN') then raise exception 'MASTER_DATA_ROLE_DENIED'; end if;
  if p_archived and exists(select 1 from public.cmms_location where parent_location_id=p_location_id and archived_at is null) then raise exception 'LOCATION_HAS_ACTIVE_CHILDREN'; end if;
  update public.cmms_location set archived_at=case when p_archived then now() else null end,active=not p_archived,updated_at=now() where location_id=p_location_id;
  return found;
end $$;
revoke all on function public.rpc_cmms_archive_location(uuid,boolean) from public,anon;
grant execute on function public.rpc_cmms_archive_location(uuid,boolean) to authenticated;

create or replace function public.rpc_cmms_upsert_business_party(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_id uuid;
  v_kind text:=upper(btrim(coalesce(p_input->>'partyKind','')));
  v_name text:=btrim(coalesce(p_input->>'companyName',''));
  v_row public.cmms_business_party%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MANAGER','ADMIN') then raise exception 'MASTER_DATA_ROLE_DENIED'; end if;
  if v_kind not in ('VENDOR','CUSTOMER','BOTH') then raise exception 'PARTY_KIND_INVALID'; end if;
  if v_name='' then raise exception 'COMPANY_NAME_REQUIRED'; end if;
  v_id:=nullif(p_input->>'partyId','')::uuid;

  if v_id is null then
    insert into public.cmms_business_party(party_kind,company_name,contact_name,email,phone,address,website,tax_id,notes,active,source_data)
    values(v_kind,v_name,nullif(btrim(coalesce(p_input->>'contactName','')),''),nullif(btrim(coalesce(p_input->>'email','')),''),
      nullif(btrim(coalesce(p_input->>'phone','')),''),nullif(btrim(coalesce(p_input->>'address','')),''),nullif(btrim(coalesce(p_input->>'website','')),''),
      nullif(btrim(coalesce(p_input->>'taxId','')),''),nullif(btrim(coalesce(p_input->>'notes','')),''),coalesce((p_input->>'active')::boolean,true),coalesce(p_input->'sourceData','{}'::jsonb))
    returning * into v_row;
  else
    update public.cmms_business_party set
      party_kind=v_kind,company_name=v_name,
      contact_name=case when p_input ? 'contactName' then nullif(btrim(coalesce(p_input->>'contactName','')),'') else contact_name end,
      email=case when p_input ? 'email' then nullif(btrim(coalesce(p_input->>'email','')),'') else email end,
      phone=case when p_input ? 'phone' then nullif(btrim(coalesce(p_input->>'phone','')),'') else phone end,
      address=case when p_input ? 'address' then nullif(btrim(coalesce(p_input->>'address','')),'') else address end,
      website=case when p_input ? 'website' then nullif(btrim(coalesce(p_input->>'website','')),'') else website end,
      tax_id=case when p_input ? 'taxId' then nullif(btrim(coalesce(p_input->>'taxId','')),'') else tax_id end,
      notes=case when p_input ? 'notes' then nullif(btrim(coalesce(p_input->>'notes','')),'') else notes end,
      active=coalesce((p_input->>'active')::boolean,active),source_data=coalesce(p_input->'sourceData',source_data),updated_at=now()
    where party_id=v_id returning * into v_row;
    if not found then raise exception 'BUSINESS_PARTY_NOT_FOUND'; end if;
  end if;
  return to_jsonb(v_row);
end $$;
revoke all on function public.rpc_cmms_upsert_business_party(jsonb) from public,anon;
grant execute on function public.rpc_cmms_upsert_business_party(jsonb) to authenticated;

create or replace function public.rpc_cmms_archive_business_party(p_party_id uuid,p_archived boolean default true)
returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.current_app_role() not in ('MANAGER','ADMIN') then raise exception 'MASTER_DATA_ROLE_DENIED'; end if;
  update public.cmms_business_party set archived_at=case when p_archived then now() else null end,active=not p_archived,updated_at=now() where party_id=p_party_id;
  return found;
end $$;
revoke all on function public.rpc_cmms_archive_business_party(uuid,boolean) from public,anon;
grant execute on function public.rpc_cmms_archive_business_party(uuid,boolean) to authenticated;
