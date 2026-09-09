-- Work Order timer + server draft foundation for UpKeep-style execution parity.

create table if not exists public.cmms_work_order_timer (
  timer_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  person_id uuid not null references public.cmms_person(person_id) on delete restrict,
  status text not null default 'RUNNING',
  started_at timestamptz not null default now(),
  running_since timestamptz,
  accumulated_seconds integer not null default 0,
  paused_at timestamptz,
  stopped_at timestamptz,
  hourly_rate numeric,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_work_order_timer_status_valid check (status in ('RUNNING','PAUSED','STOPPED','CANCELLED')),
  constraint cmms_work_order_timer_seconds_valid check (accumulated_seconds >= 0),
  constraint cmms_work_order_timer_rate_valid check (hourly_rate is null or hourly_rate >= 0),
  constraint cmms_work_order_timer_running_state_valid check (
    (status='RUNNING' and running_since is not null)
    or (status<>'RUNNING' and running_since is null)
  )
);

create unique index if not exists cmms_work_order_timer_one_active_person_idx
  on public.cmms_work_order_timer(person_id)
  where status in ('RUNNING','PAUSED');
create index if not exists cmms_work_order_timer_work_order_idx
  on public.cmms_work_order_timer(work_order_id, created_at desc);

alter table public.cmms_work_order_labor
  add column if not exists exact_seconds integer,
  add column if not exists timer_id uuid references public.cmms_work_order_timer(timer_id) on delete set null;

create unique index if not exists cmms_work_order_labor_timer_unique_idx
  on public.cmms_work_order_labor(timer_id)
  where timer_id is not null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.cmms_work_order_labor'::regclass
      and conname='cmms_wo_labor_exact_seconds_valid'
  ) then
    alter table public.cmms_work_order_labor
      add constraint cmms_wo_labor_exact_seconds_valid
      check (exact_seconds is null or exact_seconds >= 0);
  end if;
end $$;

create table if not exists public.cmms_work_order_draft (
  draft_id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  draft_mode text not null default 'CREATE',
  work_order_id text references public.maintenance_work_order(work_order_id) on delete cascade,
  title text,
  payload jsonb not null default '{}'::jsonb,
  client_mutation_id text,
  status text not null default 'ACTIVE',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_work_order_draft_mode_valid check (draft_mode in ('CREATE','EDIT')),
  constraint cmms_work_order_draft_status_valid check (status in ('ACTIVE','SUBMITTED','DISCARDED')),
  constraint cmms_work_order_draft_target_valid check (
    (draft_mode='CREATE' and work_order_id is null)
    or (draft_mode='EDIT' and work_order_id is not null)
  )
);

create index if not exists cmms_work_order_draft_owner_idx
  on public.cmms_work_order_draft(owner_user_id, status, updated_at desc);
create unique index if not exists cmms_work_order_draft_client_mutation_unique_idx
  on public.cmms_work_order_draft(owner_user_id, client_mutation_id)
  where client_mutation_id is not null;

alter table public.cmms_work_order_timer enable row level security;
alter table public.cmms_work_order_draft enable row level security;

revoke all on table public.cmms_work_order_timer from anon;
revoke all on table public.cmms_work_order_draft from anon;
grant select on table public.cmms_work_order_timer to authenticated;
grant select,insert,update,delete on table public.cmms_work_order_draft to authenticated;

create policy cmms_work_order_timer_read_auth on public.cmms_work_order_timer
  for select to authenticated using (true);
create policy cmms_work_order_draft_owner_all on public.cmms_work_order_draft
  for all to authenticated
  using (owner_user_id=auth.uid())
  with check (owner_user_id=auth.uid());

create or replace function public.rpc_cmms_work_order_timer_state(p_work_order_id text default null)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_person_id uuid;
  v_timer public.cmms_work_order_timer%rowtype;
  v_elapsed integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.person_id into v_person_id
  from public.cmms_person p
  where p.auth_user_id=v_uid and p.active=true and p.archived_at is null
  order by p.created_at limit 1;
  if v_person_id is null then
    return jsonb_build_object('active',false,'personId',null);
  end if;

  select * into v_timer
  from public.cmms_work_order_timer t
  where t.person_id=v_person_id
    and t.status in ('RUNNING','PAUSED')
    and (p_work_order_id is null or t.work_order_id=p_work_order_id)
  order by t.created_at desc limit 1;

  if not found then
    return jsonb_build_object('active',false,'personId',v_person_id);
  end if;

  v_elapsed:=v_timer.accumulated_seconds + case when v_timer.status='RUNNING'
    then greatest(0,floor(extract(epoch from (now()-v_timer.running_since)))::integer)
    else 0 end;

  return jsonb_build_object(
    'active',true,
    'timerId',v_timer.timer_id,
    'workOrderId',v_timer.work_order_id,
    'personId',v_timer.person_id,
    'status',v_timer.status,
    'startedAt',v_timer.started_at,
    'runningSince',v_timer.running_since,
    'pausedAt',v_timer.paused_at,
    'elapsedSeconds',v_elapsed,
    'hourlyRate',v_timer.hourly_rate,
    'note',v_timer.note
  );
