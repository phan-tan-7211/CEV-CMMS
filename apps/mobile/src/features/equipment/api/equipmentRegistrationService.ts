import { mobileSupabaseConfigured } from '../../../lib/supabase/client'
import { createEquipment } from './equipmentCreateService'
import { uploadEquipmentPhoto } from './equipmentPhotoMutationService'
import { rememberCreatedEquipment } from './equipmentRepository'

export const equipmentRegistrationConfigured = mobileSupabaseConfigured
export type EquipmentRegistrationInput = Parameters<typeof createEquipment>[0]
export type EquipmentRegistrationResult = Awaited<ReturnType<typeof createEquipment>> & { photoError?: string }

export async function submitEquipmentRegistration(
  input: EquipmentRegistrationInput,
  photoUri?: string | null,
): Promise<EquipmentRegistrationResult> {
  const result = await createEquipment(input)

  if (!photoUri) {
    void rememberCreatedEquipment(result.equipmentId)
    return result
  }

  try {
    await uploadEquipmentPhoto(result.equipmentId, photoUri)
    void rememberCreatedEquipment(result.equipmentId)
    return result
  } catch (error) {
    void rememberCreatedEquipment(result.equipmentId)
    return {
      ...result,
      photoError: error instanceof Error ? error.message : 'Không tải được ảnh.',
    }
  }
}
