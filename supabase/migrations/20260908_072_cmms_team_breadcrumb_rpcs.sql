-- Additional picker helpers for Mobile/Web navigation.
-- Depends on migrations 070 and 071.

-- Breadcrumb from current location back to the root.
create or replace function public.rpc_cmms_location_breadcrumb(p_location_id uuid)
returns table(
  location_id uuid,
  parent_location_id uuid,
  name text,
  depth integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with recursive ancestors as (
    select
      l.location_id,
      l.parent_location_id,
      l.name,
      0 as reverse_depth
    from public.cmms_location l
    where l.location_id = p_location_id

    union all

    select
      p.location_id,
      p.parent_location_id,
      p.name,
      a.reverse_depth + 1
    from public.cmms_location p
    join ancestors a on a.parent_location_id = p.location_id
  )
  select
    a.location_id,
    a.parent_location_id,
    a.name,
    row_number() over(order by a.reverse_depth desc)::integer - 1 as depth
  from ancestors a
  order by a.reverse_depth desc
$$;

revoke all on function public.rpc_cmms_location_breadcrumb(uuid) from public, anon;
grant execute on function public.rpc_cmms_location_breadcrumb(uuid) to authenticated;

-- Team picker used by Assigned Teams filters and Work Order assignment screens.
create or replace function public.rpc_cmms_team_picker(
  p_search text default null,
  p_include_archived boolean default false,
  p_sort text default 'NAME_ASC',
  p_limit integer default 100,
  p_offset integer default 0
)
returns table(
  team_id uuid,
  name text,
  description text,
  active boolean,
  archived_at timestamptz,
  member_count bigint,
  lead_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      t.team_id,
      t.name,
      t.description,
      t.active,
      t.archived_at,
      (
        select count(*)
        from public.cmms_team_member tm
        join public.cmms_person p on p.person_id = tm.person_id
        where tm.team_id = t.team_id
          and p.archived_at is null
      ) as member_count,
      (
        select count(*)
        from public.cmms_team_member tm
        join public.cmms_person p on p.person_id = tm.person_id
        where tm.team_id = t.team_id
          and tm.member_role = 'LEAD'
          and p.archived_at is null
      ) as lead_count
    from public.cmms_team t
    where (p_include_archived or t.archived_at is null)
      and (
        nullif(btrim(coalesce(p_search, '')), '') is null
        or t.name ilike '%' || btrim(p_search) || '%'
        or coalesce(t.description, '') ilike '%' || btrim(p_search) || '%'
      )
  )
  select
    f.team_id,
    f.name,
    f.description,
    f.active,
    f.archived_at,
    f.member_count,
    f.lead_count,
    count(*) over() as total_count
  from filtered f
  order by
    case when upper(p_sort) = 'NAME_ASC' then lower(f.name) end asc nulls last,
    case when upper(p_sort) = 'NAME_DESC' then lower(f.name) end desc nulls last,
    case when upper(p_sort) = 'MEMBERS_ASC' then f.member_count end asc nulls last,
    case when upper(p_sort) = 'MEMBERS_DESC' then f.member_count end desc nulls last,
    lower(f.name) asc
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.rpc_cmms_team_picker(text,boolean,text,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_team_picker(text,boolean,text,integer,integer) to authenticated;

comment on function public.rpc_cmms_location_breadcrumb(uuid) is
'Returns root-to-current breadcrumb for hierarchical Location Picker drill-down.';
comment on function public.rpc_cmms_team_picker(text,boolean,text,integer,integer) is
'Team Picker API with search, member counts and pagination.';
