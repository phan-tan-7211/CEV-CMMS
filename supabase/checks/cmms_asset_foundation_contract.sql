-- Read-only contract checks for CMMS asset foundation + picker/filter RPCs.
-- Run after migrations 070 and 071.

begin;

do $$
declare
  missing text[] := array[]::text[];
  name text;
begin
  foreach name in array array[
    'cmms_location',
    'cmms_asset_category',
    'cmms_person',
    'cmms_team',
    'cmms_team_member',
    'cmms_business_party',
    'cmms_equipment_person_assignment',
    'cmms_equipment_team_assignment',
    'cmms_equipment_party_assignment'
  ] loop
    if to_regclass('public.' || name) is null then
      missing := array_append(missing, name);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'CMMS tables missing: %', array_to_string(missing, ', ');
  end if;
end $$;

do $$
begin
  if to_regclass('public.cmms_asset_filter_v') is null then
    raise exception 'cmms_asset_filter_v missing';
  end if;

  if to_regprocedure('public.cmms_location_tree_ids(uuid[])') is null then
    raise exception 'cmms_location_tree_ids(uuid[]) missing';
  end if;

  if to_regprocedure('public.rpc_cmms_location_picker(text,uuid,text,boolean,integer,integer)') is null then
    raise exception 'rpc_cmms_location_picker missing';
  end if;

  if to_regprocedure('public.rpc_cmms_people_picker(text,text[],boolean,text,integer,integer)') is null then
    raise exception 'rpc_cmms_people_picker missing';
  end if;

  if to_regprocedure('public.rpc_cmms_party_picker(text,text,boolean,text,integer,integer)') is null then
    raise exception 'rpc_cmms_party_picker missing';
  end if;

  if to_regprocedure('public.rpc_cmms_asset_filter(jsonb,text,integer,integer)') is null then
    raise exception 'rpc_cmms_asset_filter missing';
  end if;
end $$;

-- Public-schema tables must have RLS enabled.
do $$
declare
  bad text[];
begin
  select array_agg(c.relname order by c.relname)
  into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'cmms_location',
      'cmms_asset_category',
      'cmms_person',
      'cmms_team',
      'cmms_team_member',
      'cmms_business_party',
      'cmms_equipment_person_assignment',
      'cmms_equipment_team_assignment',
      'cmms_equipment_party_assignment'
    ])
    and not c.relrowsecurity;

  if coalesce(cardinality(bad), 0) > 0 then
    raise exception 'RLS disabled on: %', array_to_string(bad, ', ');
  end if;
end $$;

-- Confirm normalized links were added without removing legacy source_data support.
do $$
declare
  missing text[] := array[]::text[];
  col text;
begin
  foreach col in array array[
    'location_id',
    'asset_category_id',
    'parent_equipment_id',
    'primary_person_id',
    'archived_at',
    'created_by_user_id',
    'source_data'
  ] loop
    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'equipment_master'
        and column_name = col
    ) then
      missing := array_append(missing, col);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'equipment_master columns missing: %', array_to_string(missing, ', ');
  end if;
end $$;

rollback;
