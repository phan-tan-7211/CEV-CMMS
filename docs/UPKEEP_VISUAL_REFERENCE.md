# UpKeep Visual Reference Contract

This file defines how CEV CMMS uses UpKeep as its primary product reference.

Before implementing or refactoring a referenced CMMS screen, also read `docs/UPKEEP_REFERENCE_INDEX.md` to locate the exact captured UpKeep route/state.

## Product statement

CEV CMMS is an **UpKeep-first CMMS adapted to CEV operations and extended for IATF 16949 equipment-management requirements**.

The intended product model is:

`UpKeep UI/UX/workflow + CEV data/business rules + IATF 16949 extensions`

Do not reinterpret this as “a generic CMMS inspired by several products”.

## What must follow UpKeep when a reference exists

For Web CMMS and for Mobile where a usable UpKeep mobile reference exists, UpKeep is the first authority for:

- app shell
- sidebar/navigation
- page header
- list/table structure
- search/filter placement
- sorting/grouping patterns
- status/priority badges
- list density
- detail header
- entity summary
- tabs
- drawers/modals
- action menus
- Work Order flows
- Asset/Equipment flows
- Preventive Maintenance
- Scheduler
- Requests
- Parts & Inventory
- Files
- Checklists
- People / Teams
- Locations
- Meters / Edge
- Customers / Providers
- Purchase Orders
- Cycle Counts / Sets
- Analytics
- Settings / Notification Settings
- create/export flows when captured

If an UpKeep capture exists, do not substitute an Atlas, shadcn, Cal.com, Dify, ERP, admin-template or AI-invented composition.

## What CEV/IATF may change or add

CEV may change terminology, fields, permissions, validation, business rules and data behavior to satisfy CEV and IATF 16949 requirements.

Typical extensions include:

- canonical Equipment ID (`CEV-PR-NNN`)
- Equipment Master
- complete equipment profile
- equipment category/type
- manufacturer/model/serial
- line/department/location
- status
- criticality/risk
- equipment image and QR identity
- maintenance ownership/responsibility
- maintenance plan / PM plan
- checklist / standard maintenance work
- planned vs actual maintenance
- breakdown/downtime history
- spare-part relationships
- min/max/reorder stock controls
- parts-consumption history
- inspection records
- calibration records where applicable
- technical documents/files
- photos/evidence
- approval/verification metadata
- audit trail and retained history
- export/PDF/audit evidence when required

These should be integrated into UpKeep-like entities and workflows instead of becoming a separate visual system.

## Core entity pattern

### Equipment / Asset

Default UpKeep-like structure:

`Equipment List → Equipment Profile`

Preferred profile tabs/sections:

`Overview → Child Assets → Work Orders → PM/Maintenance → Parts → Files → Meters → Activity`

CEV/IATF may add only when required:

`Inspection → Calibration → IATF Records`

Do not create a second Equipment identity or duplicate profile for IATF records.

### Work Order

Keep the UpKeep Work Order model and visual hierarchy.

CEV/IATF may add:

- maintenance standard/checklist
- evidence/photos/files
- verification/approval
- actual duration
- downtime
- consumed parts
- failure/cause/action data
- retained audit history

### Preventive Maintenance

Keep the UpKeep PM/list/schedule relationship.

Extend with IATF-required plan, evidence, due/overdue, responsibility and retained history.

### Parts / Inventory

Keep UpKeep Parts & Inventory UX.

Extend with equipment relationships, min/max/reorder, issue/consumption traceability and supplier/evidence fields where required.

## Reference source hierarchy

Use the highest available source in this order:

1. user-provided screenshot of the exact UpKeep state
2. captured UpKeep screenshot/HTML/state for the exact route
3. V6/V7 capture states and validated routes
4. V8 UI/component/route maps
5. authorized live UpKeep session/reference
6. another UpKeep screen with the same pattern
7. MaintainX/Limble for missing CMMS behavior
8. Atlas for missing technician/mobile behavior
9. shadcn/Tamagui/Cal/Dify only as implementation/architecture fallback

Never use a lower-priority source to override a clear higher-priority UpKeep reference.

## UpKeep Drive source roles

Two operator-provided Google Drive locations have different purposes and must not be conflated.

### Master UpKeep source

`https://drive.google.com/drive/u/0/folders/1_H0N-OgFKB7gSdfQCYxhKtIydxnnokcW`

This is the long-term master research source. It may contain:

- `CEV-UpKeep-Reference`
- `AI_corpus`
- `UpKeep_decompiled`
- `ghidra_proj`
- `UpKeep_jadx`

Use this source to understand behavior or fill research gaps. Decompiled/reverse-engineered material is reference-only. Do not copy proprietary UpKeep source code or private assets into CEV.

### Visual/capture authority

`https://drive.google.com/drive/folders/1TZ2yTswQ1GgO4ZHAJdlbUfkjZq9pVwvU`

Folder name: `CEV-UpKeep-Reference`.

