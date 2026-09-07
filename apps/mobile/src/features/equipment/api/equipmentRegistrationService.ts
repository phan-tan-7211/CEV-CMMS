import { createEquipment, mobileSupabaseConfigured, uploadEquipmentPhoto } from '../../../supabase'

export const equipmentRegistrationConfigured = mobileSupabaseConfigured
export type EquipmentRegistrationInput = Parameters<typeof createEquipment>[0]
export type EquipmentRegistrationResult = Awaited<ReturnType<typeof createEquipment>> & { photoError?: string }

export async function submitEquipmentRegistration(
  input: EquipmentRegistrationInput,
  photoUri?: string | null,
): Promise<EquipmentRegistrationResult> {
  const result = await createEquipment(input)

  if (!photoUri) return result

  try {
    await uploadEquipmentPhoto(result.equipmentId, photoUri)
    return result
  } catch (error) {
    return {
      ...result,
      photoError: error instanceof Error ? error.message : 'Không tải được ảnh.',
    }
  }
}
