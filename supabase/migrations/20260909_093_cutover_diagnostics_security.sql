-- rpc_cutover_diagnostics is an internal cutover utility, not an application RPC.
-- No Mobile/Web code references it. Remove signed-in Data API execution and keep
-- owner/service access only.

revoke execute on function public.rpc_cutover_diagnostics() from public, anon, authenticated;
grant execute on function public.rpc_cutover_diagnostics() to service_role;
