do $$
begin
  if to_regprocedure('public.rpc_cmms_create_work_order_v2(jsonb)') is null then raise exception 'MISSING_RPC: rpc_cmms_create_work_order_v2(jsonb)'; end if;
  if to_regprocedure('public.rpc_cmms_create_request_v2(jsonb)') is null then raise exception 'MISSING_RPC: rpc_cmms_create_request_v2(jsonb)'; end if;
  if to_regprocedure('public.rpc_cmms_location_picker(text,uuid,text,boolean,integer,integer)') is null then raise exception 'MISSING_RPC: rpc_cmms_location_picker'; end if;
  if to_regprocedure('public.rpc_cmms_people_picker(text,text[],boolean,text,integer,integer)') is null then raise exception 'MISSING_RPC: rpc_cmms_people_picker'; end if;
  if to_regprocedure('public.rpc_cmms_team_picker(text,boolean,text,integer,integer)') is null then raise exception 'MISSING_RPC: rpc_cmms_team_picker'; end if;
  if to_regprocedure('public.rpc_cmms_party_picker(text,text,boolean,text,integer,integer)') is null then raise exception 'MISSING_RPC: rpc_cmms_party_picker'; end if;
end $$;
