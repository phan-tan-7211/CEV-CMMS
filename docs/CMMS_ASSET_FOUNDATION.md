# CMMS Asset Foundation

This backend lane is intentionally separate from Mobile UI work.

## Goal

Provide normalized data structures for an UpKeep/Atlas-class CMMS without limiting the product to current CEV data. Existing `equipment_master.source_data` remains compatible while the application gradually adopts normalized relations.

## Master data

### Locations
`cmms_location`

Supports:
- parent/child hierarchy
- name and address sorting
- coordinates for map mode
- active/archive state
- creation timestamps for oldest/newest sorting

### Asset categories
`cmms_asset_category`

Supports nested categories and archive state.

### People
`cmms_person`

CMMS-facing roles:
- `ADMINISTRATOR`
- `TECHNICIAN`
- `TECHNICIAN_LIMITED`
- `REQUESTER`
- `VIEW_ONLY`

`auth_user_id` is optional so external/requester records can exist before an Auth account is created.

### Teams
`cmms_team` + `cmms_team_member`

Members can be `LEAD` or `MEMBER`.

### Vendors and customers
`cmms_business_party`

`party_kind`:
- `VENDOR`
- `CUSTOMER`
- `BOTH`

This avoids duplicating the same company when it acts in more than one role.

## Equipment links

New optional columns on `equipment_master`:
- `location_id`
- `asset_category_id`
- `parent_equipment_id`
- `primary_person_id`
- `archived_at`
- `created_by_user_id`

These columns are additive and do not remove or rename current fields.

Many-to-many assignment tables:
- `cmms_equipment_person_assignment`
- `cmms_equipment_team_assignment`
- `cmms_equipment_party_assignment`

Person assignment roles include `PRIMARY_USER`, `ASSIGNED_USER`, `RESPONSIBLE`, `WATCHER`.

Party assignment roles include assigned/service/manufacturer/distributor vendors plus assigned/owner customers.

## Asset Filter contract

`cmms_asset_filter_v` provides the direct fields needed by the UpKeep-style Asset Filter screen:
- Asset Name
- Asset Model
- Asset Barcode
- Asset Area
- Asset Category
- Location
- Primary User
- Archived / Unarchived
- Created By
- Date Created

Additional picker filters use the assignment tables for assigned users, teams, vendors and customers.

During migration, Area and Category fall back to existing `source_data.currentArea` and `source_data.equipmentCategory` when normalized IDs are still null.

## Compatibility rule

Do not remove existing `source_data` keys yet. UI can be completed with mock data first; backend adoption should move field-by-field to normalized relations without breaking existing Web/Mobile flows.

## Security

All new public-schema tables have RLS enabled. Authenticated users can read master data. Master-data writes are limited to current `MANAGER` and `ADMIN` application roles. The filter view uses `security_invoker` so underlying RLS remains effective.

## Ownership boundary

This change must not modify:
- Mobile bottom navigation
- Scan UI/flow
- Home UI
- Work Orders UI
- Requests UI
- More screen UI

Those files belong to the parallel Mobile UI lane.
