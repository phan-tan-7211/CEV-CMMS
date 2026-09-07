# Delete flow

`EquipmentStatusSettingsScreen` opens an in-app confirmation modal. On confirmation it calls `deleteEquipmentStatusMaster(statusCode)`, which invokes `rpc_delete_equipment_status_master`. On success the screen reloads `rpc_list_equipment_status_master`. Errors are rendered in the screen instead of being hidden behind a platform alert.
