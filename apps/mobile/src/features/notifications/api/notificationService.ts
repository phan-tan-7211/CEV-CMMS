import { supabase } from '../../../lib/supabase/client'

export type NotificationItem = {
  notificationId: string
  type: string
  entityType: string
  entityId: string
  title: string
  body: string
  priority: string
  readAt: string
  createdAt: string
}

export async function listNotifications(unreadOnly = false): Promise<NotificationItem[]> {
  const { data, error } = await supabase.rpc('rpc_cmms_notification_inbox', { p_unread_only: unreadOnly, p_limit: 100, p_offset: 0 })
  if (error) throw error
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    notificationId: String(row.notification_id || ''),
    type: String(row.notification_type || ''),
    entityType: String(row.entity_type || ''),
    entityId: String(row.entity_id || ''),
    title: String(row.title || ''),
    body: String(row.body || ''),
    priority: String(row.priority || ''),
    readAt: String(row.read_at || ''),
    createdAt: String(row.created_at || ''),
  }))
}

export async function markNotificationRead(notificationId: string) {
  const { data, error } = await supabase.rpc('rpc_cmms_mark_notification_read', { p_notification_id: notificationId })
  if (error) throw error
  return Boolean(data)
}
