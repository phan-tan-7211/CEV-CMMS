-- CMMS foundation for UpKeep/Atlas-class asset browsing and filtering.
-- Additive only: existing equipment RPCs and source_data payloads remain compatible.
-- Normalized master data can be adopted incrementally by Web/Mobile without UI changes.

create table if not exists public.cmms_location (
  location_id uuid primary key default gen_random_uuid(),
  parent_location_id uuid references public.cmms_location(location_id) on delete restrict,
  name text not null,
  address text,
  description text,
  latitude double precision,
  longitude double precision,
  timezone text,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_location_name_not_blank check (btrim(name) <> ''),
  constraint cmms_location_latitude_valid check (latitude is null or latitude between -90 and 90),
  constraint cmms_location_longitude_valid check (longitude is null or longitude between -180 and 180),
  constraint cmms_location_not_self_parent check (parent_location_id is null or parent_location_id <> location_id)
);

create table if not exists public.cmms_asset_category (
  asset_category_id uuid primary key default gen_random_uuid(),
  parent_category_id uuid references public.cmms_asset_category(asset_category_id) on delete restrict,
  name text not null,
  description text,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_asset_category_name_not_blank check (btrim(name) <> ''),
  constraint cmms_asset_category_not_self_parent check (parent_category_id is null or parent_category_id <> asset_category_id)
);

create table if not exists public.cmms_person (
  person_id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  phone text,
  job_title text,
  role_code text not null default 'TECHNICIAN',
  active boolean not null default true,
  archived_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_person_display_name_not_blank check (btrim(display_name) <> ''),
  constraint cmms_person_role_code_valid check (role_code in ('ADMINISTRATOR','TECHNICIAN','TECHNICIAN_LIMITED','REQUESTER','VIEW_ONLY'))
);

create unique index if not exists cmms_person_email_unique_ci
  on public.cmms_person (lower(email)) where email is not null and archived_at is null;

create table if not exists public.cmms_team (
  team_id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_team_name_not_blank check (btrim(name) <> '')
);

create table if not exists public.cmms_team_member (
  team_id uuid not null references public.cmms_team(team_id) on delete cascade,
  person_id uuid not null references public.cmms_person(person_id) on delete cascade,
  member_role text not null default 'MEMBER',
  created_at timestamptz not null default now(),
  primary key (team_id, person_id),
  constraint cmms_team_member_role_valid check (member_role in ('LEAD','MEMBER'))
);

create table if not exists public.cmms_business_party (
  party_id uuid primary key default gen_random_uuid(),
  party_kind text not null,
  company_name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  website text,
  tax_id text,
  notes text,
  active boolean not null default true,
  archived_at timestamptz,
  source_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_business_party_kind_valid check (party_kind in ('VENDOR','CUSTOMER','BOTH')),
  constraint cmms_business_party_company_name_not_blank check (btrim(company_name) <> '')
);

create index if not exists cmms_location_parent_idx on public.cmms_location(parent_location_id, name);
create index if not exists cmms_location_name_idx on public.cmms_location(lower(name));
create index if not exists cmms_location_address_idx on public.cmms_location(lower(address));
create index if not exists cmms_location_created_idx on public.cmms_location(created_at);
create index if not exists cmms_asset_category_parent_idx on public.cmms_asset_category(parent_category_id, name);
create index if not exists cmms_person_role_idx on public.cmms_person(role_code, active);
create index if not exists cmms_team_name_idx on public.cmms_team(lower(name));
create index if not exists cmms_business_party_kind_name_idx on public.cmms_business_party(party_kind, lower(company_name));

