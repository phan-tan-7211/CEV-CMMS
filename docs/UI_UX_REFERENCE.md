# CEV UI/UX Reference

This document is the project-level UI/UX contract for Equipment Management and CMMS.

## Product definition — UpKeep first, IATF 16949 extended

CEV CMMS is intentionally an **UpKeep-first CMMS product adapted for CEV and extended for IATF 16949 equipment-control requirements**.

The default design decision is:

`UpKeep visual/interaction model + CEV domain/data + IATF 16949 extensions`

Do not redesign the product into an Atlas-, shadcn-, Cal.com-, Dify-, generic-admin-, ERP-, or dashboard-template visual language when a usable UpKeep reference exists.

CEV business rules, Supabase schema/RPC, permissions, IATF requirements, auditability and terminology remain authoritative. UpKeep is the primary visual and interaction authority, not the data authority.

Read `docs/UPKEEP_VISUAL_REFERENCE.md` before implementing or refactoring CMMS UI.

## Non-negotiable UpKeep-first rule

When an UpKeep screenshot, HTML capture, route capture, V6/V7 state, V8 map, or authorized live reference exists for the target screen or interaction:

1. Match the UpKeep information hierarchy first.
2. Match the UpKeep shell, navigation, page composition, density, spacing, tables/lists, tabs, drawers/modals, filters, badges and action placement before consulting another product.
3. Reuse CEV business fields and permissions inside that composition.
4. Add IATF 16949 fields/workflows as extensions to the UpKeep pattern instead of creating a second competing UI system.
5. Do not blend a different visual language into a screen that already has a usable UpKeep reference.
6. Do not accept an existing screen merely because it was previously labeled “UpKeep-style”; compare it against the captured reference and fix material deviations.

If no usable UpKeep reference exists for a specific gap, use the fallback references below only for that gap.

## Reference priority

### Primary product reference

1. **UpKeep** — primary visual, interaction, information-architecture and workflow reference for CEV CMMS.

### Secondary/fallback references

2. **MaintainX / Limble** — fallback for CMMS flows or IATF-adjacent workflows not represented in the available UpKeep captures.
3. **Atlas CMMS (`Grashjs/cmms`)** — fallback for technician/mobile CMMS patterns where no UpKeep mobile reference is available.
4. **shadcn/ui (`shadcn-ui/ui`)** — implementation primitive/accessibility reference only; it must not replace the UpKeep visual language.
5. **Tamagui (`tamagui/tamagui`)** — token/native primitive reference only.
6. **Cal.com / Dify** — architecture/dense-workspace fallback only when UpKeep does not define the target pattern.
7. **React-Native-UI-Templates / Open WebUI / NextChat / Solito / create-t3-turbo** — implementation or platform references, not product visual authority.

## Reference ownership matrix

| CEV area | First reference | Secondary reference | Rule |
| --- | --- | --- | --- |
| Web app shell / sidebar / header | UpKeep | shadcn/ui | Match UpKeep composition and density; shadcn is primitive-only |
| Web Work Orders | UpKeep | MaintainX | Match list/detail/create/export workflow and visual hierarchy |
| Web Equipment / Assets | UpKeep | Atlas | Use UpKeep asset list/profile/tabs; add CEV/IATF equipment fields |
| Web Preventive Maintenance | UpKeep | MaintainX | Keep UpKeep PM pattern; add IATF evidence/approval fields where required |
| Web Scheduler | UpKeep | selected scheduler library | Library supplies mechanics; UpKeep supplies product UI |
| Web Requests | UpKeep | MaintainX | Preserve request → work-order pattern |
| Web Parts / Inventory | UpKeep | Atlas | Preserve UpKeep list/detail/stock interaction |
| Web Files / Checklists / People / Teams / Locations | UpKeep | shadcn/ui | Follow UpKeep screen composition |
| Web Meters / Edge | UpKeep | Atlas | Follow UpKeep information hierarchy |
| Web Customers / Providers / Purchase Orders / Cycle Counts / Sets | UpKeep | shadcn/ui | Follow captured UpKeep patterns |
| Web Analytics / Settings / Notifications | UpKeep | Dify/shadcn only for gaps | UpKeep remains visual authority |
| Mobile Work Orders | UpKeep mobile if captured | Atlas / MaintainX | Native task flow; do not shrink desktop UI |
| Mobile Equipment | UpKeep mobile if captured | Atlas / RN templates | Preserve UpKeep product concepts with native presentation |
| QR / camera | CEV workflow + UpKeep product flow | Expo native APIs | Native full-screen flow |
| Design tokens | UpKeep-derived CEV tokens | shadcn/Tamagui | Tokens should reproduce UpKeep-like density/hierarchy |
| Shared architecture | CEV architecture | create-t3-turbo / Solito | Share domain/contracts, not platform UI |

