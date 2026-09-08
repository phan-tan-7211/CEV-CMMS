-- Contract checks for request -> work order foundation.
begin;

do $$
declare missing text[]:=array[]::text[]; n text;
begin
  foreach n in array array[
    'cmms_work_order_person_assignment','cmms_work_order_team_assignment','cmms_work_order_checklist_item',
    'cmms_work_order_part_usage','cmms_work_order_labor','cmms_work_order_attachment'
  ] loop
    if to_regclass('public.'||n) is null then missing:=array_append(missing,n); end if;
  end loop;
  if cardinality(missing)>0 then raise exception 'Missing WO tables: %',array_to_string(missing,', '); end if;
end $$;

do $$
begin
  if to_regprocedure('public.rpc_cmms_transition_request(text,text,text)') is null then raise exception 'rpc_cmms_transition_request missing'; end if;
  if to_regprocedure('public.rpc_cmms_convert_request_to_work_order(text,text,uuid,uuid)') is null then raise exception 'rpc_cmms_convert_request_to_work_order missing'; end if;
  if to_regprocedure('public.rpc_cmms_assign_work_order(text,uuid[],uuid[])') is null then raise exception 'rpc_cmms_assign_work_order missing'; end if;
  if to_regprocedure('public.rpc_cmms_add_checklist_item(text,text,text,text,boolean,integer)') is null then raise exception 'rpc_cmms_add_checklist_item missing'; end if;
  if to_regprocedure('public.rpc_cmms_complete_checklist_item(uuid,boolean,text,numeric)') is null then raise exception 'rpc_cmms_complete_checklist_item missing'; end if;
  if to_regprocedure('public.rpc_cmms_add_part_usage(text,text,numeric,text,numeric,text,text)') is null then raise exception 'rpc_cmms_add_part_usage missing'; end if;
  if to_regprocedure('public.rpc_cmms_add_labor(text,uuid,timestamptz,timestamptz,numeric,text)') is null then raise exception 'rpc_cmms_add_labor missing'; end if;
  if to_regprocedure('public.rpc_cmms_add_work_order_attachment(text,text,text,text,text,bigint,text)') is null then raise exception 'rpc_cmms_add_work_order_attachment missing'; end if;
  if to_regprocedure('public.rpc_cmms_work_order_detail(text)') is null then raise exception 'rpc_cmms_work_order_detail missing'; end if;
end $$;

do $$
declare missing text[]:=array[]::text[]; c text;
begin
  foreach c in array array['title','description','priority','requested_by_user_id','reviewed_by_user_id','reviewed_at','rejection_reason','converted_work_order_id','source_data'] loop
    if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='maintenance_request' and column_name=c) then missing:=array_append(missing,c); end if;
  end loop;
  if cardinality(missing)>0 then raise exception 'maintenance_request columns missing: %',array_to_string(missing,', '); end if;
end $$;

rollback;
