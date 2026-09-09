import { supabase } from '../../../lib/supabase/client'

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || `Không thực hiện được ${name}.`)
  return data as T
}

export type CustomWorkOrderStatus = {
  statusCode: string
  displayName: string
  canonicalStatus: string
  color: string
  sortOrder: number
  active: boolean
}

export type WorkOrderFeedback = {
  feedbackId: string
  workOrderId: string
  rating: number
  comment: string
  submittedAt: string
}

export type ProviderOption = {
  partyId: string
  companyName: string
  contactName: string
  email: string
  phone: string
  partyKind: string
}

export type ProviderShare = {
  shareId: string
  workOrderId: string
  providerId: string
  providerName: string
  token: string
  status: string
  expiresAt?: string | null
  createdAt: string
  revokedAt?: string | null
}

export type CompletedWorkOrder = {
  workOrderId: string
  equipmentId: string
  status: string
  reason: string
  updatedAt: string
}

export type ReliabilityRow = {
  equipmentId: string
  equipmentName: string
  status: string
  locationName: string
  failureCount: number
  downtimeHours: number
  mttrHours: number
  mtbfHours: number
}

export type WorkOrderCostRow = {
  workOrderId: string
  equipmentId: string
  equipmentName: string
  status: string
  priority: string
  partsCost: number
  laborCost: number
  laborMinutes: number
  totalCost: number
}

export type DowntimeAnalyticsRow = {
  downtimeId: string
  equipmentId: string
  equipmentName: string
  locationName: string
  workOrderId?: string | null
  startedAt: string
  endedAt?: string | null
  downtimeMinutes: number
  isOpen: boolean
}

export type FinalParitySnapshot = {
  customStatuses: CustomWorkOrderStatus[]
  feedback: WorkOrderFeedback[]
  providers: ProviderOption[]
  providerShares: ProviderShare[]
  recentCompletedWorkOrders: CompletedWorkOrder[]
  reliability: ReliabilityRow[]
  workOrderCost: WorkOrderCostRow[]
  downtime: DowntimeAnalyticsRow[]
}

export type ProviderPortalSnapshot = {
  shareId: string
  workOrderId: string
  providerName: string
  contactName: string
  shareStatus: string
  workOrderStatus: string
  equipmentId: string
  equipmentName: string
  reason: string
  priority: string
  expiresAt?: string | null
  activity: Array<{ action: string; note: string; actorLabel: string; createdAt: string }>
}

export function loadFinalParity(limit = 100) {
  return rpc<FinalParitySnapshot>('rpc_cmms_final_parity_snapshot', { p_limit: limit })
}

export function saveCustomWorkOrderStatus(input: {
  statusCode: string
  displayName: string
  canonicalStatus: string
  color?: string
  sortOrder?: number
  active?: boolean
}) {
  return rpc<{ statusCode: string }>('rpc_cmms_save_work_order_custom_status', { p_input: input })
}

export function setWorkOrderCustomStatus(workOrderId: string, statusCode: string) {
  return rpc<{ workOrderId: string; statusCode: string; canonicalStatus: string }>('rpc_cmms_set_work_order_custom_status', {
    p_work_order_id: workOrderId,
    p_status_code: statusCode,
  })
}

export function submitWorkOrderFeedback(workOrderId: string, rating: number, comment?: string) {
  return rpc<{ feedbackId: string }>('rpc_cmms_submit_work_order_feedback', {
    p_work_order_id: workOrderId,
    p_rating: rating,
    p_comment: comment || null,
  })
}

export function createProviderShare(workOrderId: string, providerId: string, expiresAt?: string) {
  return rpc<{ shareId: string; token: string }>('rpc_cmms_create_provider_share', {
    p_work_order_id: workOrderId,
    p_provider_id: providerId,
    p_expires_at: expiresAt || null,
  })
}

export function revokeProviderShare(shareId: string) {
  return rpc<{ shareId: string; status: string }>('rpc_cmms_revoke_provider_share', { p_share_id: shareId })
}

export function loadProviderPortalByToken(token: string) {
  return rpc<ProviderPortalSnapshot>('rpc_cmms_provider_portal_snapshot', { p_token: token })
}

export function providerPortalAction(token: string, action: 'ACKNOWLEDGE' | 'START' | 'COMPLETE' | 'COMMENT', note?: string, actorLabel?: string) {
  return rpc<{ shareId: string; status: string; action: string }>('rpc_cmms_provider_portal_action', {
    p_token: token,
    p_action: action,
    p_note: note || null,
    p_actor_label: actorLabel || null,
  })
}
