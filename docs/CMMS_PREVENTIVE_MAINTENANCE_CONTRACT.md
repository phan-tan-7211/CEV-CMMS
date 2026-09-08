# CMMS Preventive Maintenance Contract

Backend-only contract for modern PM scheduling. Existing BM03 `maintenance_plan` / `maintenance_plan_item` remain untouched and can be linked through `legacy_plan_id`.

## Checklist templates
- `cmms_checklist_template`
- `cmms_checklist_template_item`

Supported template item types:
- CHECK
- TEXT
- NUMBER
- PASS_FAIL
- METER
- PHOTO
- SIGNATURE

When a PM Work Order is generated, compatible items are copied into `cmms_work_order_checklist_item`. PHOTO/SIGNATURE remain template metadata until the Work Order checklist table is extended for those response types.

## Meters
- `cmms_meter`
- `cmms_meter_reading`

Meter types:
- COUNTER
- HOURS
- CYCLES
- DISTANCE
- ENERGY
- CUSTOM

Reading sources:
- MANUAL
- IMPORT
- IOT
- WORK_ORDER
- API

RPC: `rpc_cmms_record_meter_reading`.

Non-rollover meters reject decreasing readings. A meter with `rollover_value` may accept a lower value after rollover.

## PM schedules
Table: `cmms_pm_schedule`.

Schedule types:
- TIME
- METER
- EITHER

Time units:
- HOURS
- DAYS
- WEEKS
- MONTHS
- YEARS

A schedule can carry:
- equipment
- title / description
- priority
- lead time
- checklist template
- default person
- default team
- linked legacy BM03 plan
- next time due
- next meter due

## Due query
RPC: `rpc_cmms_pm_due_list`.

Returns both `time_due` and `meter_due` plus combined `is_due`, so UI can explain why the task is due.

## Work Order generation
RPC: `rpc_cmms_generate_due_pm_work_orders`.

For each due schedule it:
1. creates one Work Order with source type `PREVENTIVE_MAINTENANCE`;
2. assigns default person/team if configured;
3. copies checklist template items;
4. records whether time, meter, or both triggered it;
5. advances `next_due_at` / `next_meter_due` beyond the current due point;
6. writes an audit record.

The function requires SUPERVISOR / MANAGER / ADMIN. It is intentionally callable as an RPC first; a Cron/Edge scheduler can invoke it later without changing the data contract.

## Security
New public tables have RLS enabled. Signed-in users can read. MANAGER/ADMIN manage PM master data, while MAINTENANCE/SUPERVISOR can add meter readings. Mutation RPCs have explicit authentication/role checks and public/anon execute is revoked.

## UI ownership boundary
No Mobile navigation, Scan, Home, Requests, Work Orders or PM screen styling is changed by this backend lane.
