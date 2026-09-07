// Legacy compatibility surface. New code must use src/lib/supabase/client for
// infrastructure access and feature public APIs for business capabilities.
export { mobileSupabaseConfigured, supabase } from './lib/supabase/client'

export {
  createEquipment,
  type EquipmentCreateInput,
  type EquipmentCreateResult,
} from './features/equipment/api/equipmentCreateService'

export { uploadEquipmentPhoto } from './features/equipment/api/equipmentPhotoMutationService'
