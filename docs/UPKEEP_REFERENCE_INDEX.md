# UpKeep Reference Index

This file is the concrete lookup index for the UpKeep-first CEV CMMS UI rules.

Read together with:

- `docs/UI_UX_REFERENCE.md`
- `docs/UPKEEP_VISUAL_REFERENCE.md`
- `.agents/skills/ui-ux-pro-max/SKILL.md`

## Source roles

### Master UpKeep source

Google Drive folder:

`https://drive.google.com/drive/u/0/folders/1_H0N-OgFKB7gSdfQCYxhKtIydxnnokcW`

Role: long-term master research source. It may contain visual references, decompiled/reverse-engineering research, AI corpus material and other supporting artifacts.

Use this folder for understanding behavior or filling gaps. Do not treat decompiled source or proprietary assets as implementation code for CEV.

### Visual/capture authority

Google Drive folder:

`https://drive.google.com/drive/folders/1TZ2yTswQ1GgO4ZHAJdlbUfkjZq9pVwvU`

Folder name: `CEV-UpKeep-Reference`

Role: primary captured visual/state reference for UI parity work.

Known contained capture sets:

- `upkeep/`
- `upkeep-v2/`
- `upkeep-v3/`
- `upkeep-v4/`
- `upkeep-v5/`
- `upkeep-v6/`
- `upkeep-v7/`
- `upkeep-v8-analysis/`

## Capture hierarchy

Use the highest-fidelity available source in this order:

1. exact screenshot/state capture for the target screen
2. V7 validated page capture
3. V6 unique state capture if V7 does not expose the needed tab/modal/state
4. V8 route/component map for navigation and component reuse guidance
5. older captures V5/V4/V3/V2 only when they contain a state that newer sets do not
6. authorized live UpKeep reference
7. another UpKeep screen with the same pattern
8. fallback products only when UpKeep does not cover the gap

Do not use V8 heuristic pattern labels as visual truth when a screenshot/state contradicts them.

## Direct Drive locations

### V6

Folder:

`https://drive.google.com/drive/folders/1kbPH2IXvLVlBrZh24UIjMmWoxppya_Iq`

Known children:

- pages: `https://drive.google.com/drive/folders/152i92IftS3NVxs3jQykKI_rJX9UiX5eb`
- routes: `https://drive.google.com/drive/folders/1EJuxjFCoMdNgr31-D2COXZiHiQsjXpKW`
- network: `https://drive.google.com/drive/folders/1aNL9ZziQTdBRmlXqm4BhiZmKPrUvL8F6`

Use V6 primarily for extra UI states/tabs and route/network discovery context.

### V7

Folder:

`https://drive.google.com/drive/folders/1UEodB-9Tnq3qsv7hUyIHdO_cTyBLHb5k`

Validated pages folder:

`https://drive.google.com/drive/folders/1M1cr4m5osUOD2484YDTVqAPwNidW2zn4`

Use V7 as the main route-level capture authority.

### V8 analysis

Folder:

`https://drive.google.com/drive/folders/1Pbt61noVQQvukbQeoD1b5J0Rt84Y66KA`

Known files:

- `upkeep-analysis.md`
- `upkeep-ui-map.json`
- `upkeep-component-map.json`
- `upkeep-route-map.csv`
- `_summary.json`

Use V8 to identify module coverage, shared components and route relationships. Prefer screenshot/state captures for visual decisions.

## V7 screen mapping

The following folders were verified in the V7 pages set.

| CEV / UpKeep area | UpKeep route/state | V7 folder |
| --- | --- | --- |
| Work Orders entry | `/web/work-orders` | `001-other-page` |
| Parts list | `/web/parts/list` | `002-parts-page` |
| Part detail | `/web/parts/:id/details` | `003-parts-page` |
| Work Orders list | `/web/work-orders/list` | `004-work-orders-page` |
| Work Order detail | `/web/work-orders/details/:id` | `005-work-orders-page` |
| Part inventory | `/web/parts/:id/inventory` | `006-parts-page` |
| Asset detail / overview | `/web/assets/details/:id/overview` | `007-assets-page` |
| People detail modal | `/web/people/list?modal=person...` | `008-people-page` |
| People detail alternate state | `/web/people/list?modal=person...` | `009-people-page` |
| Work Orders filtered list | `/web/work-orders/list?status=...` | `010-work-orders-page` |
| Preventive Maintenance list | `/web/preventive-maintenance/list` | `011-preventive-maintenance-page` |
| Scheduler | `/web/scheduler` | `012-scheduler-page` |
| Requests list | `/web/requests/list` | `013-requests-page` |
| Request detail modal | `/web/requests/list?modal=requests...` | `014-requests-page` |
| Nova / intelligence | `/web/intelligence/nova/chat` | `015-other-page` |
| Assets filtered list | `/web/assets/list?activeStatus=active` | `016-assets-page` |
| Asset detail sample 2 | `/web/assets/details/:id/overview` | `017-assets-page` |
| Asset detail sample 3 | `/web/assets/details/:id/overview` | `018-assets-page` |
| Scheduled automations | `/web/intelligence/automations/scheduled` | `019-other-page` |
| Custom apps | `/web/intelligence/custom-apps/my-apps` | `020-other-page` |
| Analytics | `/web/analytics` | `021-other-page` |
| Meters | `/web/meters` | `022-meters-page` |
| Edge | `/web/edge` | `023-other-page` |
| Assets list | `/web/assets/list` | `024-assets-page` |
| Asset detail sample 4 | `/web/assets/details/:id/overview` | `025-assets-page` |
| Locations list | `/web/locations/list` | `026-locations-page` |
| People list | `/web/people/list` | `027-people-page` |
| Checklists | `/web/checklists` | `028-checklists-page` |
| Files list | `/web/files/list` | `029-other-page` |
| Work Order import | `/web/imports/workorder` | `030-other-page` |
| Inventory list | `/web/inventory/list` | `031-inventory-page` |
| Customers list | `/web/customers/list` | `032-customers-page` |
| Customer detail | `/web/customers/:id/details` | `033-customers-page` |
| Providers network | `/web/providers/network` | `034-providers-page` |
| Provider detail | `/web/providers/:id/details` | `035-providers-page` |

