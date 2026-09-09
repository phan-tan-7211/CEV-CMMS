-- Final core parity: custom WO statuses, feedback, provider portal sharing, analytics snapshot
create table if not exists public.cmms_work_order_custom_status (
  status_code text primary key,
  display_name text not null,
  canonical_status text not null,
  color text not null default '#667085',
  sort_order integer not null default 100,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_work_order_custom_status_canonical_chk check (canonical_status in ('OPEN','WAITING_APPROVAL','APPROVED','IN_PROGRESS','COMPLETED','VERIFIED','RELEASED','CANCELLED'))
);

create table if not exists public.cmms_work_order_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  rating smallint not null,
  comment text,
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  constraint cmms_work_order_feedback_rating_chk check (rating between 1 and 5)
);
create index if not exists cmms_work_order_feedback_wo_idx on public.cmms_work_order_feedback(work_order_id, submitted_at desc);

create table if not exists public.cmms_provider_work_order_share (
  share_id uuid primary key default gen_random_uuid(),
  work_order_id text not null references public.maintenance_work_order(work_order_id) on delete cascade,
  provider_id uuid not null references public.cmms_business_party(party_id),
  share_token uuid not null default gen_random_uuid() unique,
  status text not null default 'SHARED',
  permissions jsonb not null default '{"canComment":true,"canUpdateProgress":true}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  acknowledged_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cmms_provider_work_order_share_status_chk check (status in ('SHARED','ACKNOWLEDGED','IN_PROGRESS','COMPLETED','REVOKED'))
);
create index if not exists cmms_provider_work_order_share_wo_idx on public.cmms_provider_work_order_share(work_order_id, created_at desc);
create index if not exists cmms_provider_work_order_share_provider_idx on public.cmms_provider_work_order_share(provider_id, created_at desc);

create table if not exists public.cmms_provider_portal_activity (
  activity_id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.cmms_provider_work_order_share(share_id) on delete cascade,
  action text not null,
  note text,
  actor_label text,
  created_at timestamptz not null default now()
);
create index if not exists cmms_provider_portal_activity_share_idx on public.cmms_provider_portal_activity(share_id, created_at desc);

alter table public.cmms_work_order_custom_status enable row level security;
alter table public.cmms_work_order_feedback enable row level security;
alter table public.cmms_provider_work_order_share enable row level security;
alter table public.cmms_provider_portal_activity enable row level security;
revoke all on public.cmms_work_order_custom_status from anon, public;
revoke all on public.cmms_work_order_feedback from anon, public;
revoke all on public.cmms_provider_work_order_share from anon, public;
revoke all on public.cmms_provider_portal_activity from anon, public;
grant select on public.cmms_work_order_custom_status to authenticated;
grant select, insert on public.cmms_work_order_feedback to authenticated;
grant select on public.cmms_provider_work_order_share to authenticated;
grant select on public.cmms_provider_portal_activity to authenticated;

