import { supabase } from './supabaseClient'

export type MaintenanceAssigneeOption = {
  personCode: string
  displayName: string
  unitCode: string
  jobTitle: string
}

export type MaintenanceAssignmentState = {
  workOrderId: string
  assignedPersonCode: string
  assignedPersonName: string
  assignedBy: string
  assignedAt: string
}

export type CurrentMaintenancePerson = {
  personCode: string
  displayName: string
  authEmail: string
}

function text(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export async function loadMaintenanceAssignees(): Promise<MaintenanceAssigneeOption[]> {
  const { data, error } = await supabase
    .from('org_people')
    .select('person_code,display_name,unit_code,job_title,active')
    .eq('active', true)
    .order('display_name')

  if (error) throw error

  return ((data || []) as Array<Record<string, unknown>>)
    .map((row) => ({
      personCode: text(row.person_code),
      displayName: text(row.display_name),
      unitCode: text(row.unit_code),
      jobTitle: text(row.job_title),
    }))
    .filter((item) => item.personCode && item.displayName)
}

export async function loadCurrentMaintenancePerson(): Promise<CurrentMaintenancePerson | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  const email = text(authData.user?.email).toLowerCase()
  if (!email) return null

  const { data, error } = await supabase
    .from('org_people')
    .select('person_code,display_name,auth_email,active')
    .ilike('auth_email', email)
    .eq('active', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    personCode: text(data.person_code),
    displayName: text(data.display_name),
    authEmail: text(data.auth_email).toLowerCase(),
  }
}

export function assignmentFromSource(workOrderId: string, sourceData: unknown): MaintenanceAssignmentState {
  const source = sourceData && typeof sourceData === 'object' ? sourceData as Record<string, unknown> : {}
  return {
    workOrderId,
    assignedPersonCode: text(source.assignedPersonCode),
    assignedPersonName: text(source.assignedPersonName),
    assignedBy: text(source.assignedBy),
    assignedAt: text(source.assignedAt),
  }
}

export async function loadMaintenanceAssignment(workOrderId: string): Promise<MaintenanceAssignmentState> {
  const id = workOrderId.trim()
  if (!id) throw new Error('WORK_ORDER_ID_REQUIRED')

  const { data, error } = await supabase
    .from('maintenance_work_order')
    .select('work_order_id,source_data')
    .eq('work_order_id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('WORK_ORDER_NOT_FOUND')

  return assignmentFromSource(text(data.work_order_id), data.source_data)
}

export async function assignMaintenanceWorkOrder(input: {
  workOrderId: string
  personCode: string
  operationId: string
}): Promise<MaintenanceAssignmentState> {
  const { data, error } = await supabase.rpc('rpc_assign_maintenance_work_order', {
    p_work_order_id: input.workOrderId.trim(),
    p_person_code: input.personCode.trim(),
    p_operation_id: input.operationId,
  })

  if (error) throw error
  const result = (data || {}) as Record<string, unknown>

  return {
    workOrderId: text(result.workOrderId) || input.workOrderId.trim(),
    assignedPersonCode: text(result.assignedPersonCode),
    assignedPersonName: text(result.assignedPersonName),
    assignedBy: text(result.assignedBy),
    assignedAt: text(result.assignedAt),
  }
}