## Direct V7 folder links for priority modules

### Work Orders

- list: `https://drive.google.com/drive/folders/1-LIxf5syyAK1hJeU4LPcUDAFy3N1UW8G`
- detail: `https://drive.google.com/drive/folders/1kZUH_ncF0UnmNQ5cVCnQGqtbBZpR5ZOH`
- filtered list: `https://drive.google.com/drive/folders/1tb93fuDkV3b6jV9DyfatiQKJUPahoUOb`

### Assets / Equipment

- detail sample 1: `https://drive.google.com/drive/folders/1bHG8nfbyPA-xjssinr6NFi6pS0Tv_Wkw`
- filtered list: `https://drive.google.com/drive/folders/1bVok2iLeMKSvjElSRN89e2Lee2ieLh1x`
- detail sample 2: `https://drive.google.com/drive/folders/1P_M2MakdKd5P9ltaBSLZtY9Acl2m-d83`
- detail sample 3: `https://drive.google.com/drive/folders/11xmPtkdstOk3bHq6wynM__ItBiVLpl3Z`
- list: `https://drive.google.com/drive/folders/1ekyaV5hIOSvAXj_9yiy56mSkBa4C91Tc`
- detail sample 4: `https://drive.google.com/drive/folders/1gzhgFKeNROEbbNPqaqzsxKrzUbWH6sdT`

### PM / Scheduler

- Preventive Maintenance: `https://drive.google.com/drive/folders/141olBUryx5IxrSY7CLcSfYWnCRYRb2I5`
- Scheduler: `https://drive.google.com/drive/folders/1XUED1IFZdWeeEkymkwVqrEvdXUfAE4qO`

### Requests

- list: `https://drive.google.com/drive/folders/163npZTfYLNBjfL3gXSJrsEehfYwEimXr`
- detail modal: `https://drive.google.com/drive/folders/1bRL42B6jc0wfRAcBMho2gnFfzuv6MzyT`

### Parts / Inventory

- parts list: `https://drive.google.com/drive/folders/1w9uTIaa-sux8NDYeOG0TAQEcou1nrXpG`
- part detail: `https://drive.google.com/drive/folders/1rtZ72PYgiDKLDWapSM2JBDXFw6uwcSpF`
- part inventory: `https://drive.google.com/drive/folders/1O8LNPLvYrQDqn6tJkfuTJ2POpRr066IO`
- inventory list: `https://drive.google.com/drive/folders/1MITO271ssOz9U7vlL02HygfOeDxKn045`

### Supporting modules

- Meters: `https://drive.google.com/drive/folders/1ROp7xiMK6kE-lFvaUdEBdcuq2lST6Sys`
- Locations: `https://drive.google.com/drive/folders/1EEXnl1cKSqmShRhXCG6QgOcPGbd9kaje`
- People: `https://drive.google.com/drive/folders/1RRHb2VCcWdXYAmreKxqDe9rCUdLG_pgm`
- Checklists: `https://drive.google.com/drive/folders/1s5CK2awKq9LbFcpOWWf0HHFIXaOYd2sd`
- Files: `https://drive.google.com/drive/folders/1XWoac6O82QsGkHcwyOPoI8BPAabc3s9V`
- Customers list: `https://drive.google.com/drive/folders/1QpxrHf2FHvuvfZidxHSRDnqM465aZMta`
- Customer detail: `https://drive.google.com/drive/folders/1RMPsNIqPN7pIG7j9-MDGwEZJa-R8bHcc`
- Providers network: `https://drive.google.com/drive/folders/17b5-V6U-d3LufmVa7h2TySv11ZcxYpVe`
- Provider detail: `https://drive.google.com/drive/folders/1MdlGN0C6hg63cpWGP9eg28B33s7NSbHz`

## AI session lookup rule

Before implementing/refactoring a referenced CMMS screen, an AI session must:

1. identify the target CEV screen/module,
2. open this index,
3. locate the exact V7 route/folder,
4. inspect the exact capture/state if available,
5. inspect V6 only if additional tab/modal/state coverage is needed,
6. use V8 to understand shared component reuse,
7. compare CEV side-by-side against the UpKeep reference,
8. extend the UpKeep pattern with IATF fields/workflows without inventing a competing visual language.

If a listed Drive folder is temporarily empty/unavailable through a connector, do not reinterpret that as permission to redesign from memory. Use another higher-priority UpKeep capture/state or ask for the exact screenshot if no usable reference can be inspected.

## Scope note

This index is reference metadata only. It does not authorize copying UpKeep proprietary source code, logos, trademarks, private assets or licensed artwork. CEV must independently reimplement the observed product pattern using CEV code and business/data contracts.
