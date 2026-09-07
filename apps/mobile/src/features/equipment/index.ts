// Public API for the Equipment feature.
// Route screens should import Equipment domain capabilities from this module
// instead of reaching into service implementation files directly.

export { EquipmentPhoto } from '../../components/EquipmentPhoto'

export {
  getEquipmentDetail,
  listEquipment,
  updateEquipmentStatus,
  type EquipmentDetail,
  type EquipmentListItem,
} from '../../services/equipmentService'

export {
  createEquipmentStatus,
  deleteEquipmentStatusMaster,
  listEquipmentStatuses,
  setEquipmentStatus,
  updateEquipmentStatusMaster,
  type EquipmentStatusMaster,
} from '../../services/equipmentStatusService'
