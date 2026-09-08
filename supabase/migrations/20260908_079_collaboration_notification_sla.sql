-- Collaboration / notification / SLA foundation for CMMS entities.
-- Backend only; additive and UI-agnostic.

create table if not exists public.cmms_entity_comment (
  comment_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  parent_comment_id uuid references public.cmms_entity_comment(comment_id) on delete cascade,
  body text not null,
  created_by uuid references auth.users(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cmms_entity_comment_entity_type_valid check (entity_type in ('WORK_ORDER','REQUEST','ASSET','PM','PURCHASE_ORDER')),
  constraint cmms_entity_comment_body_not_blank check (btrim(body) <> '')
);

create table if not exists public.cmms_entity_watcher (
  entity_type text not null,
  entity_id text not null,
  person_id uuid not null references public.cmms_person(person_id) on delete cascade,
  watch_reason text not null default 'MANUAL',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(entity_type, entity_id, person_id),
  constraint cmms_entity_watcher_entity_type_valid check (entity_type in ('WORK_ORDER','REQUEST','ASSET','PM','PURCHASE_ORDER')),
  constraint cmms_entity_watcher_reason_valid check (watch_reason in ('MANUAL','ASSIGNEE','CREATOR','MENTION','APPROVER','TEAM'))
);

create table if not exists public.cmms_comment_mention (
  comment_id uuid not null references public.cmms_entity_comment(comment_id) on delete cascade,
  person_id uuid not null references public.cmms_person(person_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(comment_id, person_id)
);

create table if not exists public.cmms_notification (
  notification_id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.cmms_person(person_id) on delete cascade,
  notification_type text not null,
  entity_type text,
  entity_id text,
  title text not null,
  body text,
  priority text not null default 'NORMAL',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cmms_notification_type_valid check (notification_type in ('COMMENT','MENTION','ASSIGNMENT','STATUS_CHANGE','SLA_WARNING','SLA_BREACH','ESCALATION','SYSTEM')),
  constraint cmms_notification_priority_valid check (priority in ('LOW','NORMAL','HIGH','URGENT'))
);

create table if not exists public.cmms_activity_event (
  activity_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text,
  summary text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cmms_activity_entity_type_valid check (entity_type in ('WORK_ORDER','REQUEST','ASSET','PM','PURCHASE_ORDER','INVENTORY'))
);

create table if not exists public.cmms_sla_policy (
  sla_policy_id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null,
  priority text,
  response_minutes integer,
  resolution_minutes integer,
  warning_percent integer not null default 80,
  escalation_person_id uuid references public.cmms_person(person_id) on delete set null,
  escalation_team_id uuid references public.cmms_team(team_id) on delete set null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_sla_policy_name_not_blank check (btrim(name) <> ''),
  constraint cmms_sla_policy_entity_type_valid check (entity_type in ('WORK_ORDER','REQUEST')),
  constraint cmms_sla_policy_response_valid check (response_minutes is null or response_minutes > 0),
  constraint cmms_sla_policy_resolution_valid check (resolution_minutes is null or resolution_minutes > 0),
  constraint cmms_sla_policy_warning_valid check (warning_percent between 1 and 100)
);

create table if not exists public.cmms_sla_instance (
  sla_instance_id uuid primary key default gen_random_uuid(),
  sla_policy_id uuid not null references public.cmms_sla_policy(sla_policy_id) on delete restrict,
  entity_type text not null,
  entity_id text not null,
  started_at timestamptz not null default now(),
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  responded_at timestamptz,
  resolved_at timestamptz,
  warning_sent_at timestamptz,
  breached_at timestamptz,
  escalation_count integer not null default 0,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, entity_id, sla_policy_id),
  constraint cmms_sla_instance_entity_type_valid check (entity_type in ('WORK_ORDER','REQUEST')),
  constraint cmms_sla_instance_status_valid check (status in ('ACTIVE','WARNING','BREACHED','MET','CANCELLED')),
  constraint cmms_sla_instance_escalation_nonnegative check (escalation_count >= 0)
);

create index if not exists cmms_comment_entity_idx on public.cmms_entity_comment(entity_type, entity_id, created_at);
create index if not exists cmms_watcher_person_idx on public.cmms_entity_watcher(person_id, entity_type, entity_id);
create index if not exists cmms_notification_inbox_idx on public.cmms_notification(person_id, read_at, created_at desc);
create index if not exists cmms_activity_entity_idx on public.cmms_activity_event(entity_type, entity_id, created_at desc);
create index if not exists cmms_sla_instance_status_idx on public.cmms_sla_instance(status, resolution_due_at, response_due_at);

-- RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'cmms_entity_comment','cmms_entity_watcher','cmms_comment_mention','cmms_notification',
    'cmms_activity_event','cmms_sla_policy','cmms_sla_instance'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy cmms_entity_comment_read on public.cmms_entity_comment for select to authenticated using (public.is_authenticated());
create policy cmms_entity_watcher_read on public.cmms_entity_watcher for select to authenticated using (public.is_authenticated());
create policy cmms_comment_mention_read on public.cmms_comment_mention for select to authenticated using (public.is_authenticated());
create policy cmms_activity_event_read on public.cmms_activity_event for select to authenticated using (public.is_authenticated());
create policy cmms_sla_policy_read on public.cmms_sla_policy for select to authenticated using (public.is_authenticated());
create policy cmms_sla_instance_read on public.cmms_sla_instance for select to authenticated using (public.is_authenticated());
create policy cmms_notification_self_read on public.cmms_notification for select to authenticated
using (exists(select 1 from public.cmms_person p where p.person_id=cmms_notification.person_id and p.auth_user_id=auth.uid()));

create policy cmms_sla_policy_manage on public.cmms_sla_policy for all to authenticated
using (public.current_app_role() in ('MANAGER','ADMIN')) with check (public.current_app_role() in ('MANAGER','ADMIN'));
create policy cmms_sla_instance_manage on public.cmms_sla_instance for all to authenticated
using (public.current_app_role() in ('SUPERVISOR','MANAGER','ADMIN')) with check (public.current_app_role() in ('SUPERVISOR','MANAGER','ADMIN'));

-- Data API grants; mutation is primarily through RPCs.
grant select on public.cmms_entity_comment, public.cmms_entity_watcher, public.cmms_comment_mention, public.cmms_notification,
  public.cmms_activity_event, public.cmms_sla_policy, public.cmms_sla_instance to authenticated;

create or replace function public.rpc_cmms_add_comment(
  p_entity_type text,
  p_entity_id text,
  p_body text,
  p_mention_person_ids uuid[] default null,
  p_parent_comment_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_person uuid;
  v_actor_uid uuid := auth.uid();
  v_actor text;
begin
  if v_actor_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if upper(trim(p_entity_type)) not in ('WORK_ORDER','REQUEST','ASSET','PM','PURCHASE_ORDER') then raise exception 'COMMENT_ENTITY_TYPE_INVALID'; end if;
  if btrim(coalesce(p_entity_id,''))='' then raise exception 'COMMENT_ENTITY_ID_REQUIRED'; end if;
  if btrim(coalesce(p_body,''))='' then raise exception 'COMMENT_BODY_REQUIRED'; end if;

  insert into public.cmms_entity_comment(entity_type,entity_id,parent_comment_id,body,created_by)
  values(upper(trim(p_entity_type)),btrim(p_entity_id),p_parent_comment_id,btrim(p_body),v_actor_uid)
  returning comment_id into v_id;

  if p_mention_person_ids is not null then
    foreach v_person in array p_mention_person_ids loop
      if exists(select 1 from public.cmms_person where person_id=v_person and active=true and archived_at is null) then
        insert into public.cmms_comment_mention(comment_id,person_id) values(v_id,v_person) on conflict do nothing;
        insert into public.cmms_entity_watcher(entity_type,entity_id,person_id,watch_reason,created_by)
        values(upper(trim(p_entity_type)),btrim(p_entity_id),v_person,'MENTION',v_actor_uid) on conflict do nothing;
        insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
        values(v_person,'MENTION',upper(trim(p_entity_type)),btrim(p_entity_id),'You were mentioned',left(btrim(p_body),500),'HIGH',jsonb_build_object('commentId',v_id));
      end if;
    end loop;
  end if;

  -- Notify watchers except the actor.
  insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,payload)
  select w.person_id,'COMMENT',w.entity_type,w.entity_id,'New comment',left(btrim(p_body),500),jsonb_build_object('commentId',v_id)
  from public.cmms_entity_watcher w
  join public.cmms_person p on p.person_id=w.person_id
  where w.entity_type=upper(trim(p_entity_type)) and w.entity_id=btrim(p_entity_id)
    and coalesce(p.auth_user_id,'00000000-0000-0000-0000-000000000000'::uuid)<>v_actor_uid
    and not exists(select 1 from public.cmms_comment_mention m where m.comment_id=v_id and m.person_id=w.person_id);

  v_actor:=coalesce(auth.jwt()->>'email',v_actor_uid::text);
  insert into public.cmms_activity_event(entity_type,entity_id,event_type,actor_user_id,actor_label,summary,detail)
  values(upper(trim(p_entity_type)),btrim(p_entity_id),'COMMENT_ADDED',v_actor_uid,v_actor,'Comment added',jsonb_build_object('commentId',v_id));
  return v_id;
end $$;
revoke all on function public.rpc_cmms_add_comment(text,text,text,uuid[],uuid) from public, anon;
grant execute on function public.rpc_cmms_add_comment(text,text,text,uuid[],uuid) to authenticated;

create or replace function public.rpc_cmms_watch_entity(
  p_entity_type text,p_entity_id text,p_person_id uuid,p_watch boolean default true,p_reason text default 'MANUAL'
) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_watch then
    insert into public.cmms_entity_watcher(entity_type,entity_id,person_id,watch_reason,created_by)
    values(upper(trim(p_entity_type)),btrim(p_entity_id),p_person_id,upper(trim(p_reason)),auth.uid())
    on conflict(entity_type,entity_id,person_id) do update set watch_reason=excluded.watch_reason;
  else
    delete from public.cmms_entity_watcher where entity_type=upper(trim(p_entity_type)) and entity_id=btrim(p_entity_id) and person_id=p_person_id;
  end if;
  return p_watch;
end $$;
revoke all on function public.rpc_cmms_watch_entity(text,text,uuid,boolean,text) from public, anon;
grant execute on function public.rpc_cmms_watch_entity(text,text,uuid,boolean,text) to authenticated;

create or replace function public.rpc_cmms_notification_inbox(
  p_unread_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
) returns setof public.cmms_notification
language sql security invoker set search_path=public as $$
  select n.* from public.cmms_notification n
  join public.cmms_person p on p.person_id=n.person_id
  where p.auth_user_id=auth.uid() and (not p_unread_only or n.read_at is null)
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),200)) offset greatest(coalesce(p_offset,0),0)
$$;
revoke all on function public.rpc_cmms_notification_inbox(boolean,integer,integer) from public, anon;
grant execute on function public.rpc_cmms_notification_inbox(boolean,integer,integer) to authenticated;