create or replace function public.rpc_cmms_final_parity_snapshot(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_limit integer:=greatest(1,least(coalesce(p_limit,100),500)); v_result jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select jsonb_build_object(
  'customStatuses',coalesce((select jsonb_agg(jsonb_build_object('statusCode',s.status_code,'displayName',s.display_name,'canonicalStatus',s.canonical_status,'color',s.color,'sortOrder',s.sort_order,'active',s.active) order by s.sort_order,s.display_name) from public.cmms_work_order_custom_status s where s.active),'[]'::jsonb),
  'feedback',coalesce((select jsonb_agg(x order by (x->>'submittedAt') desc) from (select jsonb_build_object('feedbackId',f.feedback_id,'workOrderId',f.work_order_id,'rating',f.rating,'comment',coalesce(f.comment,''),'submittedAt',f.submitted_at)x from public.cmms_work_order_feedback f order by f.submitted_at desc limit v_limit)q),'[]'::jsonb),
  'providers',coalesce((select jsonb_agg(jsonb_build_object('partyId',p.party_id,'companyName',p.company_name,'contactName',coalesce(p.contact_name,''),'email',coalesce(p.email,''),'phone',coalesce(p.phone,''),'partyKind',p.party_kind) order by p.company_name) from public.cmms_business_party p where p.active and p.archived_at is null and upper(coalesce(p.party_kind,'')) in ('VENDOR','CONTRACTOR','PROVIDER')),'[]'::jsonb),
  'providerShares',coalesce((select jsonb_agg(x order by (x->>'createdAt') desc) from (select jsonb_build_object('shareId',s.share_id,'workOrderId',s.work_order_id,'providerId',s.provider_id,'providerName',p.company_name,'token',s.share_token,'status',s.status,'expiresAt',s.expires_at,'createdAt',s.created_at,'revokedAt',s.revoked_at)x from public.cmms_provider_work_order_share s join public.cmms_business_party p on p.party_id=s.provider_id order by s.created_at desc limit v_limit)q),'[]'::jsonb),
  'recentCompletedWorkOrders',coalesce((select jsonb_agg(jsonb_build_object('workOrderId',w.work_order_id,'equipmentId',w.equipment_id,'status',w.status,'reason',coalesce(w.reason,''),'updatedAt',w.updated_at) order by w.updated_at desc) from (select * from public.maintenance_work_order where status in ('COMPLETED','VERIFIED','RELEASED') order by updated_at desc limit 100)w),'[]'::jsonb),
  'reliability',coalesce((select jsonb_agg(jsonb_build_object('equipmentId',r.equipment_id,'equipmentName',r.equipment_name,'status',r.status,'locationName',coalesce(r.location_name,''),'failureCount',r.failure_count,'downtimeHours',r.downtime_hours,'mttrHours',r.mttr_hours,'mtbfHours',r.mtbf_hours) order by r.failure_count desc,r.downtime_hours desc) from (select * from public.cmms_analytics_asset_reliability_v order by failure_count desc nulls last,downtime_hours desc nulls last limit 100)r),'[]'::jsonb),
  'workOrderCost',coalesce((select jsonb_agg(jsonb_build_object('workOrderId',c.work_order_id,'equipmentId',c.equipment_id,'equipmentName',c.equipment_name,'status',c.status,'priority',c.priority,'partsCost',c.parts_cost,'laborCost',c.labor_cost,'laborMinutes',c.labor_minutes,'totalCost',c.total_cost) order by c.total_cost desc) from (select * from public.cmms_analytics_work_order_cost_v order by total_cost desc nulls last limit 100)c),'[]'::jsonb),
  'downtime',coalesce((select jsonb_agg(jsonb_build_object('downtimeId',d.downtime_id,'equipmentId',d.equipment_id,'equipmentName',d.equipment_name,'locationName',coalesce(d.location_name,''),'workOrderId',d.work_order_id,'startedAt',d.started_at,'endedAt',d.ended_at,'downtimeMinutes',d.downtime_minutes,'isOpen',d.is_open) order by d.started_at desc) from (select * from public.cmms_analytics_downtime_event_v order by started_at desc limit 100)d),'[]'::jsonb)
 ) into v_result; return v_result;
end $$;

create or replace function public.rpc_cmms_save_work_order_custom_status(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text:=coalesce(public.current_app_role()::text,''); v_code text:=upper(regexp_replace(trim(coalesce(p_input->>'statusCode','')),'[^A-Za-z0-9_]+','_','g')); v_name text:=trim(coalesce(p_input->>'displayName','')); v_canonical text:=upper(trim(coalesce(p_input->>'canonicalStatus','OPEN'))); v_color text:=coalesce(nullif(trim(p_input->>'color'),''),'#667085'); v_sort integer:=coalesce((p_input->>'sortOrder')::integer,100);
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_REQUIRED'; end if;
 if v_code='' or v_name='' then raise exception 'STATUS_CODE_AND_NAME_REQUIRED'; end if;
 if v_canonical not in ('OPEN','WAITING_APPROVAL','APPROVED','IN_PROGRESS','COMPLETED','VERIFIED','RELEASED','CANCELLED') then raise exception 'INVALID_CANONICAL_STATUS'; end if;
 insert into public.cmms_work_order_custom_status(status_code,display_name,canonical_status,color,sort_order,active,created_by) values(v_code,v_name,v_canonical,v_color,v_sort,coalesce((p_input->>'active')::boolean,true),auth.uid()) on conflict(status_code) do update set display_name=excluded.display_name,canonical_status=excluded.canonical_status,color=excluded.color,sort_order=excluded.sort_order,active=excluded.active,updated_at=now();
 return jsonb_build_object('statusCode',v_code);
end $$;

create or replace function public.rpc_cmms_set_work_order_custom_status(p_work_order_id text,p_status_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_status record;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; select * into v_status from public.cmms_work_order_custom_status where status_code=upper(trim(p_status_code)) and active; if not found then raise exception 'CUSTOM_STATUS_NOT_FOUND'; end if;
 update public.maintenance_work_order set source_data=jsonb_set(coalesce(source_data,'{}'::jsonb),'{custom_status_code}',to_jsonb(v_status.status_code),true),updated_at=now() where work_order_id=p_work_order_id; if not found then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
 return jsonb_build_object('workOrderId',p_work_order_id,'statusCode',v_status.status_code,'canonicalStatus',v_status.canonical_status);
end $$;

create or replace function public.rpc_cmms_submit_work_order_feedback(p_work_order_id text,p_rating integer,p_comment text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if p_rating<1 or p_rating>5 then raise exception 'RATING_RANGE_1_5'; end if; if not exists(select 1 from public.maintenance_work_order where work_order_id=p_work_order_id) then raise exception 'WORK_ORDER_NOT_FOUND'; end if;
 insert into public.cmms_work_order_feedback(work_order_id,rating,comment,submitted_by) values(p_work_order_id,p_rating,nullif(trim(coalesce(p_comment,'')),''),auth.uid()) returning feedback_id into v_id; return jsonb_build_object('feedbackId',v_id);
end $$;

create or replace function public.rpc_cmms_create_provider_share(p_work_order_id text,p_provider_id uuid,p_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text:=coalesce(public.current_app_role()::text,''); v_id uuid; v_token uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_REQUIRED'; end if;
 if not exists(select 1 from public.maintenance_work_order where work_order_id=p_work_order_id) then raise exception 'WORK_ORDER_NOT_FOUND'; end if; if not exists(select 1 from public.cmms_business_party where party_id=p_provider_id and active and archived_at is null) then raise exception 'PROVIDER_NOT_FOUND'; end if;
 insert into public.cmms_provider_work_order_share(work_order_id,provider_id,expires_at,created_by) values(p_work_order_id,p_provider_id,p_expires_at,auth.uid()) returning share_id,share_token into v_id,v_token; insert into public.cmms_provider_portal_activity(share_id,action,actor_label) values(v_id,'SHARED','CEV'); return jsonb_build_object('shareId',v_id,'token',v_token);
end $$;

create or replace function public.rpc_cmms_revoke_provider_share(p_share_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text:=coalesce(public.current_app_role()::text,'');
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if; if v_role not in ('SUPERVISOR','MANAGER','ADMIN') then raise exception 'ROLE_REQUIRED'; end if; update public.cmms_provider_work_order_share set status='REVOKED',revoked_at=now(),updated_at=now() where share_id=p_share_id and revoked_at is null; if not found then raise exception 'SHARE_NOT_FOUND_OR_REVOKED'; end if; insert into public.cmms_provider_portal_activity(share_id,action,actor_label) values(p_share_id,'REVOKED','CEV'); return jsonb_build_object('shareId',p_share_id,'status','REVOKED');
end $$;

create or replace function public.rpc_cmms_provider_portal_snapshot(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_share record; v_result jsonb;
begin
 select s.*,p.company_name,p.contact_name,w.equipment_id,w.reason,w.priority,w.status as work_order_status,e.equipment_name into v_share from public.cmms_provider_work_order_share s join public.cmms_business_party p on p.party_id=s.provider_id join public.maintenance_work_order w on w.work_order_id=s.work_order_id left join public.equipment_master e on e.equipment_id=w.equipment_id where s.share_token=p_token and s.revoked_at is null and (s.expires_at is null or s.expires_at>now()); if not found then raise exception 'PROVIDER_SHARE_INVALID_OR_EXPIRED'; end if;
 select jsonb_build_object('shareId',v_share.share_id,'workOrderId',v_share.work_order_id,'providerName',v_share.company_name,'contactName',coalesce(v_share.contact_name,''),'shareStatus',v_share.status,'workOrderStatus',v_share.work_order_status,'equipmentId',v_share.equipment_id,'equipmentName',coalesce(v_share.equipment_name,''),'reason',coalesce(v_share.reason,''),'priority',v_share.priority,'expiresAt',v_share.expires_at,'activity',coalesce((select jsonb_agg(jsonb_build_object('action',a.action,'note',coalesce(a.note,''),'actorLabel',coalesce(a.actor_label,''),'createdAt',a.created_at) order by a.created_at desc) from public.cmms_provider_portal_activity a where a.share_id=v_share.share_id),'[]'::jsonb)) into v_result; return v_result;
end $$;

create or replace function public.rpc_cmms_provider_portal_action(p_token uuid,p_action text,p_note text default null,p_actor_label text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_share record; v_action text:=upper(trim(coalesce(p_action,''))); v_status text;
begin
 select * into v_share from public.cmms_provider_work_order_share s where s.share_token=p_token and s.revoked_at is null and (s.expires_at is null or s.expires_at>now()); if not found then raise exception 'PROVIDER_SHARE_INVALID_OR_EXPIRED'; end if; if v_action not in ('ACKNOWLEDGE','START','COMPLETE','COMMENT') then raise exception 'INVALID_PROVIDER_ACTION'; end if;
 if v_action='ACKNOWLEDGE' then update public.cmms_provider_work_order_share set status='ACKNOWLEDGED',acknowledged_at=coalesce(acknowledged_at,now()),updated_at=now() where share_id=v_share.share_id; v_status:='ACKNOWLEDGED'; elsif v_action='START' then update public.cmms_provider_work_order_share set status='IN_PROGRESS',started_at=coalesce(started_at,now()),updated_at=now() where share_id=v_share.share_id; v_status:='IN_PROGRESS'; elsif v_action='COMPLETE' then update public.cmms_provider_work_order_share set status='COMPLETED',completed_at=coalesce(completed_at,now()),updated_at=now() where share_id=v_share.share_id; v_status:='COMPLETED'; else v_status:=v_share.status; end if;
 insert into public.cmms_provider_portal_activity(share_id,action,note,actor_label) values(v_share.share_id,v_action,nullif(trim(coalesce(p_note,'')),''),nullif(trim(coalesce(p_actor_label,'')),'')); return jsonb_build_object('shareId',v_share.share_id,'status',v_status,'action',v_action);
end $$;

revoke all on function public.rpc_cmms_final_parity_snapshot(integer) from public,anon;
revoke all on function public.rpc_cmms_save_work_order_custom_status(jsonb) from public,anon;
revoke all on function public.rpc_cmms_set_work_order_custom_status(text,text) from public,anon;
revoke all on function public.rpc_cmms_submit_work_order_feedback(text,integer,text) from public,anon;
revoke all on function public.rpc_cmms_create_provider_share(text,uuid,timestamptz) from public,anon;
revoke all on function public.rpc_cmms_revoke_provider_share(uuid) from public,anon;
revoke all on function public.rpc_cmms_provider_portal_snapshot(uuid) from public;
revoke all on function public.rpc_cmms_provider_portal_action(uuid,text,text,text) from public;
grant execute on function public.rpc_cmms_final_parity_snapshot(integer) to authenticated;
grant execute on function public.rpc_cmms_save_work_order_custom_status(jsonb) to authenticated;
grant execute on function public.rpc_cmms_set_work_order_custom_status(text,text) to authenticated;
grant execute on function public.rpc_cmms_submit_work_order_feedback(text,integer,text) to authenticated;
grant execute on function public.rpc_cmms_create_provider_share(text,uuid,timestamptz) to authenticated;
grant execute on function public.rpc_cmms_revoke_provider_share(uuid) to authenticated;
grant execute on function public.rpc_cmms_provider_portal_snapshot(uuid) to anon,authenticated;
grant execute on function public.rpc_cmms_provider_portal_action(uuid,text,text,text) to anon,authenticated;
