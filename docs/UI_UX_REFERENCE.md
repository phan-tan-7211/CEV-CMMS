# CEV UI/UX Reference

This document is the project-level UI/UX contract for Equipment Management and CMMS.

## Non-negotiable rule

Do not invent a new visual language for CEV when a proven pattern already exists in the reference products below.

Use references by responsibility:

1. **Atlas CMMS (`Grashjs/cmms`)** — primary reference for technician/CMMS information architecture and mobile work-order flow.
2. **React-Native-UI-Templates (`Aashu-Dubey/React-Native-UI-Templates`)** — visual composition reference for polished native cards, spacing, hierarchy, transitions, empty states and list/detail presentation.
3. **Tamagui (`tamagui/tamagui`)** — native/web design-system reference: tokens, spacing, typography, composable primitives and platform-appropriate styling.
4. **create-t3-turbo (`t3-oss/create-t3-turbo`)** — primary reference for web + Expo monorepo separation and shared TypeScript contracts/validation without sharing platform UI.
5. **Solito (`nandorojo/solito`)** — reference for shared navigation/domain concepts when useful; do not force web and native screen DOM/component parity.
6. **shadcn/ui (`shadcn-ui/ui`)** — web component quality, accessibility, forms, dialogs, tables, command/search, states and visual consistency.
7. **Cal.com (`calcom/cal.diy`)** — feature boundaries, shared UI primitives and business-domain separation.
8. **Dify (`langgenius/dify`)** — dense operational workspace patterns and reusable primitives.
9. **Open WebUI (`open-webui/open-webui`)** and **NextChat (`ChatGPTNextWeb/NextChat`)** — responsive shell, compact navigation, drawer/sheet behavior and high-density mobile/web interaction patterns.
10. **MaintainX / Limble / UpKeep** — product benchmark for technician workflow, PM, request -> work order, asset history, QR and field execution.

CEV workflow, Supabase schema, IATF requirements and role rules always take precedence over a reference product.

## Reference ownership matrix

| CEV area | First reference | Secondary reference | Rule |
| --- | --- | --- | --- |
| Mobile Work Orders | Atlas mobile | MaintainX / UpKeep | Card-first, actionable, assignee/status/due visible before opening detail |
| Mobile Equipment | Atlas asset screens | React-Native-UI-Templates | Identity + status + primary actions, no spreadsheet layout |
| QR / camera | Atlas mobile | Expo native APIs | Native full-screen flow, immediate result feedback |
| Add Equipment | Atlas create flows | Tamagui / RN UI Templates | Short sections, progressive fields, camera/photo native |
| Daily Checklist | MaintainX | Atlas | Fast tap targets, sticky completion action, offline-friendly |
| Report Breakdown | UpKeep / MaintainX | RN UI Templates | Minimum fields first, photo first-class, escalation obvious |
| Web Equipment Master | shadcn/ui | Cal.com | Dense but readable table, strong filters, bulk operations |
| Web CMMS Workspace | Atlas web | Cal.com / Dify | Work Order is center; plans/results/handover are supporting records |
| Navigation | Atlas mobile | Open WebUI / NextChat | Platform-native navigation; do not shrink desktop sidebar into mobile |
| Shared architecture | create-t3-turbo | Solito | Share contracts/domain/validation, not platform UI |
| Design tokens | Tamagui | shadcn/ui | One spacing/type/radius/status system |

## Atlas CMMS lessons to reuse, not copy

- Work Orders are a first-class mobile destination.
- Mobile list uses cards instead of desktop tables.
- Search and quick filters stay close to the list.
- Work-order cards expose status, priority, asset/location, due date and assignees.
- Tapping a card opens a dedicated detail screen.
- Requests can lead into Work Orders.
- PM and assets connect back to Work Orders/history.
- Camera/QR are native flows.

Do **not** copy Atlas source code. Reimplement the interaction in CEV using CEV domain/RPC and visual tokens.

## Expo mobile scope

The first native CEV app should focus on field work only:

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
- No decorative gradients, oversized hero cards or dashboard clutter unless they communicate actual operational state.

## Web visual contract

- Desktop can be dense; mobile cannot be a compressed desktop table.
- Use shadcn/Cal-style primitive consistency for buttons, fields, dialogs, tables, badges and command/search.
- One workspace header; avoid repeated title cards inside the same page.
- Filters should be compact and persistent for data-heavy screens.
- Drawers are for contextual edit/detail on desktop; full screens are allowed/preferred on native mobile.

## Shared architecture contract

Target long-term structure follows the create-t3-turbo principle:

```text
apps/
├─ web/       # existing React/Vite web
└─ mobile/    # Expo / React Native

packages/
├─ domain/        # equipment, maintenance, work-order rules
├─ contracts/     # DTOs, Zod schemas, RPC contracts
└─ shared-utils/  # platform-neutral utilities only
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

- [ ] Screen was compared against its designated reference before implementation
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
