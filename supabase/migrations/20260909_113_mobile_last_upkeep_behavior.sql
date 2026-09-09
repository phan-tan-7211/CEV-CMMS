alter table public.cmms_work_order_checklist_item add column if not exists template_item_id uuid references public.cmms_checklist_template_item(template_item_id) on delete set null;
create index if not exists cmms_wo_checklist_template_item_idx on public.cmms_work_order_checklist_item(template_item_id);

create or replace function public.rpc_cmms_apply_checklist_template_to_work_order(p_work_order_id text, p_template_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_count int:=0; v_base int:=0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role()::text;
  if v_role not in ('MAINTENANCE','SUPERVISOR','MANAGER','ADMIN') then raise exception 'CHECKLIST_APPLY_ROLE_DENIED'; end if;
  if not exists(select 1 from public.cmms_checklist_template where template_id=p_template_id and archived_at is null and active) then raise exception 'CHECKLIST_TEMPLATE_NOT_FOUND'; end if;
  select coalesce(max(sequence_no),0) into v_base from public.cmms_work_order_checklist_item where work_order_id=p_work_order_id;
  insert into public.cmms_work_order_checklist_item(work_order_id,sequence_no,title,description,response_type,required,template_item_id)
  select p_work_order_id,v_base+row_number() over(order by i.sequence_no),i.label,i.description,i.item_type,i.required,i.template_item_id
  from public.cmms_checklist_template_item i where i.template_id=p_template_id order by i.sequence_no;
  get diagnostics v_count=row_count;
  return jsonb_build_object('workOrderId',p_work_order_id,'templateId',p_template_id,'appliedCount',v_count);
end $$;

create or replace function public.cmms_capture_pm_template_item()
returns trigger language plpgsql set search_path=public as $$
declare v_template uuid;
begin
  if new.template_item_id is not null then return new; end if;
  select s.checklist_template_id into v_template
  from public.maintenance_work_order w
  join public.cmms_pm_schedule s on s.schedule_id = nullif(w.source_data->>'pmScheduleId','')::uuid
  where w.work_order_id=new.work_order_id
  limit 1;
  if v_template is not null then
    select i.template_item_id into new.template_item_id
    from public.cmms_checklist_template_item i
    where i.template_id=v_template and (i.sequence_no=new.sequence_no or i.label=new.title)
    order by case when i.sequence_no=new.sequence_no then 0 else 1 end
    limit 1;
  end if;
  return new;
exception when others then return new;
end $$;
drop trigger if exists trg_cmms_capture_pm_template_item on public.cmms_work_order_checklist_item;
create trigger trg_cmms_capture_pm_template_item before insert on public.cmms_work_order_checklist_item for each row execute function public.cmms_capture_pm_template_item();

create or replace function public.cmms_enforce_work_order_signature()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.status='IN_PROGRESS' and new.status='COMPLETED'
     and exists(select 1 from public.cmms_work_order_signature_requirement r where r.work_order_id=new.work_order_id and r.required=true)
     and not exists(select 1 from public.cmms_work_order_signature s where s.work_order_id=new.work_order_id) then
    raise exception 'WORK_ORDER_SIGNATURE_REQUIRED';
  end if;
  return new;
end $$;
drop trigger if exists trg_cmms_enforce_work_order_signature on public.maintenance_work_order;
create trigger trg_cmms_enforce_work_order_signature before update of status on public.maintenance_work_order for each row execute function public.cmms_enforce_work_order_signature();

create or replace function public.cmms_check_condition(p_work_order_id text,p_template_item_id uuid,p_operator text,p_expected text)
returns boolean language plpgsql stable set search_path=public as $$
declare v_item public.cmms_work_order_checklist_item%rowtype; v_actual text; v_num numeric; v_expected_num numeric;
begin
  if p_template_item_id is null then return true; end if;
  select * into v_item from public.cmms_work_order_checklist_item where work_order_id=p_work_order_id and template_item_id=p_template_item_id limit 1;
  if not found then return false; end if;
  v_actual:=coalesce(v_item.response_text,case when v_item.response_number is not null then v_item.response_number::text else case when v_item.completed then 'true' else 'false' end end);
  case upper(coalesce(p_operator,'EQUALS'))
    when 'EQUALS' then return lower(coalesce(v_actual,''))=lower(coalesce(p_expected,''));
    when 'NOT_EQUALS' then return lower(coalesce(v_actual,''))<>lower(coalesce(p_expected,''));
    when 'CONTAINS' then return position(lower(coalesce(p_expected,'')) in lower(coalesce(v_actual,'')))>0;
    when 'GT' then begin v_num:=v_actual::numeric; v_expected_num:=p_expected::numeric; return v_num>v_expected_num; exception when others then return false; end;
    when 'GTE' then begin v_num:=v_actual::numeric; v_expected_num:=p_expected::numeric; return v_num>=v_expected_num; exception when others then return false; end;
    when 'LT' then begin v_num:=v_actual::numeric; v_expected_num:=p_expected::numeric; return v_num<v_expected_num; exception when others then return false; end;
    when 'LTE' then begin v_num:=v_actual::numeric; v_expected_num:=p_expected::numeric; return v_num<=v_expected_num; exception when others then return false; end;
    else return false;
  end case;
end $$;

create or replace function public.rpc_cmms_complete_checklist_item(p_checklist_item_id uuid, p_completed boolean, p_response_text text default null, p_response_number numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role public.app_role; v_item public.cmms_work_order_checklist_item%rowtype; v_rule public.cmms_checklist_template_rule%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_role:=public.current_app_role();
  if v_role not in ('MAINTENANCE','SUPERVISOR','QUALITY','MANAGER','ADMIN') then raise exception 'WORK_ORDER_EXECUTE_ROLE_DENIED'; end if;
  select * into v_item from public.cmms_work_order_checklist_item where checklist_item_id=p_checklist_item_id for update;
  if not found then raise exception 'CHECKLIST_ITEM_NOT_FOUND'; end if;
  if v_item.template_item_id is not null then
    select * into v_rule from public.cmms_checklist_template_rule where template_item_id=v_item.template_item_id;
    if found then
      if v_rule.locked and coalesce(v_rule.restricted_role,'')='' and v_role not in ('MANAGER','ADMIN') then raise exception 'CHECKLIST_ITEM_LOCKED'; end if;
      if v_rule.locked and coalesce(v_rule.restricted_role,'')<>'' and v_role::text<>upper(v_rule.restricted_role) and v_role not in ('MANAGER','ADMIN') then raise exception 'CHECKLIST_ITEM_ROLE_RESTRICTED'; end if;
      if coalesce(p_completed,false) and v_rule.condition_item_id is not null and not public.cmms_check_condition(v_item.work_order_id,v_rule.condition_item_id,v_rule.condition_operator,v_rule.condition_value) then raise exception 'CHECKLIST_CONDITION_NOT_MET'; end if;
    end if;
  end if;
  update public.cmms_work_order_checklist_item
  set completed=coalesce(p_completed,false),response_text=p_response_text,response_number=p_response_number,
      completed_by=case when p_completed then auth.uid() else null end,completed_at=case when p_completed then now() else null end
  where checklist_item_id=p_checklist_item_id;
  return jsonb_build_object('checklistItemId',p_checklist_item_id,'completed',coalesce(p_completed,false));
end $$;
revoke all on function public.cmms_check_condition(text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.cmms_capture_pm_template_item() from public,anon,authenticated;
revoke all on function public.cmms_enforce_work_order_signature() from public,anon,authenticated;
revoke all on function public.rpc_cmms_complete_checklist_item(uuid,boolean,text,numeric) from public,anon;
grant execute on function public.rpc_cmms_complete_checklist_item(uuid,boolean,text,numeric) to authenticated;