## IATF 16949 extension model

IATF functionality is an extension of the UpKeep product model, not a separate application beside it.

### Equipment / Asset

Use the UpKeep Asset/Equipment list and profile pattern, then extend it with CEV/IATF fields and evidence such as:

- canonical Equipment ID
- equipment name/type/category
- manufacturer/model/serial
- location/department/line
- status and criticality/risk
- equipment image and QR identity
- maintenance responsibility
- technical documents/specifications
- maintenance history
- inspection/calibration records where applicable
- spare-part relationships
- downtime/failure history
- audit/evidence metadata

A typical profile remains UpKeep-like:

`Overview → Child Assets → Work Orders → PM/Maintenance → Parts → Files → Meters → Activity`

CEV/IATF may add tabs such as `Inspection`, `Calibration`, or `IATF Records` when the business requirement exists. Add them to the same entity-tab model; do not create a parallel “IATF portal”.

### Maintenance / PM

Preserve UpKeep Work Order and Preventive Maintenance concepts and add CEV/IATF needs such as:

- maintenance plan
- frequency/trigger
- checklist/standard work
- planned vs actual date
- assignee/responsibility
- result and completion evidence
- approval/verification when required
- overdue tracking
- breakdown/downtime
- parts consumed
- attachments/photos
- immutable history/audit trail

### Spare parts / inventory

Use the UpKeep Parts & Inventory pattern and extend only where CEV/IATF requires:

- equipment-to-spare relationship
- min/max/reorder controls
- issue/usage history
- supplier information
- traceability/evidence where required

### Inspection / calibration / evidence

Where CEV equipment control requires inspection, calibration or retained evidence, integrate it into the same equipment/work-order/history model. Do not build disconnected duplicate records for the same equipment identity.

## Visual fidelity contract

For a screen with a captured UpKeep reference, implementation is not complete merely because the same features exist. Compare at least:

- global shell and sidebar proportions
- top/header height and hierarchy
- page padding and max-width behavior
- typography scale/weight hierarchy
- list/table density and row height
- search/filter placement and compactness
- button hierarchy and action placement
- status/priority badge treatment
- tabs, active state and spacing
- drawer/modal width, header/footer and scroll ownership
- cards/sections/borders/radius/shadows
- empty/loading/error states
- icon size/alignment
- responsive rearrangement

When screenshots are available, use side-by-side comparison. Fix shared primitives first when the same deviation appears across multiple modules.

Do not copy UpKeep proprietary source code, logos, trademarks, private assets, or licensed artwork. Reimplement the observed interface and interactions using CEV code, tokens, data contracts and accessible primitives.

## Existing implementation rule

The repository already contains many screens implemented during the UpKeep-parity phase, including Settings, Providers & Network, Customers, Purchase Orders, Cycle Counts, Sets, Files, Checklists, People, Locations, Teams, Inventory, Parts, Meters, Edge, Analytics, Requests, Work Order Create, Notification Settings and Work Order Export.

These screens are **baseline implementations, not automatic visual truth**. Future AI sessions must:

1. preserve working business flow unless a change is required,
2. compare existing UI with the best available UpKeep reference,
3. correct shared-shell/shared-component mismatches before making one-off page hacks,
4. avoid replacing UpKeep-like screens with generic dashboard designs,
5. keep UI fidelity work separable from later live-data wiring when the current phase explicitly focuses on UI.

## Expo mobile scope

The native CEV app focuses on field work. UpKeep remains the primary product/workflow reference when a mobile UpKeep reference exists, but the UI must remain genuinely native.

