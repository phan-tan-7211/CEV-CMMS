-- Collaboration / notification / SLA hardening.
-- Validates entities and comment parents, restricts watcher/SLA management,
-- separates response/resolution SLA signals, syncs SLA from entity status,
-- and runs escalation from a trusted pg_cron worker.

alter table public.cmms_sla_instance
  add column if not exists response_warning_sent_at timestamptz,
  add column if not exists resolution_warning_sent_at timestamptz,
  add column if not exists response_breached_at timestamptz;

create or replace function public.cmms_entity_exists(p_entity_type text, p_entity_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text:=upper(btrim(coalesce(p_entity_type,'')));
  v_id text:=btrim(coalesce(p_entity_id,''));
begin
  if v_id='' then return false; end if;
  case v_type
    when 'WORK_ORDER' then return exists(select 1 from public.maintenance_work_order where work_order_id=v_id);
    when 'REQUEST' then return exists(select 1 from public.maintenance_request where request_id=v_id);
    when 'ASSET' then return exists(select 1 from public.equipment_master where equipment_id=v_id);
    when 'PM' then return exists(select 1 from public.cmms_pm_schedule where schedule_id::text=v_id);
    when 'PURCHASE_ORDER' then return exists(select 1 from public.cmms_purchase_order where purchase_order_id=v_id);
    else return false;
  end case;
end $$;
revoke all on function public.cmms_entity_exists(text,text) from public, anon, authenticated;

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
  v_actor_uid uuid:=auth.uid();
  v_actor text;
  v_type text:=upper(btrim(coalesce(p_entity_type,'')));
  v_entity_id text:=btrim(coalesce(p_entity_id,''));
  v_parent public.cmms_entity_comment%rowtype;
begin
  if v_actor_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_type not in ('WORK_ORDER','REQUEST','ASSET','PM','PURCHASE_ORDER') then raise exception 'COMMENT_ENTITY_TYPE_INVALID'; end if;
  if v_entity_id='' then raise exception 'COMMENT_ENTITY_ID_REQUIRED'; end if;
  if not public.cmms_entity_exists(v_type,v_entity_id) then raise exception 'COMMENT_ENTITY_NOT_FOUND'; end if;
  if btrim(coalesce(p_body,''))='' then raise exception 'COMMENT_BODY_REQUIRED'; end if;

  if p_parent_comment_id is not null then
    select * into v_parent from public.cmms_entity_comment where comment_id=p_parent_comment_id and deleted_at is null;
    if not found then raise exception 'PARENT_COMMENT_NOT_FOUND'; end if;
    if v_parent.entity_type<>v_type or v_parent.entity_id<>v_entity_id then raise exception 'PARENT_COMMENT_ENTITY_MISMATCH'; end if;
  end if;

  insert into public.cmms_entity_comment(entity_type,entity_id,parent_comment_id,body,created_by)
  values(v_type,v_entity_id,p_parent_comment_id,btrim(p_body),v_actor_uid)
  returning comment_id into v_id;

  if p_mention_person_ids is not null then
    foreach v_person in array p_mention_person_ids loop
      if exists(select 1 from public.cmms_person where person_id=v_person and active=true and archived_at is null) then
        insert into public.cmms_comment_mention(comment_id,person_id) values(v_id,v_person) on conflict do nothing;
        insert into public.cmms_entity_watcher(entity_type,entity_id,person_id,watch_reason,created_by)
        values(v_type,v_entity_id,v_person,'MENTION',v_actor_uid) on conflict do nothing;
        insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
        values(v_person,'MENTION',v_type,v_entity_id,'You were mentioned',left(btrim(p_body),500),'HIGH',jsonb_build_object('commentId',v_id));
      end if;
    end loop;
  end if;

  insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,payload)
  select w.person_id,'COMMENT',w.entity_type,w.entity_id,'New comment',left(btrim(p_body),500),jsonb_build_object('commentId',v_id)
  from public.cmms_entity_watcher w
  join public.cmms_person p on p.person_id=w.person_id
  where w.entity_type=v_type and w.entity_id=v_entity_id
    and coalesce(p.auth_user_id,'00000000-0000-0000-0000-000000000000'::uuid)<>v_actor_uid
    and not exists(select 1 from public.cmms_comment_mention m where m.comment_id=v_id and m.person_id=w.person_id);

  v_actor:=coalesce(auth.jwt()->>'email',v_actor_uid::text);
  insert into public.cmms_activity_event(entity_type,entity_id,event_type,actor_user_id,actor_label,summary,detail)
  values(v_type,v_entity_id,'COMMENT_ADDED',v_actor_uid,v_actor,'Comment added',jsonb_build_object('commentId',v_id));
  return v_id;
