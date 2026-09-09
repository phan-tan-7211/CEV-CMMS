-- Contract checks for Work Order timer + draft foundation.

do $$
declare
  v_missing text[];
begin
  select array_agg(name order by name) into v_missing
  from (values
    ('rpc_cmms_work_order_timer_state'),
    ('rpc_cmms_work_order_timer_start'),
    ('rpc_cmms_work_order_timer_pause'),
    ('rpc_cmms_work_order_timer_resume'),
    ('rpc_cmms_work_order_timer_stop'),
    ('rpc_cmms_work_order_timer_cancel'),
    ('rpc_cmms_save_work_order_draft'),
    ('rpc_cmms_work_order_drafts'),
    ('rpc_cmms_discard_work_order_draft')
  ) expected(name)
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=expected.name
  );
  if v_missing is not null then raise exception 'Missing timer/draft RPCs: %',v_missing; end if;
end $$;

select 1/(case when exists(
  select 1 from information_schema.columns
  where table_schema='public' and table_name='cmms_work_order_labor' and column_name='exact_seconds'
) then 1 else 0 end);

select 1/(case when exists(
  select 1 from pg_indexes
  where schemaname='public' and indexname='cmms_work_order_timer_one_active_person_idx'
) then 1 else 0 end);

select 1/(case when has_function_privilege('authenticated','public.rpc_cmms_work_order_timer_start(text,numeric,text)','EXECUTE') then 1 else 0 end);
select 1/(case when not has_function_privilege('anon','public.rpc_cmms_work_order_timer_start(text,numeric,text)','EXECUTE') then 1 else 0 end);