1. `Công việc của tôi`
2. `Chi tiết Work Order`
3. `Quét QR`
4. `Checklist hằng ngày`
5. `Báo sự cố / chụp ảnh`
6. `Thiết bị`
7. `Thêm thiết bị mới`

Do not put large audit tables, bulk master editing, Excel import, administration or A4 report authoring into the first native app. Those remain web-first.

## Mobile visual contract

- Use native screen navigation for detail flows; do not reproduce desktop drawers everywhere.
- Prefer cards and grouped sections over boxed form grids.
- One clear primary action per screen.
- Status/priority must be visible without relying on color only.
- Minimum primary touch target approximately 44x44.
- Keep horizontal scrolling out of normal mobile workflows.
- Bottom navigation must contain only the most frequent field tasks.
- Use safe-area correctly for header, bottom navigation and sticky actions.
- Photo/camera actions must be prominent where evidence is expected.
- Empty/loading/error/offline states are designed states, not afterthoughts.
- No decorative gradients, oversized hero cards or dashboard clutter unless present in the reference or needed to communicate real operational state.

## Web visual contract

- UpKeep is the first visual reference for CMMS operational screens.
- Desktop can be dense; mobile cannot be a compressed desktop table.
- Use accessible implementation primitives without changing the UpKeep-derived composition.
- One workspace header; avoid repeated title cards inside the same page.
- Filters should be compact and persistent for data-heavy screens.
- Drawers are for contextual edit/detail on desktop; full screens are allowed/preferred on native mobile.
- Do not introduce generic KPI hero cards, gradient dashboards or oversized marketing-style panels unless the UpKeep reference or a CEV operational requirement explicitly calls for them.

## Shared architecture contract

Target long-term structure follows the existing CEV architecture and create-t3-turbo principle:

```text
apps/
├─ web/
└─ mobile/

packages/
├─ domain/
├─ contracts/
└─ shared-utils/
```

Share:
- TypeScript domain types
- Zod validation
- workflow transitions/contracts
- Supabase/RPC contracts
- formatting rules that are truly platform-neutral

Do not share:
- web DOM components
- desktop tables
- native screens
- navigation shells
- CSS

## CEV responsive rules

1. Breakpoints change arrangement, never business capability.
2. Required actions cannot disappear on smaller widths.
3. Contextual drill-down must provide a Back action to the exact source entity.
4. Bottom nav is global navigation, not contextual Back.
5. One overlay = one scroll owner; background stays locked.
6. Do not duplicate the same data twice on one screen.
7. Registration/Edit for the same entity share the same business fields.
8. Mobile tables become cards or label-value rows.
9. Destructive/Cancel/Save actions remain reachable at all supported widths.
10. Safe-area must be respected for sticky actions and bottom navigation.

## Required viewport checks for web

- 375 px
- 440 px
- 768 px
- 1024 px
- 1440 px

## Mobile Equipment Profile rule

Hero contains only identity and quick recognition:
- Equipment ID
- Equipment name
- Photo
- Status
- Criticality
- Non-duplicated key metadata

Quick actions:
- Maintenance
- Inspection
- Spare
- QR

If one of those actions opens another workspace, show:

`← Trở về <equipment_id>`

and return to the same Equipment Profile.

## UI review checklist

- [ ] Best available UpKeep reference was identified before implementation
- [ ] Screen was compared side-by-side with that reference when screenshots exist
- [ ] No unrelated visual language was blended into a referenced UpKeep screen
- [ ] IATF additions extend the UpKeep pattern instead of creating a competing UI
- [ ] No action disappears by viewport width
- [ ] No background scroll behind open drawer/modal
- [ ] Header/footer actions stay reachable
- [ ] No duplicate Equipment ID / Status / Criticality on same screen
- [ ] Contextual Back works after quick actions
- [ ] No page-level horizontal scroll
- [ ] Primary mobile touch targets are approximately 44x44 or larger
- [ ] Visible labels on form fields
- [ ] Badge/status meaning is not color-only
- [ ] Text and chips reflow without clipping
- [ ] Safe-area tested
- [ ] Mobile screen does not look like a resized desktop screen
- [ ] Empty/loading/error/offline states are present where applicable
- [ ] Tests/build/lint/browser smoke pass
