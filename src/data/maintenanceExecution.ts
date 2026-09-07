import { supabase } from './supabaseClient'

export type MaintenanceExecutionDetail = {
  workOrderId: string
  rootCause: string
  correctiveAction: string
  preventiveAction: string
  executionNote: string
  actualStartAt: string
  actualCompletedAt: string
  verifiedBy: string
  verifiedAt: string
  releasedBy: string
  releasedAt: string
  downtimeId: string
  downtimeStartedAt: string
  downtimeEndedAt: string
  downtimeCauseCategory: string
  downtimeDetail: string
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }
function source(value: unknown) { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }

export async function loadMaintenanceExecutionDetail(workOrderId: string): Promise<MaintenanceExecutionDetail> {
  const id = workOrderId.trim()
  if (!id) throw new Error('WORK_ORDER_ID_REQUIRED')

  const [woResult, downtimeResult] = await Promise.all([
    supabase.from('maintenance_work_order').select('work_order_id,source_data').eq('work_order_id', id).maybeSingle(),
    supabase.from('downtime_event').select('downtime_id,started_at,ended_at,source_data').eq('work_order_id', id).order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (woResult.error) throw woResult.error
  if (downtimeResult.error) throw downtimeResult.error
  if (!woResult.data) throw new Error('WORK_ORDER_NOT_FOUND')

  const woSource = source(woResult.data.source_data)
  const downtime = downtimeResult.data
  const downtimeSource = source(downtime?.source_data)

  return {
    workOrderId: text(woResult.data.work_order_id),
    rootCause: text(woSource.rootCause),
    correctiveAction: text(woSource.correctiveAction),
    preventiveAction: text(woSource.preventiveAction),
    executionNote: text(woSource.executionNote),
    actualStartAt: text(woSource.actualStartAt),
    actualCompletedAt: text(woSource.actualCompletedAt),
    verifiedBy: text(woSource.verifiedBy),
    verifiedAt: text(woSource.verifiedAt),
    releasedBy: text(woSource.releasedBy),
    releasedAt: text(woSource.releasedAt),
    downtimeId: text(downtime?.downtime_id),
    downtimeStartedAt: text(downtime?.started_at),
    downtimeEndedAt: text(downtime?.ended_at),
    downtimeCauseCategory: text(downtimeSource.causeCategory),
    downtimeDetail: text(downtimeSource.detail),
  }
}

export async function saveMaintenanceExecutionDetail(input: {
  workOrderId: string
  rootCause: string
  correctiveAction: string
  preventiveAction: string
  executionNote: string
  actualStartAt: string
  actualCompletedAt: string
  downtimeStartedAt: string
  downtimeEndedAt: string
  downtimeCauseCategory: string
  downtimeDetail: string
  operationId: string
}) {
  const { data, error } = await supabase.rpc('rpc_save_maintenance_execution', {
    p_work_order_id: input.workOrderId.trim(),
    p_input: {
      rootCause: input.rootCause.trim(),
      correctiveAction: input.correctiveAction.trim(),
      preventiveAction: input.preventiveAction.trim(),
      executionNote: input.executionNote.trim(),
      actualStartAt: input.actualStartAt,
      actualCompletedAt: input.actualCompletedAt,
      downtimeStartedAt: input.downtimeStartedAt,
      downtimeEndedAt: input.downtimeEndedAt,
      downtimeCauseCategory: input.downtimeCauseCategory,
      downtimeDetail: input.downtimeDetail.trim(),
    },
    p_operation_id: input.operationId,
  })
  if (error) throw error
  return data as { workOrderId: string; downtimeId: string; updatedBy: string; updatedAt: string }
}
