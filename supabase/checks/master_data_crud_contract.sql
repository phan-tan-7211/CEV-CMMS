do $$
begin
  if to_regprocedure('public.rpc_cmms_upsert_location(jsonb)') is null then raise exception 'missing rpc_cmms_upsert_location(jsonb)'; end if;
  if to_regprocedure('public.rpc_cmms_archive_location(uuid,boolean)') is null then raise exception 'missing rpc_cmms_archive_location(uuid,boolean)'; end if;
  if to_regprocedure('public.rpc_cmms_upsert_business_party(jsonb)') is null then raise exception 'missing rpc_cmms_upsert_business_party(jsonb)'; end if;
  if to_regprocedure('public.rpc_cmms_archive_business_party(uuid,boolean)') is null then raise exception 'missing rpc_cmms_archive_business_party(uuid,boolean)'; end if;
end $$;