create or replace function public.rpc_cmms_mark_notification_read(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.cmms_notification n set read_at=coalesce(read_at,now())
  where notification_id=p_notification_id
    and exists(select 1 from public.cmms_person p where p.person_id=n.person_id and p.auth_user_id=auth.uid());
  return found;
end $$;
revoke all on function public.rpc_cmms_mark_notification_read(uuid) from public, anon;
grant execute on function public.rpc_cmms_mark_notification_read(uuid) to authenticated;

create or replace function public.rpc_cmms_start_sla(
  p_entity_type text,p_entity_id text,p_priority text default null
) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_policy public.cmms_sla_policy%rowtype; v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_policy from public.cmms_sla_policy
  where active=true and entity_type=upper(trim(p_entity_type))
    and (priority is null or priority=upper(trim(coalesce(p_priority,''))))
  order by case when priority is null then 1 else 0 end, created_at desc limit 1;
  if not found then raise exception 'SLA_POLICY_NOT_FOUND'; end if;

  insert into public.cmms_sla_instance(sla_policy_id,entity_type,entity_id,response_due_at,resolution_due_at)
  values(v_policy.sla_policy_id,v_policy.entity_type,btrim(p_entity_id),
    case when v_policy.response_minutes is null then null else now()+make_interval(mins=>v_policy.response_minutes) end,
    case when v_policy.resolution_minutes is null then null else now()+make_interval(mins=>v_policy.resolution_minutes) end)
  on conflict(entity_type,entity_id,sla_policy_id) do update set updated_at=now()
  returning sla_instance_id into v_id;
  return v_id;
end $$;
revoke all on function public.rpc_cmms_start_sla(text,text,text) from public, anon;
grant execute on function public.rpc_cmms_start_sla(text,text,text) to authenticated;

create or replace function public.rpc_cmms_run_sla_escalation(p_now timestamptz default now())
returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_role public.app_role;
  r record;
  v_warning_count integer:=0;
  v_breach_count integer:=0;
  v_person uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'SLA_ESCALATION_ROLE_DENIED'; end if;

  for r in
    select i.*,p.warning_percent,p.escalation_person_id,p.escalation_team_id
    from public.cmms_sla_instance i join public.cmms_sla_policy p on p.sla_policy_id=i.sla_policy_id
    where i.status in ('ACTIVE','WARNING')
  loop
    if r.resolution_due_at is not null and p_now >= r.resolution_due_at then
      update public.cmms_sla_instance set status='BREACHED',breached_at=coalesce(breached_at,p_now),escalation_count=escalation_count+1,updated_at=p_now where sla_instance_id=r.sla_instance_id;
      v_breach_count:=v_breach_count+1;

      if r.escalation_person_id is not null then
        insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
        values(r.escalation_person_id,'SLA_BREACH',r.entity_type,r.entity_id,'SLA breached','Resolution SLA has been breached','URGENT',jsonb_build_object('slaInstanceId',r.sla_instance_id));
      end if;
      if r.escalation_team_id is not null then
        for v_person in select person_id from public.cmms_team_member where team_id=r.escalation_team_id loop
          insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
          values(v_person,'ESCALATION',r.entity_type,r.entity_id,'SLA escalation','Resolution SLA has been breached','URGENT',jsonb_build_object('slaInstanceId',r.sla_instance_id));
        end loop;
      end if;
      insert into public.cmms_activity_event(entity_type,entity_id,event_type,summary,detail)
      values(r.entity_type,r.entity_id,'SLA_BREACH','SLA breached',jsonb_build_object('slaInstanceId',r.sla_instance_id));

    elsif r.resolution_due_at is not null and r.warning_sent_at is null
      and p_now >= (r.started_at + ((r.resolution_due_at-r.started_at) * (r.warning_percent::numeric/100))) then
      update public.cmms_sla_instance set status='WARNING',warning_sent_at=p_now,updated_at=p_now where sla_instance_id=r.sla_instance_id;
      v_warning_count:=v_warning_count+1;
      if r.escalation_person_id is not null then
        insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
        values(r.escalation_person_id,'SLA_WARNING',r.entity_type,r.entity_id,'SLA warning','Entity is approaching SLA breach','HIGH',jsonb_build_object('slaInstanceId',r.sla_instance_id));
      end if;
    end if;
  end loop;
  return jsonb_build_object('warnings',v_warning_count,'breaches',v_breach_count,'checkedAt',p_now);
end $$;
revoke all on function public.rpc_cmms_run_sla_escalation(timestamptz) from public, anon;
grant execute on function public.rpc_cmms_run_sla_escalation(timestamptz) to authenticated;
