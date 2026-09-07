# Status settings fixes

- Removed the floating add button that could overlap row actions.
- Added a normal-flow `Thêm trạng thái mới` CTA above the status table.
- Replaced web-incompatible delete confirmation via `Alert.alert` with an in-app modal.
- Kept delete wired to `rpc_delete_equipment_status_master` through `deleteEquipmentStatusMaster`, then reloads the master list.
- Consolidated rows into a bordered table/card with dedicated Status, Usage and Action columns.
