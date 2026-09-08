-- CMMS picker/filter read RPCs for UpKeep/Atlas-style Mobile/Web flows.
-- Depends on 20260908_070_cmms_asset_foundation.sql.
-- Read-only, additive, and security-invoker by default.

-- Expand one or more location roots to include every descendant.
create or replace function public.cmms_location_tree_ids(p_root_ids uuid[])
returns table(location_id uuid)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive tree as (
    select l.location_id
    from public.cmms_location l
    where l.location_id = any(coalesce(p_root_ids, array[]::uuid[]))

    union

    select child.location_id
    from public.cmms_location child
    join tree parent on child.parent_location_id = parent.location_id
  )
  select distinct tree.location_id from tree
$$;

revoke all on function public.cmms_location_tree_ids(uuid[]) from public, anon;
grant execute on function public.cmms_location_tree_ids(uuid[]) to authenticated;

-- Location Picker
-- Sort keys mirror the UpKeep behavior observed in the reference corpus.
create or replace function public.rpc_cmms_location_picker(
  p_search text default null,
  p_parent_location_id uuid default null,
  p_sort text default 'NAME_ASC',
  p_include_archived boolean default false,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  location_id uuid,
  parent_location_id uuid,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  active boolean,
  archived_at timestamptz,
  created_at timestamptz,
  child_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      l.location_id,
      l.parent_location_id,
      l.name,
      l.address,
      l.latitude,
      l.longitude,
      l.active,
      l.archived_at,
      l.created_at,
      (
        select count(*)
        from public.cmms_location child
        where child.parent_location_id = l.location_id
          and (p_include_archived or child.archived_at is null)
      ) as child_count
    from public.cmms_location l
    where l.parent_location_id is not distinct from p_parent_location_id
      and (p_include_archived or l.archived_at is null)
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or l.name ilike '%' || btrim(p_search) || '%'
        or coalesce(l.address, '') ilike '%' || btrim(p_search) || '%'
      )
  )
  select
    f.location_id,
    f.parent_location_id,
    f.name,
    f.address,
    f.latitude,
    f.longitude,
    f.active,
    f.archived_at,
    f.created_at,
    f.child_count,
    count(*) over() as total_count
  from filtered f
  order by
    case when upper(p_sort) = 'NAME_ASC' then lower(f.name) end asc nulls last,
    case when upper(p_sort) = 'NAME_DESC' then lower(f.name) end desc nulls last,
    case when upper(p_sort) = 'ADDRESS_ASC' then lower(coalesce(f.address, '')) end asc nulls last,
    case when upper(p_sort) = 'ADDRESS_DESC' then lower(coalesce(f.address, '')) end desc nulls last,
    case when upper(p_sort) = 'CREATED_ASC' then f.created_at end asc nulls last,
    case when upper(p_sort) = 'CREATED_DESC' then f.created_at end desc nulls last,
    lower(f.name) asc
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.rpc_cmms_location_picker(text,uuid,text,boolean,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_location_picker(text,uuid,text,boolean,integer,integer) to authenticated;

-- People Picker with UpKeep-compatible role filters.
create or replace function public.rpc_cmms_people_picker(
  p_search text default null,
  p_role_codes text[] default null,
  p_include_archived boolean default false,
  p_sort text default 'NAME_ASC',
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  person_id uuid,
  display_name text,
  email text,
  phone text,
  job_title text,
  role_code text,
  active boolean,
  archived_at timestamptz,
  team_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      p.person_id,
      p.display_name,
      p.email,
      p.phone,
      p.job_title,
      p.role_code,
      p.active,
      p.archived_at,
      (
        select count(*)
        from public.cmms_team_member tm
        join public.cmms_team t on t.team_id = tm.team_id
        where tm.person_id = p.person_id
          and t.archived_at is null
      ) as team_count
    from public.cmms_person p
    where (p_include_archived or p.archived_at is null)
      and (
        coalesce(cardinality(p_role_codes), 0) = 0
        or p.role_code = any(p_role_codes)
      )
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or p.display_name ilike '%' || btrim(p_search) || '%'
        or coalesce(p.email, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(p.job_title, '') ilike '%' || btrim(p_search) || '%'
      )
  )
  select
    f.person_id,
    f.display_name,
    f.email,
    f.phone,
    f.job_title,
    f.role_code,
    f.active,
    f.archived_at,
    f.team_count,
    count(*) over() as total_count
  from filtered f
  order by
    case when upper(p_sort) = 'NAME_ASC' then lower(f.display_name) end asc nulls last,
    case when upper(p_sort) = 'NAME_DESC' then lower(f.display_name) end desc nulls last,
    case when upper(p_sort) = 'ROLE_ASC' then f.role_code end asc nulls last,
    case when upper(p_sort) = 'ROLE_DESC' then f.role_code end desc nulls last,
    lower(f.display_name) asc
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.rpc_cmms_people_picker(text,text[],boolean,text,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_people_picker(text,text[],boolean,text,integer,integer) to authenticated;

-- Vendor/Customer Picker. p_kind accepts VENDOR, CUSTOMER or ALL.
-- BOTH records participate in both vendor and customer pickers.
create or replace function public.rpc_cmms_party_picker(
  p_kind text default 'ALL',
  p_search text default null,
  p_include_archived boolean default false,
  p_sort text default 'NAME_ASC',
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  party_id uuid,
  party_kind text,
  company_name text,
  contact_name text,
  email text,
  phone text,
  address text,
  website text,
  active boolean,
  archived_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select b.*
    from public.cmms_business_party b
    where (p_include_archived or b.archived_at is null)
      and (
        upper(coalesce(p_kind, 'ALL')) = 'ALL'
        or (upper(p_kind) = 'VENDOR' and b.party_kind in ('VENDOR','BOTH'))
        or (upper(p_kind) = 'CUSTOMER' and b.party_kind in ('CUSTOMER','BOTH'))
      )
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or b.company_name ilike '%' || btrim(p_search) || '%'
        or coalesce(b.contact_name, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(b.address, '') ilike '%' || btrim(p_search) || '%'
        or coalesce(b.email, '') ilike '%' || btrim(p_search) || '%'
      )
  )
  select
    f.party_id,
    f.party_kind,
    f.company_name,
    f.contact_name,
    f.email,
    f.phone,
    f.address,
    f.website,
    f.active,
    f.archived_at,
    count(*) over() as total_count
  from filtered f
  order by
    case when upper(p_sort) = 'NAME_ASC' then lower(f.company_name) end asc nulls last,
    case when upper(p_sort) = 'NAME_DESC' then lower(f.company_name) end desc nulls last,
    case when upper(p_sort) = 'ADDRESS_ASC' then lower(coalesce(f.address, '')) end asc nulls last,
    case when upper(p_sort) = 'ADDRESS_DESC' then lower(coalesce(f.address, '')) end desc nulls last,
    lower(f.company_name) asc
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.rpc_cmms_party_picker(text,text,boolean,text,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_party_picker(text,text,boolean,text,integer,integer) to authenticated;

-- Asset filter RPC
-- p_filters supported keys:
-- assetName, assetModel, assetBarcode, assetArea, assetCategory
-- archivedMode: ALL | ARCHIVED | UNARCHIVED
-- createdByYou: boolean
-- locationIds: uuid[] JSON array
-- includeLocationDescendants: boolean
-- primaryUserIds, assignedUserIds, assignedTeamIds, assignedVendorIds, assignedCustomerIds: JSON arrays
-- createdStart, createdEnd: ISO date/timestamp strings
create or replace function public.rpc_cmms_asset_filter(
  p_filters jsonb default '{}'::jsonb,
  p_sort text default 'NAME_ASC',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table(
  equipment_id text,
  asset_name text,
  asset_model text,
  asset_barcode text,
  asset_area text,
  asset_category text,
  location_id uuid,
  location_name text,
  primary_person_id uuid,
  primary_user_name text,
  status text,
  active boolean,
  archived_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      nullif(btrim(p_filters->>'assetName'), '') as asset_name,
      nullif(btrim(p_filters->>'assetModel'), '') as asset_model,
      nullif(btrim(p_filters->>'assetBarcode'), '') as asset_barcode,
      nullif(btrim(p_filters->>'assetArea'), '') as asset_area,
      nullif(btrim(p_filters->>'assetCategory'), '') as asset_category,
      upper(coalesce(nullif(btrim(p_filters->>'archivedMode'), ''), 'UNARCHIVED')) as archived_mode,
      coalesce((p_filters->>'createdByYou')::boolean, false) as created_by_you,
      coalesce((p_filters->>'includeLocationDescendants')::boolean, false) as include_location_descendants,
      nullif(p_filters->>'createdStart', '')::timestamptz as created_start,
      nullif(p_filters->>'createdEnd', '')::timestamptz as created_end,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filters->'locationIds', '[]'::jsonb))::uuid), array[]::uuid[]) as location_ids,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filters->'primaryUserIds', '[]'::jsonb))::uuid), array[]::uuid[]) as primary_user_ids,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filters->'assignedUserIds', '[]'::jsonb))::uuid), array[]::uuid[]) as assigned_user_ids,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filters->'assignedTeamIds', '[]'::jsonb))::uuid), array[]::uuid[]) as assigned_team_ids,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filters->'assignedVendorIds', '[]'::jsonb))::uuid), array[]::uuid[]) as assigned_vendor_ids,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_filters->'assignedCustomerIds', '[]'::jsonb))::uuid), array[]::uuid[]) as assigned_customer_ids
  ),
  filtered as (
    select
      v.equipment_id,
      v.asset_name,
      v.asset_model,
      v.asset_barcode,
      v.asset_area,
      v.asset_category,
      v.location_id,
      l.name as location_name,
      v.primary_person_id,
      v.primary_user_name,
      v.status,
      v.active,
      v.archived_at,
      v.created_at
    from public.cmms_asset_filter_v v
    left join public.cmms_location l on l.location_id = v.location_id
    cross join params x
    where
      (x.asset_name is null or coalesce(v.asset_name, '') ilike '%' || x.asset_name || '%')
      and (x.asset_model is null or coalesce(v.asset_model, '') ilike '%' || x.asset_model || '%')
      and (x.asset_barcode is null or coalesce(v.asset_barcode, '') ilike '%' || x.asset_barcode || '%')
      and (x.asset_area is null or coalesce(v.asset_area, '') ilike '%' || x.asset_area || '%')
      and (x.asset_category is null or coalesce(v.asset_category, '') ilike '%' || x.asset_category || '%')
      and (
        x.archived_mode = 'ALL'
        or (x.archived_mode = 'ARCHIVED' and v.archived_at is not null)
        or (x.archived_mode = 'UNARCHIVED' and v.archived_at is null)
      )
      and (not x.created_by_you or v.created_by_user_id = auth.uid())
      and (x.created_start is null or v.created_at >= x.created_start)
      and (x.created_end is null or v.created_at <= x.created_end)
      and (
        cardinality(x.location_ids) = 0
        or (not x.include_location_descendants and v.location_id = any(x.location_ids))
        or (
          x.include_location_descendants
          and v.location_id in (select t.location_id from public.cmms_location_tree_ids(x.location_ids) t)
        )
      )
      and (cardinality(x.primary_user_ids) = 0 or v.primary_person_id = any(x.primary_user_ids))
      and (
        cardinality(x.assigned_user_ids) = 0
        or exists (
          select 1 from public.cmms_equipment_person_assignment a
          where a.equipment_id = v.equipment_id
            and a.person_id = any(x.assigned_user_ids)
            and a.assignment_role in ('ASSIGNED_USER','RESPONSIBLE','PRIMARY_USER')
        )
      )
      and (
        cardinality(x.assigned_team_ids) = 0
        or exists (
          select 1 from public.cmms_equipment_team_assignment a
          where a.equipment_id = v.equipment_id
            and a.team_id = any(x.assigned_team_ids)
        )
      )
      and (
        cardinality(x.assigned_vendor_ids) = 0
        or exists (
          select 1 from public.cmms_equipment_party_assignment a
          where a.equipment_id = v.equipment_id
            and a.party_id = any(x.assigned_vendor_ids)
            and a.assignment_role in ('ASSIGNED_VENDOR','SERVICE_VENDOR','MANUFACTURER_VENDOR','DISTRIBUTOR_VENDOR')
        )
      )
      and (
        cardinality(x.assigned_customer_ids) = 0
        or exists (
          select 1 from public.cmms_equipment_party_assignment a
          where a.equipment_id = v.equipment_id
            and a.party_id = any(x.assigned_customer_ids)
            and a.assignment_role in ('ASSIGNED_CUSTOMER','OWNER_CUSTOMER')
        )
      )
  )
  select
    f.equipment_id,
    f.asset_name,
    f.asset_model,
    f.asset_barcode,
    f.asset_area,
    f.asset_category,
    f.location_id,
    f.location_name,
    f.primary_person_id,
    f.primary_user_name,
    f.status,
    f.active,
    f.archived_at,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by
    case when upper(p_sort) = 'NAME_ASC' then lower(coalesce(f.asset_name, '')) end asc nulls last,
    case when upper(p_sort) = 'NAME_DESC' then lower(coalesce(f.asset_name, '')) end desc nulls last,
    case when upper(p_sort) = 'CREATED_ASC' then f.created_at end asc nulls last,
    case when upper(p_sort) = 'CREATED_DESC' then f.created_at end desc nulls last,
    case when upper(p_sort) = 'BARCODE_ASC' then lower(coalesce(f.asset_barcode, '')) end asc nulls last,
    case when upper(p_sort) = 'BARCODE_DESC' then lower(coalesce(f.asset_barcode, '')) end desc nulls last,
    lower(coalesce(f.asset_name, f.equipment_id)) asc,
    f.equipment_id asc
  limit greatest(1, least(coalesce(p_limit, 50), 500))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.rpc_cmms_asset_filter(jsonb,text,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_asset_filter(jsonb,text,integer,integer) to authenticated;

comment on function public.rpc_cmms_location_picker(text,uuid,text,boolean,integer,integer) is
'Location Picker API: search, direct-child browsing, map coordinates and UpKeep-compatible sorting.';
comment on function public.rpc_cmms_people_picker(text,text[],boolean,text,integer,integer) is
'People Picker API: search and filter by Administrator/Technician/Technician Limited/Requester/View Only roles.';
comment on function public.rpc_cmms_party_picker(text,text,boolean,text,integer,integer) is
'Vendor/Customer Picker API. BOTH business parties appear in both picker modes.';
comment on function public.rpc_cmms_asset_filter(jsonb,text,integer,integer) is
'Asset Filter API supporting UpKeep fields plus hierarchical location filtering and pagination metadata.';
