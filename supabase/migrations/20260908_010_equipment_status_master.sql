create table if not exists public.equipment_status_master (
  status_code text primary key,
  display_name text not null,
  color text not null default '#667085',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint equipment_status_master_name_nonempty check (length(trim(display_name)) > 0),
  constraint equipment_status_master_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$')
);

insert into public.equipment_status_master(status_code, display_name, color, sort_order)
values
  ('RUNNING','Hoạt động','#12B76A',10),
  ('DOWN','Không hoạt động','#D92D20',20),
  ('MAINTENANCE','Bảo trì','#F79009',30),
  ('STOPPED','Dừng','#667085',40),
  ('DISPOSED','Thanh lý','#7F56D9',50)
on conflict (status_code) do nothing;

insert into public.equipment_status_master(status_code, display_name, color, sort_order)
select distinct upper(trim(em.status)),
  case upper(trim(em.status))
    when 'RUNNING' then 'Hoạt động'
    when 'DOWN' then 'Không hoạt động'
    when 'MAINTENANCE' then 'Bảo trì'
    when 'STOPPED' then 'Dừng'
    when 'DISPOSED' then 'Thanh lý'
    else replace(initcap(lower(trim(em.status))), '_', ' ')
  end,
  '#667085', 100
from public.equipment_master em
where nullif(trim(em.status),'') is not null
on conflict (status_code) do nothing;

alter table public.equipment_status_master enable row level security;
drop policy if exists equipment_status_master_authenticated_select on public.equipment_status_master;
create policy equipment_status_master_authenticated_select on public.equipment_status_master for select to authenticated using (true);

create or replace function public.rpc_list_equipment_status_master()
returns table(status_code text, display_name text, color text, sort_order integer, usage_count bigint, locked boolean)
language sql security definer set search_path = public as $$
  select s.status_code,s.display_name,s.color,s.sort_order,count(e.equipment_id)::bigint,(count(e.equipment_id)>0)
  from public.equipment_status_master s
  left join public.equipment_master e on upper(trim(e.status))=s.status_code and e.active=true
  where auth.uid() is not null
  group by s.status_code,s.display_name,s.color,s.sort_order
  order by s.sort_order,s.display_name;
$$;
grant execute on function public.rpc_list_equipment_status_master() to authenticated;

create or replace function public.rpc_create_equipment_status(p_display_name text, p_color text default '#667085')
returns public.equipment_status_master
language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_name text; v_color text; v_code text; v_row public.equipment_status_master;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'STATUS_CONFIG_ROLE_DENIED'; end if;
  v_name:=trim(regexp_replace(coalesce(p_display_name,''),'\s+',' ','g'));
  if v_name='' then raise exception 'STATUS_NAME_REQUIRED'; end if;
  v_color:=upper(trim(coalesce(p_color,'#667085')));
  if v_color !~ '^#[0-9A-F]{6}$' then raise exception 'STATUS_COLOR_INVALID'; end if;
  if exists(select 1 from public.equipment_status_master where lower(display_name)=lower(v_name)) then raise exception 'STATUS_NAME_EXISTS'; end if;
  v_code:='CUSTOM_'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.equipment_status_master(status_code,display_name,color,sort_order,created_by,updated_by)
  values(v_code,v_name,v_color,coalesce((select max(sort_order)+10 from public.equipment_status_master),100),coalesce(auth.jwt()->>'email',auth.uid()::text),coalesce(auth.jwt()->>'email',auth.uid()::text)) returning * into v_row;
  return v_row;
end $$;
grant execute on function public.rpc_create_equipment_status(text,text) to authenticated;

create or replace function public.rpc_update_equipment_status_master(p_status_code text,p_display_name text,p_color text)
returns public.equipment_status_master
language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_code text:=upper(trim(coalesce(p_status_code,''))); v_name text; v_color text; v_usage bigint; v_row public.equipment_status_master;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'STATUS_CONFIG_ROLE_DENIED'; end if;
  select count(*) into v_usage from public.equipment_master where active=true and upper(trim(status))=v_code;
  if v_usage>0 then raise exception 'STATUS_IN_USE_LOCKED'; end if;
  v_name:=trim(regexp_replace(coalesce(p_display_name,''),'\s+',' ','g'));
  if v_name='' then raise exception 'STATUS_NAME_REQUIRED'; end if;
  v_color:=upper(trim(coalesce(p_color,'')));
  if v_color !~ '^#[0-9A-F]{6}$' then raise exception 'STATUS_COLOR_INVALID'; end if;
  if exists(select 1 from public.equipment_status_master where status_code<>v_code and lower(display_name)=lower(v_name)) then raise exception 'STATUS_NAME_EXISTS'; end if;
  update public.equipment_status_master set display_name=v_name,color=v_color,updated_at=now(),updated_by=coalesce(auth.jwt()->>'email',auth.uid()::text) where status_code=v_code returning * into v_row;
  if v_row.status_code is null then raise exception 'STATUS_NOT_FOUND'; end if;
  return v_row;
end $$;
grant execute on function public.rpc_update_equipment_status_master(text,text,text) to authenticated;

create or replace function public.rpc_delete_equipment_status_master(p_status_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_code text:=upper(trim(coalesce(p_status_code,''))); v_usage bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'STATUS_CONFIG_ROLE_DENIED'; end if;
  select count(*) into v_usage from public.equipment_master where active=true and upper(trim(status))=v_code;
  if v_usage>0 then raise exception 'STATUS_IN_USE_LOCKED'; end if;
  delete from public.equipment_status_master where status_code=v_code;
  if not found then raise exception 'STATUS_NOT_FOUND'; end if;
end $$;
grant execute on function public.rpc_delete_equipment_status_master(text) to authenticated;

create or replace function public.rpc_set_equipment_status(p_equipment_id text,p_status_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role public.app_role; v_id text:=trim(coalesce(p_equipment_id,'')); v_code text:=upper(trim(coalesce(p_status_code,'')));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','MANAGER','ADMIN') then raise exception 'EQUIPMENT_STATUS_ROLE_DENIED'; end if;
  if not exists(select 1 from public.equipment_status_master where status_code=v_code) then raise exception 'STATUS_NOT_FOUND'; end if;
  update public.equipment_master set status=v_code,updated_at=now() where equipment_id=v_id;
  if not found then raise exception 'EQUIPMENT_NOT_FOUND'; end if;
  return jsonb_build_object('equipmentId',v_id,'status',v_code);
end $$;
grant execute on function public.rpc_set_equipment_status(text,text) to authenticated;

create or replace function public.enforce_equipment_status_master()
returns trigger language plpgsql set search_path = public as $$
begin
  new.status:=upper(trim(coalesce(new.status,'')));
  if new.status='' or not exists(select 1 from public.equipment_status_master where status_code=new.status) then raise exception 'STATUS_NOT_IN_MASTER'; end if;
  return new;
end $$;
drop trigger if exists trg_equipment_status_master on public.equipment_master;
create trigger trg_equipment_status_master before insert or update of status on public.equipment_master for each row execute function public.enforce_equipment_status_master();
