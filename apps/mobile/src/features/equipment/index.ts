// Public API for the Equipment feature.
// Route screens and registration flow consume Equipment capabilities through
// this boundary instead of reaching into private feature files or Supabase.

export { EquipmentPhoto } from './ui/EquipmentPhoto'
export { SuggestField } from './ui/SuggestField'

export {
  getEquipmentDetail,
  listEquipment,
  updateEquipmentStatus,
  type EquipmentDetail,
  type EquipmentListItem,
} from './api/equipmentService'

export {
  createEquipmentStatus,
  deleteEquipmentStatusMaster,
  listEquipmentStatuses,
  setEquipmentStatus,
  updateEquipmentStatusMaster,
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
