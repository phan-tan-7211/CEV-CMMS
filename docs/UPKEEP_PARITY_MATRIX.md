# CEV-CMMS UpKeep Parity Matrix

Rule: a feature is `DONE` only when UI + engine/API + persistence + permission + test are complete. AI is intentionally out of scope until the non-AI parity program is closed.

| Area | Feature | Web UI | Mobile UI | Engine/API | Persistence | Permission | Test | Status |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Work Orders | Dashboard | YES | YES | YES | YES | YES | YES | DONE |
| Work Orders | List/filter/sort | YES | YES | YES | YES | YES | YES | DONE |
| Work Orders | Create/detail | YES | YES | YES | YES | YES | YES | DONE |
| Work Orders | Assignment/checklist/parts/labor | YES | YES | YES | YES | YES | YES | DONE |
| Work Orders | Approval/verify/release | YES | YES | YES | YES | YES | YES | DONE |
| Work Orders | Timer | NO | NO | PARTIAL | YES | PARTIAL | NO | TODO |
| Work Orders | Draft | NO | NO | NO | NO | NO | NO | TODO |
| Work Orders | Offline | N/A | PARTIAL | NO | NO | NO | NO | TODO |
| Work Orders | Activity/cost parity | PARTIAL | PARTIAL | YES | YES | YES | PARTIAL | IN PROGRESS |
| Scheduler | Calendar feed (WO + PM) | NO | NO | YES | YES | YES | CONTRACT | IN PROGRESS |
| Scheduler | Unscheduled work | NO | NO | YES | YES | YES | CONTRACT | IN PROGRESS |
| Scheduler | Drag/drop reschedule | NO | NO | YES | YES | YES | CONTRACT | IN PROGRESS |
| Scheduler | Resize duration | NO | NO | YES | YES | YES | CONTRACT | IN PROGRESS |
| Scheduler | Resource reassignment | NO | NO | YES | YES | YES | CONTRACT | IN PROGRESS |
| Scheduler | Conflict detection | NO | NO | YES | YES | YES | CONTRACT | IN PROGRESS |
| Scheduler | Day/week/month views | NO | NO | READY | YES | YES | NO | TODO UI |
| Scheduler | Technician/resource view | NO | NO | READY | YES | YES | NO | TODO UI |
| PM | Schedule CRUD | PARTIAL | YES | YES | YES | YES | YES | IN PROGRESS |
| PM | Time/meter/either | PARTIAL | YES | YES | YES | YES | YES | IN PROGRESS |
| PM | Auto-generate WO | PARTIAL | YES | YES | YES | YES | YES | IN PROGRESS |
| Meter | Meter/readings | PARTIAL | YES | YES | YES | YES | YES | IN PROGRESS |
| Inventory | Parts/stock/issue | PARTIAL | YES | YES | YES | YES | YES | IN PROGRESS |
| Inventory | Reorder/PO/receiving | YES | PARTIAL | YES | YES | YES | YES | IN PROGRESS |
| Requests | Portal/lifecycle/convert | YES | YES | YES | YES | YES | YES | DONE |
| Collaboration | Comments/watchers/notifications/SLA | PARTIAL | PARTIAL | YES | YES | YES | YES | IN PROGRESS |
| Assets | Asset/location/category/people/team/vendor/customer | YES | YES | YES | YES | YES | YES | DONE |
| Analytics | KPI/OEE/trends/drill-down | YES | YES | YES | YES | YES | YES | DONE CORE |
| Settings | Organization/module/WO/dashboard settings | YES | YES | YES | YES | YES | YES | DONE CORE |
| Other | Files/checklists/sets/import/export/edge | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | TODO PARITY |
| AI | Whisper/assistant/predictive AI | OUT | OUT | OUT | OUT | OUT | OUT | DEFERRED |

## Execution order

1. Scheduler UI parity (Web first, then Mobile): day/week/month, drag-drop, resize, unscheduled tray, resource filters.
2. Work Order Timer, Draft, Offline queue, Activity/Cost parity.
3. Inventory/PO parity and cycle counts.
4. Collaboration/Notifications/Settings remaining screens.
5. Files/Checklists/Sets/Imports/Edge and remaining UpKeep reference modules.
6. Full parity audit against decompiled corpus and UpKeep behavior references.
7. AI work only after the matrix above is closed.
