# CMMS Analytics / KPI Contract

Backend-only analytics contract for Web/Mobile dashboards.

## Dashboard RPC

`rpc_cmms_analytics_dashboard(start_at, end_at, location_id, equipment_id)` returns:

- Work Orders: total, backlog, completed, completion rate
- Preventive Maintenance: generated PM WOs, completed PM WOs, compliance rate
- Reliability: downtime events, open downtime, downtime minutes, MTTR, MTBF
- SLA: total, met, breached, breach rate
- Cost: parts, labor, total maintenance cost
- Inventory: low-stock parts, stockouts, critical-risk parts, inventory value

PM compliance in this first analytics layer is defined as completed PM Work Orders divided by PM Work Orders generated during the requested period. This avoids inventing planned occurrences that were never generated.

## Read projections

- `cmms_analytics_downtime_event_v`
- `cmms_analytics_asset_reliability_v`
- `cmms_analytics_work_order_cost_v`
- `cmms_analytics_inventory_risk_v`

Views use `security_invoker = true` so underlying RLS remains authoritative.

## Cost breakdown

`rpc_cmms_analytics_cost_breakdown(dimension, start_at, end_at)` supports:

- `ASSET`
- `LOCATION`
- `TEAM`
- `VENDOR`

Vendor cost attribution uses Equipment vendor assignments (`ASSIGNED_VENDOR` / `SERVICE_VENDOR`). It does not claim that the vendor personally performed every labor or parts transaction; it is an attribution dimension for reporting.

## KPI definitions

### MTTR
Average duration of closed downtime events in hours.

### MTBF
Average elapsed operating time between the end of one closed downtime event and the start of the next closed downtime event for the same equipment.

### Backlog
Work Orders whose status is not `COMPLETED`, `COMPLETE`, `CLOSED`, or `CANCELLED`.

### Maintenance cost
Parts usage cost + labor minutes converted to hours multiplied by hourly rate.

### Inventory risk
- `STOCKOUT`: available quantity <= 0
- `REORDER`: available quantity <= reorder point (fallback min stock)
- `LOW`: available quantity <= min stock
- `OK`: above thresholds

## Compatibility

This layer is read-only and additive. It does not change Work Order, Request, PM, Inventory, PO, SLA, Mobile UI, Scan, or navigation behavior.
