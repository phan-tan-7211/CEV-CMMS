-- Contract checks for 20260909_086_work_order_review_assignment_hardening.sql

do $$
begin
  if to_regprocedure('public.rpc_cmms_set_work_order_review_assignments(text,uuid[],uuid[],uuid[])') is null then
    raise exception 'missing rpc_cmms_set_work_order_review_assignments';
  end if;
  if to_regprocedure('public.rpc_save_maintenance_execution(text,jsonb,text)') is null then
    raise exception 'missing rpc_save_maintenance_execution';
  end if;
  if to_regprocedure('public.rpc_transition_maintenance(text,text,text)') is null then
    raise exception 'missing rpc_transition_maintenance';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.cmms_work_order_person_assignment'::regclass
      and conname='cmms_wo_person_role_valid'
  ) then
    raise exception 'missing work order person role constraint';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid='public.cmms_person'::regclass
      and attname='auth_user_id' and not attisdropped
  ) then
    raise exception 'cmms_person.auth_user_id required';
  end if;
end $$;
