# CMMS Picker & Asset Filter Contract

Backend-only contract for Mobile/Web UI integration. This document does not change navigation or visual ownership.

## 1. Location Picker

RPC: `rpc_cmms_location_picker`

Inputs:
- `p_search`
- `p_parent_location_id`
- `p_sort`
- `p_include_archived`
- `p_limit`
- `p_offset`

Supported sort keys:
- `NAME_ASC`
- `NAME_DESC`
- `ADDRESS_ASC`
- `ADDRESS_DESC`
- `CREATED_ASC`
- `CREATED_DESC`

Outputs include:
- location identity and parent
- name/address
- latitude/longitude for map mode
- `child_count` for drill-down affordance
- `total_count` for pagination

Breadcrumb RPC: `rpc_cmms_location_breadcrumb(location_id)`.

Descendant helper: `cmms_location_tree_ids(uuid[])`.

## 2. People Picker

RPC: `rpc_cmms_people_picker`

Role codes:
- `ADMINISTRATOR`
- `TECHNICIAN`
- `TECHNICIAN_LIMITED`
- `REQUESTER`
- `VIEW_ONLY`

Supports search across display name, email and job title.

Outputs include team count so UI may indicate whether a person already belongs to teams.

## 3. Team Picker

RPC: `rpc_cmms_team_picker`

Supports search, archive state, name/member-count sorting and pagination.

Outputs include:
- `member_count`
- `lead_count`
- `total_count`

## 4. Vendor / Customer Picker

RPC: `rpc_cmms_party_picker`

`p_kind`:
- `VENDOR`
- `CUSTOMER`
- `ALL`

A party with `party_kind = BOTH` appears in both Vendor and Customer pickers.

Search covers company, contact, address and email.

## 5. Asset Filter

RPC: `rpc_cmms_asset_filter(p_filters, p_sort, p_limit, p_offset)`

### Text filters

`p_filters` JSON supports:
- `assetName`
- `assetModel`
- `assetBarcode`
- `assetArea`
- `assetCategory`

### Archive state

`archivedMode`:
- `UNARCHIVED` (default)
- `ARCHIVED`
- `ALL`

### User ownership

`createdByYou: true` maps to `created_by_user_id = auth.uid()`.

### Relationship filters

JSON array keys:
- `locationIds`
- `primaryUserIds`
- `assignedUserIds`
- `assignedTeamIds`
- `assignedVendorIds`
- `assignedCustomerIds`

When `includeLocationDescendants = true`, selected locations also match every descendant location.

### Date Created

- `createdStart`
- `createdEnd`

Both accept Postgres-compatible ISO date/timestamp strings.

### Sort keys

- `NAME_ASC`
- `NAME_DESC`
- `CREATED_ASC`
- `CREATED_DESC`
- `BARCODE_ASC`
- `BARCODE_DESC`

Every result row includes `total_count` for pagination.

## 6. UI ownership boundary

The backend lane must not modify:
- Mobile bottom navigation
- Scan button / Scan flow
- Home screen layout
- Work Orders screen styling
- Requests screen styling
- More screen styling

Mobile can continue using mock data while these RPCs are not yet deployed. Later integration should replace mock data at the repository/service layer rather than redesign the screens.

## 7. Compatibility

Current CEV equipment records remain valid:
- legacy fields inside `equipment_master.source_data` are preserved
- `cmms_asset_filter_v` uses normalized values first and legacy JSON as fallback where appropriate
- new normalized relationships can be populated incrementally

The database model is intentionally broader than the current CEV dataset so missing operational data can be added later without shrinking the UI or workflow.