This is the primary captured UI/state source for visual parity. Known capture generations include:

- `upkeep/`
- `upkeep-v2/`
- `upkeep-v3/`
- `upkeep-v4/`
- `upkeep-v5/`
- `upkeep-v6/`
- `upkeep-v7/`
- `upkeep-v8-analysis/`

Use `docs/UPKEEP_REFERENCE_INDEX.md` for the verified V6/V7/V8 folder links and route-to-capture mapping.

If the exact capture exists in the visual/capture Drive, use it before master-source research material or fallback products.

## Current known reference sources

### Drive capture source

The visual/capture authority is:

`https://drive.google.com/drive/folders/1TZ2yTswQ1GgO4ZHAJdlbUfkjZq9pVwvU`

A previous handoff reported 41 UpKeep HTML captures reviewed from this source.

### Local analysis artifacts

The operator generated an UpKeep reference set with the following progression:

- V6: router/network discovery and unique UI states
- V7: validated real routes
- V8: UI map, component map and route map

Known V8 summary from the operator session:

- 35 validated captured pages
- 14 modules
- 27 component candidates

Key shared patterns identified:

- `AppShell + Sidebar` across all captured pages
- list pages: `PageHeader + SearchBar + FilterBar + DataTable + StatusBadge + Pagination`
- detail pages: `DetailHeader + EntitySummary + Tabs + ActivityPanel`
- Assets: `AssetHeader + AssetStatus + AssetMetadata`
- Work Orders: `WorkOrderCard + PriorityBadge + AssigneeChip`
- Requests: `RequestCard + RequestDetailDrawer`
- Scheduler: `SchedulerToolbar + CalendarView + EventCard`

If these artifacts are available in the working session, use them as structured navigation aids, but prefer actual screenshots/states for visual decisions.

## Current Web implementation checkpoint

A handoff on 2026-09-09 reported the following Web areas already implemented during the UpKeep-parity phase:

- Settings
- Providers & Network
- Customers
- Purchase Orders
- Cycle Counts
- Sets
- Files
- Checklists
- People
- Locations
- Teams
- Inventory
- Parts
- Meters
- Edge
- Analytics
- Requests
- Work Order Create
- Notification Settings
- Work Order Export

Work Order Export reportedly includes:

- Excel/CSV
- field selection
- select/deselect all
- responsive presentation

Treat this checkpoint as **coverage information only**, not proof of visual parity. Before extending or refactoring one of these screens, compare it with the best available UpKeep reference.

## Anti-drift rules for AI sessions

An AI session working on CEV UI must not:

1. say “UpKeep-style” and then design from memory without checking the available reference,
2. replace UpKeep composition with generic shadcn cards because shadcn is easier,
3. use Atlas as primary Web visual reference when an UpKeep capture exists,
4. add oversized KPI/hero cards not present in the reference,
5. introduce decorative gradients or dashboard-template styling without a CEV requirement/reference,
6. create separate IATF pages when the requirement belongs naturally in Asset/Work Order/PM/Parts history,
7. duplicate Equipment ID/status/criticality across hero and overview,
8. patch each screen independently when the mismatch comes from shared shell/list/detail primitives,
9. declare parity without comparing screenshots when screenshots are available,
10. break existing business flow or live data merely to make a visual mock,
11. skip `docs/UPKEEP_REFERENCE_INDEX.md` and choose a lower-priority reference from memory when an indexed capture exists.

## Visual parity checklist

For each referenced screen compare:

- sidebar width and item spacing
- top bar/header height
- page title/action alignment
- content width and page padding
- font sizes and weights
- table/list row height
- column spacing
- search/filter controls
- chips/badges
- icons
- action buttons
- tab spacing/active state
- drawer/modal width
- drawer header/body/footer
- borders/radius/shadows
- empty/loading/error states
- responsive arrangement

If the same mismatch appears across modules, correct the shared primitive/token first.

## Platform rule

UpKeep is the product reference, but CEV platform architecture still applies.

- Web may use dense tables and desktop drawers.
- Native mobile should use a true native task flow and must not be a compressed desktop layout.
- When an UpKeep mobile capture exists, match the UpKeep mobile product flow and hierarchy using native components.
- Desktop/mobile presentation remain separate where the project architecture requires it.

## Data and code rule

- UpKeep is not the CEV data model.
- Supabase/RPC/RLS and CEV domain contracts remain authoritative.
- Do not copy proprietary UpKeep source code.
- Do not copy logos/trademarks/private assets/licensed artwork.
- Reimplement observed patterns independently.

## Definition of done for UpKeep-parity work

A referenced UI batch is complete only when:

1. `docs/UPKEEP_REFERENCE_INDEX.md` was checked for the target screen,
2. the exact/best available UpKeep reference was identified,
3. CEV implementation was compared against it,
4. material layout/hierarchy/density differences were corrected,
5. IATF additions fit the same pattern,
6. required actions and accessibility remain intact,
7. responsive requirements pass,
8. architecture/build/test gates required by the repository pass.
