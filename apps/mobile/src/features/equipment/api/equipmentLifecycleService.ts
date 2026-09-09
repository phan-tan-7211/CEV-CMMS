import { supabase } from '../../../lib/supabase/client'

export type EquipmentLifecycleEvent = {
  activityId: string
  eventType: string
  actorLabel: string
  summary: string
  fromStatus: string
  toStatus: string
  createdAt: string
}

export async function listEquipmentLifecycleHistory(equipmentId: string): Promise<EquipmentLifecycleEvent[]> {
  const { data, error } = await supabase.rpc('rpc_cmms_equipment_lifecycle_history', { p_equipment_id: equipmentId, p_limit: 100 })
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const detail = (row.detail || {}) as Record<string, unknown>
    return {
      activityId: String(row.activity_id || ''),
      eventType: String(row.event_type || ''),
      actorLabel: String(row.actor_label || ''),
      summary: String(row.summary || ''),
      fromStatus: String(detail.fromStatus || ''),
      toStatus: String(detail.toStatus || ''),
      createdAt: String(row.created_at || ''),
    }
  })
}
