# CMMS Inventory & Purchase Order Contract

Backend-only contract for Mobile/Web integration. Existing UI ownership remains unchanged.

## Inventory master

`cmms_part`
- part number / barcode / manufacturer
- unit and unit cost
- min stock / max stock / reorder point / reorder quantity
- lead time
- critical flag
- archive support

`cmms_stock_location`
- warehouse / stockroom / bin / van / line-side / consignment
- may link to normalized `cmms_location`
- supports parent-child stock locations

`cmms_part_stock`
- quantity on hand
- quantity reserved
- average unit cost

`cmms_part_vendor`
- vendor part number
- preferred vendor
- vendor unit cost
- MOQ
- lead time

## Stock ledger

`cmms_stock_transaction` is the auditable inventory ledger.

Transaction types:
- RECEIPT
- ISSUE
- RETURN
- TRANSFER_IN / TRANSFER_OUT
- ADJUSTMENT_IN / ADJUSTMENT_OUT
- RESERVE / UNRESERVE

Work Order part usage can now reference:
- inventory part
- stock location
- stock transaction

RPC `rpc_cmms_inventory_issue_to_work_order` atomically:
1. checks available quantity,
2. decrements stock,
3. writes ledger transaction,
4. writes Work Order part usage.

## Low stock / reorder

`rpc_cmms_low_stock`
- available = on hand - reserved
- compares against reorder point, falling back to minimum stock
- returns suggested order quantity
- returns preferred vendor when available

`rpc_cmms_generate_reorder_requests`
- creates one open reorder request per part/location
- duplicate open requests are prevented

## Purchase Orders

Tables:
- `cmms_purchase_order`
- `cmms_purchase_order_line`
- `cmms_reorder_request`

Lifecycle:
`DRAFT -> PENDING_APPROVAL -> APPROVED -> ORDERED -> PARTIALLY_RECEIVED -> RECEIVED -> CLOSED`

Cancellation is allowed before final receipt/close.

`rpc_cmms_create_purchase_order_from_reorders`
- groups selected reorder requests into a PO for one vendor
- uses vendor cost first, then part default cost
- links reorder requests to the PO

`rpc_cmms_receive_purchase_order_line`
- validates remaining quantity
- receives into the selected stock location
- updates moving average cost
- writes RECEIPT ledger transaction
- updates line received quantity
- changes PO to PARTIALLY_RECEIVED or RECEIVED
- fulfills reorder requests when the PO is completely received

## Compatibility

No existing Mobile screens, navigation, Scan flow, Work Orders styling, Requests styling or More screen are changed.

The Work Order part-usage table from the previous backend batch remains compatible; inventory linkage is additive.