alter table public.equipment_master
  add column if not exists location_id uuid references public.cmms_location(location_id) on delete set null,
  add column if not exists asset_category_id uuid references public.cmms_asset_category(asset_category_id) on delete set null,
  add column if not exists parent_equipment_id text references public.equipment_master(equipment_id) on delete set null,
  add column if not exists primary_person_id uuid references public.cmms_person(person_id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists created_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists equipment_master_location_idx on public.equipment_master(location_id, active);
create index if not exists equipment_master_category_idx on public.equipment_master(asset_category_id, active);
create index if not exists equipment_master_parent_idx on public.equipment_master(parent_equipment_id);
create index if not exists equipment_master_primary_person_idx on public.equipment_master(primary_person_id);
create index if not exists equipment_master_created_at_idx on public.equipment_master(created_at);
create index if not exists equipment_master_archived_at_idx on public.equipment_master(archived_at);

create table if not exists public.cmms_equipment_person_assignment (
  equipment_id text not null references public.equipment_master(equipment_id) on delete cascade,
  person_id uuid not null references public.cmms_person(person_id) on delete cascade,
  assignment_role text not null default 'ASSIGNED_USER',
  created_at timestamptz not null default now(),
  primary key (equipment_id, person_id, assignment_role),
  constraint cmms_equipment_person_role_valid check (assignment_role in ('PRIMARY_USER','ASSIGNED_USER','RESPONSIBLE','WATCHER'))
);

create table if not exists public.cmms_equipment_team_assignment (
  equipment_id text not null references public.equipment_master(equipment_id) on delete cascade,
  team_id uuid not null references public.cmms_team(team_id) on delete cascade,
  assignment_role text not null default 'ASSIGNED_TEAM',
  created_at timestamptz not null default now(),
  primary key (equipment_id, team_id, assignment_role),
  constraint cmms_equipment_team_role_valid check (assignment_role in ('ASSIGNED_TEAM','RESPONSIBLE_TEAM','WATCHER_TEAM'))
);

create table if not exists public.cmms_equipment_party_assignment (
  equipment_id text not null references public.equipment_master(equipment_id) on delete cascade,
  party_id uuid not null references public.cmms_business_party(party_id) on delete cascade,
  assignment_role text not null,
  created_at timestamptz not null default now(),
  primary key (equipment_id, party_id, assignment_role),
  constraint cmms_equipment_party_role_valid check (assignment_role in ('ASSIGNED_VENDOR','SERVICE_VENDOR','MANUFACTURER_VENDOR','DISTRIBUTOR_VENDOR','ASSIGNED_CUSTOMER','OWNER_CUSTOMER'))
);

create index if not exists cmms_equipment_person_person_idx on public.cmms_equipment_person_assignment(person_id, assignment_role);
create index if not exists cmms_equipment_team_team_idx on public.cmms_equipment_team_assignment(team_id, assignment_role);
create index if not exists cmms_equipment_party_party_idx on public.cmms_equipment_party_assignment(party_id, assignment_role);

-- RLS: these are public-schema Data API tables, so every new table is protected.
do $$
declare
  t text;
begin
  foreach t in array array[
    'cmms_location','cmms_asset_category','cmms_person','cmms_team','cmms_team_member',
    'cmms_business_party','cmms_equipment_person_assignment','cmms_equipment_team_assignment',
    'cmms_equipment_party_assignment'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_authenticated())',
      t || '_read', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_app_role() in (''MANAGER'',''ADMIN'')) with check (public.current_app_role() in (''MANAGER'',''ADMIN''))',
      t || '_manage', t
    );
  end loop;
end $$;

-- Keep primary_person_id and the PRIMARY_USER assignment compatible during gradual adoption.
create or replace function public.cmms_sync_equipment_primary_person()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.primary_person_id is distinct from old.primary_person_id then
    delete from public.cmms_equipment_person_assignment
    where equipment_id = new.equipment_id and assignment_role = 'PRIMARY_USER';

    if new.primary_person_id is not null then
      insert into public.cmms_equipment_person_assignment(equipment_id, person_id, assignment_role)
      values(new.equipment_id, new.primary_person_id, 'PRIMARY_USER')
      on conflict do nothing;
    end if;
  end if;
  return new;
end $$;

revoke all on function public.cmms_sync_equipment_primary_person() from public, anon;

drop trigger if exists trg_cmms_sync_equipment_primary_person on public.equipment_master;
create trigger trg_cmms_sync_equipment_primary_person
after update of primary_person_id on public.equipment_master
for each row execute function public.cmms_sync_equipment_primary_person();

-- Search/filter projection for Mobile/Web. security_invoker preserves equipment_master RLS.
create or replace view public.cmms_asset_filter_v
with (security_invoker = true)
as
select
  e.equipment_id,
  e.equipment_name as asset_name,
  e.model as asset_model,
  e.qr_code as asset_barcode,
  coalesce(l.name, e.source_data->>'currentArea') as asset_area,
  coalesce(c.name, e.source_data->>'equipmentCategory') as asset_category,
  e.location_id,
  e.asset_category_id,
  e.primary_person_id,
  p.display_name as primary_user_name,
  e.status,
  e.active,
  e.archived_at,
  e.created_by_user_id,
  e.created_at,
  e.updated_at
from public.equipment_master e
left join public.cmms_location l on l.location_id = e.location_id
left join public.cmms_asset_category c on c.asset_category_id = e.asset_category_id
left join public.cmms_person p on p.person_id = e.primary_person_id;

revoke all on public.cmms_asset_filter_v from anon;
grant select on public.cmms_asset_filter_v to authenticated;

comment on view public.cmms_asset_filter_v is
'Normalized source for UpKeep-style asset filters: name, model, barcode, area, category, archive state, creator, location and primary user. Assignment filters use cmms_equipment_*_assignment tables.';
