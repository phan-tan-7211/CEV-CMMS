import { supabase } from '../../../lib/supabase/client'

export async function saveMeter(input: { equipmentId: string; name: string; meterType?: string; unit: string; rolloverValue?: number | null }) {
  const { data, error } = await supabase.rpc('rpc_cmms_save_meter', {
    p_input: {
      equipmentId: input.equipmentId.trim(),
      name: input.name.trim(),
      meterType: input.meterType || 'COUNTER',
      unit: input.unit.trim(),
      rolloverValue: input.rolloverValue ?? '',
    },
  })
  if (error) throw new Error(error.message || 'Không tạo được meter.')
  return data as { meterId: string }
}
