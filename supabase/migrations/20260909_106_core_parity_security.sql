alter table public.cmms_custom_field_definition enable row level security;
alter table public.cmms_custom_field_value enable row level security;
alter table public.cmms_file_library enable row level security;
alter table public.cmms_file_link enable row level security;
alter table public.cmms_floor_plan enable row level security;
alter table public.cmms_floor_plan_pin enable row level security;

revoke all on public.cmms_custom_field_definition, public.cmms_custom_field_value, public.cmms_file_library, public.cmms_file_link, public.cmms_floor_plan, public.cmms_floor_plan_pin from anon;

revoke execute on function public.rpc_cmms_checklist_templates(text), public.rpc_cmms_custom_fields(text), public.rpc_cmms_file_library(text,text,text), public.rpc_cmms_floor_plans(uuid), public.rpc_cmms_downtime_history(text) from public, anon;
grant execute on function public.rpc_cmms_checklist_templates(text), public.rpc_cmms_custom_fields(text), public.rpc_cmms_file_library(text,text,text), public.rpc_cmms_floor_plans(uuid), public.rpc_cmms_downtime_history(text) to authenticated;