end $$;
revoke all on function public.rpc_cmms_add_comment(text,text,text,uuid[],uuid) from public, anon;
grant execute on function public.rpc_cmms_add_comment(text,text,text,uuid[],uuid) to authenticated;

create or replace function public.rpc_cmms_watch_entity(
  p_entity_type text,p_entity_id text,p_person_id uuid,p_watch boolean default true,p_reason text default 'MANUAL'
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role public.app_role;
  v_self_person_id uuid;
  v_type text:=upper(btrim(coalesce(p_entity_type,'')));
  v_id text:=btrim(coalesce(p_entity_id,''));
  v_reason text:=upper(btrim(coalesce(p_reason,'MANUAL')));
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_type not in ('WORK_ORDER','REQUEST','ASSET','PM','PURCHASE_ORDER') then raise exception 'WATCH_ENTITY_TYPE_INVALID'; end if;
  if not public.cmms_entity_exists(v_type,v_id) then raise exception 'WATCH_ENTITY_NOT_FOUND'; end if;
  if not exists(select 1 from public.cmms_person where person_id=p_person_id and active=true and archived_at is null) then raise exception 'ACTIVE_WATCH_PERSON_NOT_FOUND'; end if;
  if v_reason not in ('MANUAL','ASSIGNEE','CREATOR','MENTION','APPROVER','TEAM') then raise exception 'WATCH_REASON_INVALID'; end if;

  select person_id into v_self_person_id from public.cmms_person
  where auth_user_id=v_uid and active=true and archived_at is null
  order by created_at limit 1;
  v_role:=public.current_app_role();
  if p_person_id is distinct from v_self_person_id and v_role not in ('SUPERVISOR','MANAGER','ADMIN') then
    raise exception 'WATCH_OTHER_PERSON_ROLE_DENIED';
  end if;

  if p_watch then
    insert into public.cmms_entity_watcher(entity_type,entity_id,person_id,watch_reason,created_by)
    values(v_type,v_id,p_person_id,v_reason,v_uid)
    on conflict(entity_type,entity_id,person_id) do update set watch_reason=excluded.watch_reason,created_by=excluded.created_by;
  else
    delete from public.cmms_entity_watcher where entity_type=v_type and entity_id=v_id and person_id=p_person_id;
  end if;
  return p_watch;
end $$;
revoke all on function public.rpc_cmms_watch_entity(text,text,uuid,boolean,text) from public, anon;
grant execute on function public.rpc_cmms_watch_entity(text,text,uuid,boolean,text) to authenticated;

create or replace function public.rpc_cmms_start_sla(
  p_entity_type text,p_entity_id text,p_priority text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role public.app_role;
  v_policy public.cmms_sla_policy%rowtype;
  v_id uuid;
  v_type text:=upper(btrim(coalesce(p_entity_type,'')));
  v_entity_id text:=btrim(coalesce(p_entity_id,''));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'SLA_START_ROLE_DENIED'; end if;
  if v_type not in ('WORK_ORDER','REQUEST') then raise exception 'SLA_ENTITY_TYPE_INVALID'; end if;
  if not public.cmms_entity_exists(v_type,v_entity_id) then raise exception 'SLA_ENTITY_NOT_FOUND'; end if;

  select * into v_policy from public.cmms_sla_policy
  where active=true and entity_type=v_type
    and (priority is null or priority=upper(btrim(coalesce(p_priority,''))))
  order by case when priority is null then 1 else 0 end,created_at desc limit 1;
  if not found then raise exception 'SLA_POLICY_NOT_FOUND'; end if;

  insert into public.cmms_sla_instance(
    sla_policy_id,entity_type,entity_id,started_at,response_due_at,resolution_due_at,status,
    responded_at,resolved_at,warning_sent_at,breached_at,response_warning_sent_at,resolution_warning_sent_at,response_breached_at,escalation_count,updated_at
  ) values(
    v_policy.sla_policy_id,v_type,v_entity_id,now(),
    case when v_policy.response_minutes is null then null else now()+make_interval(mins=>v_policy.response_minutes) end,
    case when v_policy.resolution_minutes is null then null else now()+make_interval(mins=>v_policy.resolution_minutes) end,
    'ACTIVE',null,null,null,null,null,null,null,0,now()
  )
  on conflict(entity_type,entity_id,sla_policy_id) do update set updated_at=now()
  returning sla_instance_id into v_id;
  return v_id;
end $$;
revoke all on function public.rpc_cmms_start_sla(text,text,text) from public, anon;
grant execute on function public.rpc_cmms_start_sla(text,text,text) to authenticated;

create or replace function public.rpc_cmms_mark_sla_responded(p_entity_type text,p_entity_id text)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if upper(btrim(p_entity_type)) not in ('WORK_ORDER','REQUEST') then raise exception 'SLA_ENTITY_TYPE_INVALID'; end if;
  update public.cmms_sla_instance
  set responded_at=coalesce(responded_at,now()),updated_at=now()
  where entity_type=upper(btrim(p_entity_type)) and entity_id=btrim(p_entity_id) and responded_at is null and resolved_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function public.rpc_cmms_mark_sla_responded(text,text) from public, anon;
grant execute on function public.rpc_cmms_mark_sla_responded(text,text) to authenticated;

create or replace function public.rpc_cmms_mark_sla_resolved(p_entity_type text,p_entity_id text)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_role public.app_role; v_count integer;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'SLA_RESOLVE_ROLE_DENIED'; end if;
  update public.cmms_sla_instance
  set responded_at=coalesce(responded_at,now()),resolved_at=coalesce(resolved_at,now()),
      status=case when breached_at is not null or response_breached_at is not null then 'BREACHED' else 'MET' end,
      updated_at=now()
  where entity_type=upper(btrim(p_entity_type)) and entity_id=btrim(p_entity_id) and resolved_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function public.rpc_cmms_mark_sla_resolved(text,text) from public, anon;
grant execute on function public.rpc_cmms_mark_sla_resolved(text,text) to authenticated;

create or replace function public.cmms_sync_sla_entity_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_type text;
  v_id text;
  v_status text;
  v_response boolean:=false;
  v_resolution boolean:=false;
begin
  if tg_table_name='maintenance_work_order' then
    v_type:='WORK_ORDER'; v_id:=new.work_order_id; v_status:=upper(coalesce(new.status,''));
    v_response:=v_status in ('WAITING_APPROVAL','APPROVED','IN_PROGRESS','COMPLETED','VERIFIED','RELEASED');
    v_resolution:=v_status in ('COMPLETED','VERIFIED','RELEASED');
  elsif tg_table_name='maintenance_request' then
    v_type:='REQUEST'; v_id:=new.request_id; v_status:=upper(coalesce(new.status,''));
    v_response:=v_status in ('UNDER_REVIEW','APPROVED','REJECTED','CONVERTED','CANCELLED');
    v_resolution:=v_status in ('REJECTED','CONVERTED','CANCELLED');
  else
    return new;
  end if;

  if v_response then
    update public.cmms_sla_instance set responded_at=coalesce(responded_at,now()),updated_at=now()
    where entity_type=v_type and entity_id=v_id and responded_at is null and resolved_at is null;
  end if;
  if v_resolution then
    update public.cmms_sla_instance
    set responded_at=coalesce(responded_at,now()),resolved_at=coalesce(resolved_at,now()),
        status=case when breached_at is not null or response_breached_at is not null then 'BREACHED' else 'MET' end,
        updated_at=now()
    where entity_type=v_type and entity_id=v_id and resolved_at is null;
  end if;
  return new;
end $$;
revoke all on function public.cmms_sync_sla_entity_status() from public, anon, authenticated;

drop trigger if exists trg_cmms_sync_sla_work_order_status on public.maintenance_work_order;
create trigger trg_cmms_sync_sla_work_order_status
after update of status on public.maintenance_work_order
for each row when (old.status is distinct from new.status)
execute function public.cmms_sync_sla_entity_status();

drop trigger if exists trg_cmms_sync_sla_request_status on public.maintenance_request;
create trigger trg_cmms_sync_sla_request_status
after update of status on public.maintenance_request
for each row when (old.status is distinct from new.status)
execute function public.cmms_sync_sla_entity_status();

create or replace function public.cmms_run_sla_escalation_internal(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  v_person uuid;
  v_response_warnings integer:=0;
  v_response_breaches integer:=0;
  v_resolution_warnings integer:=0;
  v_resolution_breaches integer:=0;
begin
  for r in
    select i.*,p.warning_percent,p.escalation_person_id,p.escalation_team_id
    from public.cmms_sla_instance i
    join public.cmms_sla_policy p on p.sla_policy_id=i.sla_policy_id
    where i.resolved_at is null and i.status in ('ACTIVE','WARNING','BREACHED')
  loop
    if r.responded_at is null and r.response_due_at is not null then
      if p_now>=r.response_due_at and r.response_breached_at is null then
        update public.cmms_sla_instance
        set status='BREACHED',response_breached_at=p_now,escalation_count=escalation_count+1,updated_at=p_now
        where sla_instance_id=r.sla_instance_id;
        v_response_breaches:=v_response_breaches+1;
        if r.escalation_person_id is not null then
          insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
          values(r.escalation_person_id,'SLA_BREACH',r.entity_type,r.entity_id,'Response SLA breached','Response SLA has been breached','URGENT',jsonb_build_object('slaInstanceId',r.sla_instance_id,'slaPhase','RESPONSE'));
        end if;
        if r.escalation_team_id is not null then
          for v_person in select person_id from public.cmms_team_member where team_id=r.escalation_team_id loop
            insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
            values(v_person,'ESCALATION',r.entity_type,r.entity_id,'Response SLA escalation','Response SLA has been breached','URGENT',jsonb_build_object('slaInstanceId',r.sla_instance_id,'slaPhase','RESPONSE'));
          end loop;
        end if;
        insert into public.cmms_activity_event(entity_type,entity_id,event_type,summary,detail)
        values(r.entity_type,r.entity_id,'SLA_RESPONSE_BREACH','Response SLA breached',jsonb_build_object('slaInstanceId',r.sla_instance_id));
      elsif r.response_warning_sent_at is null and p_now >= (r.started_at + ((r.response_due_at-r.started_at)*(r.warning_percent::numeric/100))) then
        update public.cmms_sla_instance
        set status=case when status='ACTIVE' then 'WARNING' else status end,response_warning_sent_at=p_now,warning_sent_at=coalesce(warning_sent_at,p_now),updated_at=p_now
        where sla_instance_id=r.sla_instance_id;
        v_response_warnings:=v_response_warnings+1;
        if r.escalation_person_id is not null then
          insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
          values(r.escalation_person_id,'SLA_WARNING',r.entity_type,r.entity_id,'Response SLA warning','Entity is approaching response SLA breach','HIGH',jsonb_build_object('slaInstanceId',r.sla_instance_id,'slaPhase','RESPONSE'));
        end if;
      end if;
    end if;

    if r.resolution_due_at is not null then
      if p_now>=r.resolution_due_at and r.breached_at is null then
        update public.cmms_sla_instance
        set status='BREACHED',breached_at=p_now,escalation_count=escalation_count+1,updated_at=p_now
        where sla_instance_id=r.sla_instance_id;
        v_resolution_breaches:=v_resolution_breaches+1;
        if r.escalation_person_id is not null then
          insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
          values(r.escalation_person_id,'SLA_BREACH',r.entity_type,r.entity_id,'Resolution SLA breached','Resolution SLA has been breached','URGENT',jsonb_build_object('slaInstanceId',r.sla_instance_id,'slaPhase','RESOLUTION'));
        end if;
        if r.escalation_team_id is not null then
          for v_person in select person_id from public.cmms_team_member where team_id=r.escalation_team_id loop
            insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
            values(v_person,'ESCALATION',r.entity_type,r.entity_id,'Resolution SLA escalation','Resolution SLA has been breached','URGENT',jsonb_build_object('slaInstanceId',r.sla_instance_id,'slaPhase','RESOLUTION'));
          end loop;
        end if;
        insert into public.cmms_activity_event(entity_type,entity_id,event_type,summary,detail)
        values(r.entity_type,r.entity_id,'SLA_RESOLUTION_BREACH','Resolution SLA breached',jsonb_build_object('slaInstanceId',r.sla_instance_id));
      elsif r.resolution_warning_sent_at is null and p_now >= (r.started_at + ((r.resolution_due_at-r.started_at)*(r.warning_percent::numeric/100))) then
        update public.cmms_sla_instance
        set status=case when status='ACTIVE' then 'WARNING' else status end,resolution_warning_sent_at=p_now,warning_sent_at=coalesce(warning_sent_at,p_now),updated_at=p_now
        where sla_instance_id=r.sla_instance_id;
        v_resolution_warnings:=v_resolution_warnings+1;
        if r.escalation_person_id is not null then
          insert into public.cmms_notification(person_id,notification_type,entity_type,entity_id,title,body,priority,payload)
          values(r.escalation_person_id,'SLA_WARNING',r.entity_type,r.entity_id,'Resolution SLA warning','Entity is approaching resolution SLA breach','HIGH',jsonb_build_object('slaInstanceId',r.sla_instance_id,'slaPhase','RESOLUTION'));
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'responseWarnings',v_response_warnings,
    'responseBreaches',v_response_breaches,
    'resolutionWarnings',v_resolution_warnings,
    'resolutionBreaches',v_resolution_breaches,
    'checkedAt',p_now
  );
end $$;
revoke all on function public.cmms_run_sla_escalation_internal(timestamptz) from public, anon, authenticated;

create or replace function public.rpc_cmms_run_sla_escalation(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_role public.app_role;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'SLA_ESCALATION_ROLE_DENIED'; end if;
  -- Caller-supplied p_now is intentionally ignored; trusted database time is used.
  return public.cmms_run_sla_escalation_internal(now());
end $$;
revoke all on function public.rpc_cmms_run_sla_escalation(timestamptz) from public, anon;
grant execute on function public.rpc_cmms_run_sla_escalation(timestamptz) to authenticated;

create extension if not exists pg_cron with schema extensions;
do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='cmms-sla-escalation' limit 1;
  if v_job is not null then perform cron.unschedule(v_job); end if;
  perform cron.schedule('cmms-sla-escalation','*/5 * * * *',
    $cron$select public.cmms_run_sla_escalation_internal(now());$cron$);
end $$;
