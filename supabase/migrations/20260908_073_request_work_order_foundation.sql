-- Request -> Work Order foundation for UpKeep/Atlas-class CMMS.
-- Additive only. Existing request/work-order RPCs remain callable.

alter table public.maintenance_request
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists priority text,
  add column if not exists requested_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists converted_work_order_id text references public.maintenance_work_order(work_order_id) on delete set null,
  add column if not exists source_data jsonb not null default '{}'::jsonb;

create index if not exists maintenance_request_status_created_idx
  on public.maintenance_request(status, created_at desc);
create index if not exists maintenance_request_converted_wo_idx
  on public.maintenance_request(converted_work_order_id);

create table if not exists public.cmms_work_order_person_assignment (
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  person_id uuid not null references public.cmms_person(person_id) on delete cascade,
  assignment_role text not null default 'ASSIGNEE',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(work_order_id, person_id, assignment_role),
  constraint cmms_wo_person_role_valid check (assignment_role in ('PRIMARY_ASSIGNEE','ASSIGNEE','WATCHER','APPROVER','VERIFIER'))
);

create table if not exists public.cmms_work_order_team_assignment (
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  team_id uuid not null references public.cmms_team(team_id) on delete cascade,
  assignment_role text not null default 'ASSIGNED_TEAM',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(work_order_id, team_id, assignment_role),
  constraint cmms_wo_team_role_valid check (assignment_role in ('PRIMARY_TEAM','ASSIGNED_TEAM','WATCHER_TEAM'))
);

create table if not exists public.cmms_work_order_checklist_item (
  checklist_item_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  sequence_no integer not null default 0,
  title text not null,
  description text,
  response_type text not null default 'CHECK',
  required boolean not null default false,
  completed boolean not null default false,
  response_text text,
  response_number numeric,
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cmms_wo_checklist_title_not_blank check (btrim(title) <> ''),
  constraint cmms_wo_checklist_response_type_valid check (response_type in ('CHECK','TEXT','NUMBER','PASS_FAIL','METER'))
);

create table if not exists public.cmms_work_order_part_usage (
  usage_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  spare_part_id text,
  part_name text not null,
  quantity numeric not null default 1,
  unit text,
  unit_cost numeric,
  issued_by uuid references auth.users(id) on delete set null,
  used_at timestamptz not null default now(),
  notes text,
  constraint cmms_wo_part_name_not_blank check (btrim(part_name) <> ''),
  constraint cmms_wo_part_quantity_positive check (quantity > 0),
  constraint cmms_wo_part_cost_nonnegative check (unit_cost is null or unit_cost >= 0)
);

create table if not exists public.cmms_work_order_labor (
  labor_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  person_id uuid references public.cmms_person(person_id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  minutes integer,
  hourly_rate numeric,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cmms_wo_labor_end_valid check (ended_at is null or ended_at >= started_at),
  constraint cmms_wo_labor_minutes_valid check (minutes is null or minutes >= 0),
  constraint cmms_wo_labor_rate_valid check (hourly_rate is null or hourly_rate >= 0)
);

create table if not exists public.cmms_work_order_attachment (
  attachment_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  file_name text not null,
  storage_bucket text,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  attachment_kind text not null default 'FILE',
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cmms_wo_attachment_name_not_blank check (btrim(file_name) <> ''),
  constraint cmms_wo_attachment_path_not_blank check (btrim(storage_path) <> ''),
  constraint cmms_wo_attachment_kind_valid check (attachment_kind in ('FILE','PHOTO','VIDEO','VOICE','DOCUMENT')),
  constraint cmms_wo_attachment_size_valid check (file_size_bytes is null or file_size_bytes >= 0)
);

create index if not exists cmms_wo_person_person_idx on public.cmms_work_order_person_assignment(person_id, assignment_role);
create index if not exists cmms_wo_team_team_idx on public.cmms_work_order_team_assignment(team_id, assignment_role);
create index if not exists cmms_wo_checklist_order_idx on public.cmms_work_order_checklist_item(work_order_id, sequence_no);
create index if not exists cmms_wo_part_order_idx on public.cmms_work_order_part_usage(work_order_id, used_at desc);
create index if not exists cmms_wo_labor_order_idx on public.cmms_work_order_labor(work_order_id, started_at desc);
create index if not exists cmms_wo_attachment_order_idx on public.cmms_work_order_attachment(work_order_id, created_at desc);

-- RLS: authenticated reads; mutations through explicit RPCs or manager/admin direct management.
do $$
declare t text;
begin
  foreach t in array array[
    'cmms_work_order_person_assignment','cmms_work_order_team_assignment','cmms_work_order_checklist_item',
    'cmms_work_order_part_usage','cmms_work_order_labor','cmms_work_order_attachment'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_authenticated())', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.current_app_role() in (''MANAGER'',''ADMIN'')) with check (public.current_app_role() in (''MANAGER'',''ADMIN''))',
      t || '_manage', t
    );
  end loop;
