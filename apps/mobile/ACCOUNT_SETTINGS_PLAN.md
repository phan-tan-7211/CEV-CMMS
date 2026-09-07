# CEV CMMS Account Settings plan

Reference direction: learn the interaction density and multi-screen settings flow from UpKeep / Atlas / Grash while keeping CEV-owned code, branding, icons and assets.

## Batch 1 — implemented

- Home gear opens a dedicated Account Settings route.
- Account root with profile header and grouped native rows.
- Profile: display name and phone editable by the signed-in user through Supabase Auth metadata.
- Organization fields: Department, Role and Site visible but read-only for non-admin UI.
- Notification preferences: independent toggles for assigned Work Orders, overdue Work Orders, upcoming PM, equipment incidents and system notifications.
- Language architecture: Vietnamese active; Korean and English represented but disabled until translation resources are added.
- Security: signed-in user can change password.
- About: app/company/version information.
- Sign out remains available from Account Settings.

## Next data batches

1. Avatar upload: add an approved profile/avatar storage bucket and RLS policy; then replace the current placeholder action with image-picker + upload + server-backed URL.
2. Notification preference backend: add account-scoped persistence and push-delivery integration; migrate local AsyncStorage values.
3. Organization authorization: load Department / Role / Site from the canonical profile source and expose admin-only edit screens/RPCs.
4. i18n resources: move Vietnamese strings behind translation keys, then enable Korean and English.
5. Device/session management if required by CEV security policy.

## Permission rules

- User editable: avatar, display name, phone.
- Admin editable only: department, role, site.
- User-controlled toggles: Work Order assigned, Work Order overdue, PM upcoming, equipment incident, system notifications.
