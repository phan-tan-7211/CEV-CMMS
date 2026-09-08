# CMMS Settings Backend

This contract persists the UpKeep-style settings surfaces now exposed in the mobile app.

## Shared organization settings

Singleton `cmms_organization_settings` stores company-wide defaults:
- language
- date format
- currency
- timezone
- automation toggle
- multi-site toggle

All authenticated users may read these values. Only `ADMIN` may mutate them through `rpc_cmms_update_organization_settings`.

## Module settings

Singleton `cmms_module_settings` stores enablement for Assets, Parts & Inventory, Requests, Work Orders, Purchase Orders, Meters and Tags. All authenticated users may read. Only `ADMIN` may mutate through `rpc_cmms_update_module_settings`.

## Work Order settings

Singleton `cmms_work_order_settings` stores feedback, completion-note requirement, number start count, forms, custom statuses, custom fields and categories. All authenticated users may read. Only `ADMIN` may mutate through `rpc_cmms_update_work_order_settings`.

## User dashboard preferences

`cmms_user_dashboard_preference` is keyed by `auth.users.id`. RLS permits a user to read/insert/update only their own row. `rpc_cmms_save_dashboard_preference` validates supported Work Order dashboard card identifiers before persisting.

## Mobile integration

`apps/mobile/src/features/settings/api/settingsService.ts` exposes the settings bundle and mutation helpers. Organization, Module and Work Order settings screens now persist through RPCs. Work Order Edit Dashboard persists the selected cards per account.

## Security boundary

- Public tables have RLS enabled.
- Shared settings have read-only Data API grants; writes are RPC-only.
- Admin mutation RPCs are `SECURITY DEFINER`, explicitly check `auth.uid()` and `current_app_role() = 'ADMIN'`, revoke execute from `PUBLIC`/`anon`, and grant execute to `authenticated`.
- Dashboard preference writes are `SECURITY INVOKER` and protected by self-row RLS.

## Production cutover note

The connected production database contains the legacy/base schema but currently reports no Supabase migration history and no `cmms_*` tables. Do not replay migrations `001..069` blindly. Verify prerequisites, then apply the additive CMMS chain `070..082` in order. Stop at the first error and inspect schema drift before continuing.
