// Public API for the Equipment feature.
// Route screens and registration flow consume Equipment capabilities through
// this boundary instead of reaching into private feature files or Supabase.

export { EquipmentPhoto } from './ui/EquipmentPhoto'
export { SuggestField } from './ui/SuggestField'

export type {
  EquipmentDetail,
  EquipmentListItem,
} from './api/equipmentService'

export {
  getEquipmentDetailSnapshot,
  getEquipmentListSnapshot,
  isEquipmentDetailStale,
  isEquipmentListStale,
  rememberCreatedEquipment,
  revalidateEquipmentDetail,
  revalidateEquipmentList,
  subscribeEquipmentDetail,
  subscribeEquipmentList,
  updateEquipmentStatusCached as updateEquipmentStatus,
} from './api/equipmentRepository'

export {
  createEquipmentStatusCached as createEquipmentStatus,
  deleteEquipmentStatusMasterCached as deleteEquipmentStatusMaster,
  listEquipmentStatusesCached as listEquipmentStatuses,
  updateEquipmentStatusMasterCached as updateEquipmentStatusMaster,
} from './api/equipmentStatusRepository'

export {
  setEquipmentStatus,
  type EquipmentStatusMaster,
} from './api/equipmentStatusService'

export {
  equipmentRegistrationConfigured,
  submitEquipmentRegistration,
  type EquipmentRegistrationInput,
  type EquipmentRegistrationResult,
} from './api/equipmentRegistrationService'

export {
  canonicalizeEquipmentValue,
  cleanEquipmentText,
  EMPTY_EQUIPMENT_SUGGESTIONS,
  equipmentMatchKey,
  loadEquipmentSuggestions,
  rememberEquipmentSuggestion,
  type EquipmentSuggestionKey,
  type EquipmentSuggestionMap,
} from './model/equipmentSuggestions'

export {
  applyEquipmentFilter,
  EMPTY_EQUIPMENT_FILTER,
  hasEquipmentFilter,
  NO_ASSIGNEES_FILTER_VALUE,
  uniqueEquipmentFilterValues,
  type EquipmentFilter,
} from './model/equipmentFilter'