end $$;

-- Review lifecycle: OPEN -> UNDER_REVIEW -> APPROVED / REJECTED; APPROVED -> CONVERTED.
create or replace function public.rpc_cmms_transition_request(
  p_request_id text,
  p_action text,
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_req public.maintenance_request%rowtype;
  v_action text := upper(trim(coalesce(p_action,'')));
  v_next text;
  v_actor text;
  v_actor_uid uuid := auth.uid();
begin
  if v_actor_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'REQUEST_REVIEW_ROLE_DENIED'; end if;

  select * into v_req from public.maintenance_request where request_id=trim(p_request_id) for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  case v_action
    when 'START_REVIEW' then
      if v_req.status <> 'OPEN' then raise exception 'INVALID_REQUEST_TRANSITION'; end if;
      v_next := 'UNDER_REVIEW';
    when 'APPROVE' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'REQUEST_APPROVE_ROLE_DENIED'; end if;
      if v_req.status not in ('OPEN','UNDER_REVIEW') then raise exception 'INVALID_REQUEST_TRANSITION'; end if;
      v_next := 'APPROVED';
    when 'REJECT' then
      if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'REQUEST_REJECT_ROLE_DENIED'; end if;
      if v_req.status not in ('OPEN','UNDER_REVIEW') then raise exception 'INVALID_REQUEST_TRANSITION'; end if;
      if btrim(coalesce(p_note,''))='' then raise exception 'REJECTION_REASON_REQUIRED'; end if;
      v_next := 'REJECTED';
    when 'CANCEL' then
      if v_req.status in ('CONVERTED','REJECTED','CANCELLED') then raise exception 'INVALID_REQUEST_TRANSITION'; end if;
      v_next := 'CANCELLED';
    else raise exception 'UNKNOWN_REQUEST_ACTION';
  end case;

  v_actor := coalesce(auth.jwt()->>'email', v_actor_uid::text);
  update public.maintenance_request
  set status=v_next,
      reviewed_by_user_id=case when v_action in ('APPROVE','REJECT') then v_actor_uid else reviewed_by_user_id end,
      reviewed_at=case when v_action in ('APPROVE','REJECT') then now() else reviewed_at end,
      rejection_reason=case when v_action='REJECT' then btrim(p_note) when v_action='APPROVE' then null else rejection_reason end,
      source_data=coalesce(source_data,'{}'::jsonb) || jsonb_build_object('lastAction',v_action,'lastActionBy',v_actor,'lastActionAt',now(),'lastNote',coalesce(p_note,'')),
      updated_at=now()
  where request_id=v_req.request_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_req.equipment_id,'Maintenance_Request',v_req.request_id,v_action,v_actor,
    jsonb_build_object('before',v_req.status,'after',v_next,'note',coalesce(p_note,''))
  );

  return jsonb_build_object('requestId',v_req.request_id,'status',v_next);
end $$;

revoke all on function public.rpc_cmms_transition_request(text,text,text) from public, anon;
grant execute on function public.rpc_cmms_transition_request(text,text,text) to authenticated;