end $$;

create or replace function public.rpc_cmms_work_order_timer_start(
  p_work_order_id text,
  p_hourly_rate numeric default null,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(public.current_app_role()::text,'');
  v_person_id uuid;
  v_timer_id uuid;
  v_status text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'TIMER_FORBIDDEN'; end if;
  if p_hourly_rate is not null and p_hourly_rate<0 then raise exception 'TIMER_RATE_INVALID'; end if;

  select w.status into v_status from public.maintenance_work_order w where w.work_order_id=p_work_order_id;
  if v_status is null then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
  if upper(v_status) in ('COMPLETED','COMPLETE','VERIFIED','RELEASED','CANCELLED','CLOSED') then
    raise exception 'TIMER_WORK_ORDER_TERMINAL';
  end if;

  select p.person_id into v_person_id
  from public.cmms_person p
  where p.auth_user_id=v_uid and p.active=true and p.archived_at is null
  order by p.created_at limit 1;
  if v_person_id is null then raise exception 'TIMER_PERSON_PROFILE_REQUIRED'; end if;

  if exists(select 1 from public.cmms_work_order_timer t where t.person_id=v_person_id and t.status in ('RUNNING','PAUSED')) then
    raise exception 'TIMER_ALREADY_ACTIVE';
  end if;

  insert into public.cmms_work_order_timer(
    work_order_id,person_id,status,started_at,running_since,accumulated_seconds,hourly_rate,note,created_by
  ) values (
    p_work_order_id,v_person_id,'RUNNING',now(),now(),0,p_hourly_rate,nullif(btrim(coalesce(p_note,'')),''),v_uid
  ) returning timer_id into v_timer_id;

  return public.rpc_cmms_work_order_timer_state(p_work_order_id);
end $$;

create or replace function public.rpc_cmms_work_order_timer_pause(p_timer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_person_id uuid;
  v_timer public.cmms_work_order_timer%rowtype;
  v_add integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.person_id into v_person_id from public.cmms_person p
  where p.auth_user_id=v_uid and p.active=true and p.archived_at is null
  order by p.created_at limit 1;
  if v_person_id is null then raise exception 'TIMER_PERSON_PROFILE_REQUIRED'; end if;

  select * into v_timer from public.cmms_work_order_timer where timer_id=p_timer_id for update;
  if not found then raise exception 'TIMER_NOT_FOUND'; end if;
  if v_timer.person_id<>v_person_id then raise exception 'TIMER_OWNER_REQUIRED'; end if;
  if v_timer.status<>'RUNNING' then raise exception 'TIMER_NOT_RUNNING'; end if;

  v_add:=greatest(0,floor(extract(epoch from (now()-v_timer.running_since)))::integer);
  update public.cmms_work_order_timer
  set status='PAUSED',accumulated_seconds=accumulated_seconds+v_add,
      running_since=null,paused_at=now(),updated_at=now()
  where timer_id=p_timer_id;

  return public.rpc_cmms_work_order_timer_state(v_timer.work_order_id);
end $$;

create or replace function public.rpc_cmms_work_order_timer_resume(p_timer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_person_id uuid;
  v_timer public.cmms_work_order_timer%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.person_id into v_person_id from public.cmms_person p
  where p.auth_user_id=v_uid and p.active=true and p.archived_at is null
  order by p.created_at limit 1;
  if v_person_id is null then raise exception 'TIMER_PERSON_PROFILE_REQUIRED'; end if;

  select * into v_timer from public.cmms_work_order_timer where timer_id=p_timer_id for update;
  if not found then raise exception 'TIMER_NOT_FOUND'; end if;
  if v_timer.person_id<>v_person_id then raise exception 'TIMER_OWNER_REQUIRED'; end if;
  if v_timer.status<>'PAUSED' then raise exception 'TIMER_NOT_PAUSED'; end if;

  update public.cmms_work_order_timer
  set status='RUNNING',running_since=now(),paused_at=null,updated_at=now()
  where timer_id=p_timer_id;

  return public.rpc_cmms_work_order_timer_state(v_timer.work_order_id);
end $$;

create or replace function public.rpc_cmms_work_order_timer_stop(p_timer_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_person_id uuid;
  v_timer public.cmms_work_order_timer%rowtype;
  v_seconds integer;
  v_add integer:=0;
  v_labor_id uuid:=gen_random_uuid();
  v_minutes integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.person_id into v_person_id from public.cmms_person p
  where p.auth_user_id=v_uid and p.active=true and p.archived_at is null
  order by p.created_at limit 1;
  if v_person_id is null then raise exception 'TIMER_PERSON_PROFILE_REQUIRED'; end if;

  select * into v_timer from public.cmms_work_order_timer where timer_id=p_timer_id for update;
  if not found then raise exception 'TIMER_NOT_FOUND'; end if;
  if v_timer.person_id<>v_person_id then raise exception 'TIMER_OWNER_REQUIRED'; end if;
  if v_timer.status not in ('RUNNING','PAUSED') then raise exception 'TIMER_NOT_ACTIVE'; end if;

  if v_timer.status='RUNNING' then
    v_add:=greatest(0,floor(extract(epoch from (now()-v_timer.running_since)))::integer);
  end if;
  v_seconds:=greatest(0,v_timer.accumulated_seconds+v_add);
  v_minutes:=case when v_seconds=0 then 0 else greatest(1,ceil(v_seconds/60.0)::integer) end;

  update public.cmms_work_order_timer
  set status='STOPPED',accumulated_seconds=v_seconds,running_since=null,
      stopped_at=now(),note=coalesce(nullif(btrim(coalesce(p_note,'')),''),note),updated_at=now()
  where timer_id=p_timer_id;

  insert into public.cmms_work_order_labor(
    labor_id,work_order_id,person_id,started_at,ended_at,minutes,exact_seconds,hourly_rate,note,timer_id,created_by
  ) values (
    v_labor_id,v_timer.work_order_id,v_timer.person_id,v_timer.started_at,now(),v_minutes,v_seconds,
    v_timer.hourly_rate,coalesce(nullif(btrim(coalesce(p_note,'')),''),v_timer.note),v_timer.timer_id,v_uid
  );

  return jsonb_build_object(
    'timerId',v_timer.timer_id,'workOrderId',v_timer.work_order_id,'status','STOPPED',
    'elapsedSeconds',v_seconds,'laborId',v_labor_id,'minutes',v_minutes
  );
end $$;

create or replace function public.rpc_cmms_work_order_timer_cancel(p_timer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_person_id uuid;
  v_timer public.cmms_work_order_timer%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select p.person_id into v_person_id from public.cmms_person p
  where p.auth_user_id=v_uid and p.active=true and p.archived_at is null
  order by p.created_at limit 1;
  if v_person_id is null then raise exception 'TIMER_PERSON_PROFILE_REQUIRED'; end if;

  select * into v_timer from public.cmms_work_order_timer where timer_id=p_timer_id for update;
  if not found then raise exception 'TIMER_NOT_FOUND'; end if;
  if v_timer.person_id<>v_person_id then raise exception 'TIMER_OWNER_REQUIRED'; end if;
  if v_timer.status not in ('RUNNING','PAUSED') then raise exception 'TIMER_NOT_ACTIVE'; end if;

  update public.cmms_work_order_timer
  set status='CANCELLED',running_since=null,stopped_at=now(),updated_at=now()
  where timer_id=p_timer_id;

  return jsonb_build_object('timerId',p_timer_id,'workOrderId',v_timer.work_order_id,'status','CANCELLED');
end $$;

create or replace function public.rpc_cmms_save_work_order_draft(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(public.current_app_role()::text,'');
  v_draft_id uuid;
  v_mode text:=upper(coalesce(nullif(p_input->>'draftMode',''),'CREATE'));
  v_work_order_id text:=nullif(btrim(coalesce(p_input->>'workOrderId','')),'');
  v_client_mutation_id text:=nullif(btrim(coalesce(p_input->>'clientMutationId','')),'');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'DRAFT_FORBIDDEN'; end if;
  if v_mode not in ('CREATE','EDIT') then raise exception 'DRAFT_MODE_INVALID'; end if;
  if v_mode='EDIT' and (v_work_order_id is null or not exists(select 1 from public.maintenance_work_order where work_order_id=v_work_order_id)) then
    raise exception 'DRAFT_WORK_ORDER_INVALID';
  end if;
  if v_mode='CREATE' then v_work_order_id:=null; end if;

  if nullif(p_input->>'draftId','') is not null then
    v_draft_id:=(p_input->>'draftId')::uuid;
    update public.cmms_work_order_draft
    set draft_mode=v_mode,work_order_id=v_work_order_id,
        title=nullif(btrim(coalesce(p_input->>'title','')),''),
        payload=coalesce(p_input->'payload','{}'::jsonb),
        client_mutation_id=coalesce(v_client_mutation_id,client_mutation_id),
        status='ACTIVE',last_synced_at=now(),updated_at=now()
    where draft_id=v_draft_id and owner_user_id=v_uid;
    if not found then raise exception 'DRAFT_NOT_FOUND'; end if;
  elsif v_client_mutation_id is not null then
    select d.draft_id into v_draft_id from public.cmms_work_order_draft d
    where d.owner_user_id=v_uid and d.client_mutation_id=v_client_mutation_id limit 1;
    if v_draft_id is not null then
      update public.cmms_work_order_draft
      set draft_mode=v_mode,work_order_id=v_work_order_id,
          title=nullif(btrim(coalesce(p_input->>'title','')),''),
          payload=coalesce(p_input->'payload','{}'::jsonb),
          status='ACTIVE',last_synced_at=now(),updated_at=now()
      where draft_id=v_draft_id;
    end if;
  end if;

  if v_draft_id is null then
    insert into public.cmms_work_order_draft(
      owner_user_id,draft_mode,work_order_id,title,payload,client_mutation_id,status,last_synced_at
    ) values (
      v_uid,v_mode,v_work_order_id,nullif(btrim(coalesce(p_input->>'title','')),''),
      coalesce(p_input->'payload','{}'::jsonb),v_client_mutation_id,'ACTIVE',now()
    ) returning draft_id into v_draft_id;
  end if;

  return jsonb_build_object('draftId',v_draft_id,'status','ACTIVE','lastSyncedAt',now());
end $$;

create or replace function public.rpc_cmms_work_order_drafts()
returns table(
  draft_id uuid,draft_mode text,work_order_id text,title text,payload jsonb,
  client_mutation_id text,status text,last_synced_at timestamptz,created_at timestamptz,updated_at timestamptz
)
language sql
security invoker
set search_path=public
as $$
  select d.draft_id,d.draft_mode,d.work_order_id,d.title,d.payload,d.client_mutation_id,d.status,
         d.last_synced_at,d.created_at,d.updated_at
  from public.cmms_work_order_draft d
  where d.owner_user_id=auth.uid() and d.status='ACTIVE'
  order by d.updated_at desc;
$$;

create or replace function public.rpc_cmms_discard_work_order_draft(p_draft_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid:=auth.uid(); begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.cmms_work_order_draft set status='DISCARDED',updated_at=now()
  where draft_id=p_draft_id and owner_user_id=v_uid and status='ACTIVE';
  return found;
end $$;

revoke all on function public.rpc_cmms_work_order_timer_state(text) from public,anon;
revoke all on function public.rpc_cmms_work_order_timer_start(text,numeric,text) from public,anon;
revoke all on function public.rpc_cmms_work_order_timer_pause(uuid) from public,anon;
revoke all on function public.rpc_cmms_work_order_timer_resume(uuid) from public,anon;
revoke all on function public.rpc_cmms_work_order_timer_stop(uuid,text) from public,anon;
revoke all on function public.rpc_cmms_work_order_timer_cancel(uuid) from public,anon;
revoke all on function public.rpc_cmms_save_work_order_draft(jsonb) from public,anon;
revoke all on function public.rpc_cmms_work_order_drafts() from public,anon;
revoke all on function public.rpc_cmms_discard_work_order_draft(uuid) from public,anon;

grant execute on function public.rpc_cmms_work_order_timer_state(text) to authenticated;
grant execute on function public.rpc_cmms_work_order_timer_start(text,numeric,text) to authenticated;
grant execute on function public.rpc_cmms_work_order_timer_pause(uuid) to authenticated;
grant execute on function public.rpc_cmms_work_order_timer_resume(uuid) to authenticated;
grant execute on function public.rpc_cmms_work_order_timer_stop(uuid,text) to authenticated;
grant execute on function public.rpc_cmms_work_order_timer_cancel(uuid) to authenticated;
grant execute on function public.rpc_cmms_save_work_order_draft(jsonb) to authenticated;
grant execute on function public.rpc_cmms_work_order_drafts() to authenticated;
grant execute on function public.rpc_cmms_discard_work_order_draft(uuid) to authenticated;
