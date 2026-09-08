-- Batch 5: minimal Request Portal contract for QR-originated requests.
create table if not exists public.request_portal_settings (
  settings_id text primary key,
  enabled boolean not null default false,
  can_create_work_order boolean not null default false,
  can_create_request boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.request_portal_settings(settings_id, enabled, can_create_work_order, can_create_request)
values ('DEFAULT', false, false, true)
on conflict (settings_id) do nothing;

create table if not exists public.maintenance_request (
  request_id text primary key,
  equipment_id text not null references public.equipment_master(equipment_id),
  reason text not null,
  status text not null default 'OPEN',
  source_type text not null default 'REQUEST_PORTAL',
  source_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maintenance_request_equipment_idx on public.maintenance_request(equipment_id, status, created_at desc);
alter table public.request_portal_settings enable row level security;
alter table public.maintenance_request enable row level security;
drop policy if exists request_portal_settings_read on public.request_portal_settings;
create policy request_portal_settings_read on public.request_portal_settings for select to authenticated using (auth.uid() is not null);
drop policy if exists maintenance_request_read on public.maintenance_request;
create policy maintenance_request_read on public.maintenance_request for select to authenticated using (auth.uid() is not null);

create or replace function public.rpc_create_maintenance_request(p_equipment_id text, p_reason text, p_source_id text default '')
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text; v_actor text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.equipment_master where equipment_id=trim(p_equipment_id) and active=true) then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  if trim(coalesce(p_reason,''))='' then raise exception 'REQUEST_REASON_REQUIRED'; end if;
  v_actor:=coalesce(auth.jwt()->>'email',auth.uid()::text);
  v_id:='REQ-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  insert into public.maintenance_request(request_id,equipment_id,reason,status,source_type,source_id,created_by) values(v_id,trim(p_equipment_id),trim(p_reason),'OPEN','REQUEST_PORTAL',nullif(trim(p_source_id),''),v_actor);
  return jsonb_build_object('requestId',v_id,'equipmentId',trim(p_equipment_id),'status','OPEN');
end $$;
revoke all on function public.rpc_create_maintenance_request(text,text,text) from public, anon;
grant execute on function public.rpc_create_maintenance_request(text,text,text) to authenticated;
