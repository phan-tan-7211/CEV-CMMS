begin;

do $$
declare missing text[]:=array[]::text[]; n text;
begin
  foreach n in array array[
    'cmms_entity_comment','cmms_entity_watcher','cmms_comment_mention','cmms_notification',
    'cmms_activity_event','cmms_sla_policy','cmms_sla_instance'
  ] loop
    if to_regclass('public.'||n) is null then missing:=array_append(missing,n); end if;
  end loop;
  if cardinality(missing)>0 then raise exception 'Missing collaboration tables: %',array_to_string(missing,', '); end if;
end $$;

do $$
begin
  if to_regprocedure('public.rpc_cmms_add_comment(text,text,text,uuid[],uuid)') is null then raise exception 'rpc_cmms_add_comment missing'; end if;
  if to_regprocedure('public.rpc_cmms_watch_entity(text,text,uuid,boolean,text)') is null then raise exception 'rpc_cmms_watch_entity missing'; end if;
  if to_regprocedure('public.rpc_cmms_notification_inbox(boolean,integer,integer)') is null then raise exception 'rpc_cmms_notification_inbox missing'; end if;
  if to_regprocedure('public.rpc_cmms_mark_notification_read(uuid)') is null then raise exception 'rpc_cmms_mark_notification_read missing'; end if;
  if to_regprocedure('public.rpc_cmms_start_sla(text,text,text)') is null then raise exception 'rpc_cmms_start_sla missing'; end if;
  if to_regprocedure('public.rpc_cmms_run_sla_escalation(timestamptz)') is null then raise exception 'rpc_cmms_run_sla_escalation missing'; end if;
end $$;

do $$
declare bad text[];
begin
  select array_agg(c.relname order by c.relname) into bad
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array[
    'cmms_entity_comment','cmms_entity_watcher','cmms_comment_mention','cmms_notification',
    'cmms_activity_event','cmms_sla_policy','cmms_sla_instance']) and not c.relrowsecurity;
  if coalesce(cardinality(bad),0)>0 then raise exception 'RLS disabled on: %',array_to_string(bad,', '); end if;
end $$;

rollback;