-- Idempotent conversion from an approved Request into one Work Order.
create or replace function public.rpc_cmms_convert_request_to_work_order(
  p_request_id text,
  p_priority text default null,
  p_assignee_person_id uuid default null,
  p_team_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_req public.maintenance_request%rowtype;
  v_wo_id text;
  v_actor text;
  v_actor_uid uuid := auth.uid();
  v_priority text;
begin
  if v_actor_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role := public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'REQUEST_CONVERT_ROLE_DENIED'; end if;

  select * into v_req from public.maintenance_request where request_id=trim(p_request_id) for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;

  if v_req.converted_work_order_id is not null then
    return jsonb_build_object('requestId',v_req.request_id,'workOrderId',v_req.converted_work_order_id,'status','CONVERTED','idempotent',true);
  end if;
  if v_req.status <> 'APPROVED' then raise exception 'REQUEST_APPROVAL_REQUIRED'; end if;

  if p_assignee_person_id is not null and not exists(select 1 from public.cmms_person where person_id=p_assignee_person_id and active=true and archived_at is null) then
    raise exception 'ACTIVE_ASSIGNEE_NOT_FOUND';
  end if;
  if p_team_id is not null and not exists(select 1 from public.cmms_team where team_id=p_team_id and active=true and archived_at is null) then
    raise exception 'ACTIVE_TEAM_NOT_FOUND';
  end if;

  v_actor := coalesce(auth.jwt()->>'email', v_actor_uid::text);
  v_priority := coalesce(nullif(upper(trim(p_priority)),''), nullif(upper(trim(v_req.priority)),''), 'NORMAL');
  v_wo_id := 'WO-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);

  insert into public.maintenance_work_order(
    work_order_id,equipment_id,status,priority,reason,source_type,source_id,created_by,source_data
  ) values(
    v_wo_id,v_req.equipment_id,'OPEN',v_priority,
    coalesce(nullif(v_req.description,''),nullif(v_req.reason,''),nullif(v_req.title,''),'Maintenance request'),
    'MAINTENANCE_REQUEST',v_req.request_id,v_actor,
    jsonb_build_object('requestId',v_req.request_id,'requestTitle',coalesce(v_req.title,''),'convertedBy',v_actor,'convertedAt',now())
  );

  if p_assignee_person_id is not null then
    insert into public.cmms_work_order_person_assignment(work_order_id,person_id,assignment_role,created_by)
    values(v_wo_id,p_assignee_person_id,'PRIMARY_ASSIGNEE',v_actor_uid);
  end if;
  if p_team_id is not null then
    insert into public.cmms_work_order_team_assignment(work_order_id,team_id,assignment_role,created_by)
    values(v_wo_id,p_team_id,'PRIMARY_TEAM',v_actor_uid);
  end if;

  update public.maintenance_request
  set status='CONVERTED',converted_work_order_id=v_wo_id,
      source_data=coalesce(source_data,'{}'::jsonb)||jsonb_build_object('convertedBy',v_actor,'convertedAt',now()),
      updated_at=now()
  where request_id=v_req.request_id;

  insert into public.audit_log(audit_id,equipment_id,entity_type,entity_id,action,actor_email,detail)
  values(
    'AUD-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6),
    v_req.equipment_id,'Maintenance_Request',v_req.request_id,'CONVERT_TO_WORK_ORDER',v_actor,
    jsonb_build_object('workOrderId',v_wo_id,'priority',v_priority,'assigneePersonId',p_assignee_person_id,'teamId',p_team_id)
  );

  return jsonb_build_object('requestId',v_req.request_id,'workOrderId',v_wo_id,'status','CONVERTED','idempotent',false);
end $$;

revoke all on function public.rpc_cmms_convert_request_to_work_order(text,text,uuid,uuid) from public, anon;
grant execute on function public.rpc_cmms_convert_request_to_work_order(text,text,uuid,uuid) to authenticated;
