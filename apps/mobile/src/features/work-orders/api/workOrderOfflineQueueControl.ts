import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../../lib/supabase/client'
import { syncQueuedWorkOrderMutations, type WorkOrderOfflineMutation } from './workOrderOfflineMutationQueue'

const STORAGE_KEY_PREFIX = 'cev.cmms.work-order-mutations.v1'
const QUEUE_LIMIT = 300

async function storageKey() {
  const { data } = await supabase.auth.getSession()
  return `${STORAGE_KEY_PREFIX}:${data.session?.user.id || 'signed-out'}`
}

async function readQueue(): Promise<WorkOrderOfflineMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(await storageKey())
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, QUEUE_LIMIT) : []
  } catch {
    return []
  }
}

async function writeQueue(rows: WorkOrderOfflineMutation[]) {
  await AsyncStorage.setItem(await storageKey(), JSON.stringify(rows.slice(0, QUEUE_LIMIT)))
}

export async function retryWorkOrderOfflineMutation(mutationId: string) {
  const rows = await readQueue()
  const index = rows.findIndex((row) => row.mutationId === mutationId)
  if (index < 0) return null
  rows[index] = { ...rows[index], state: 'PENDING', lastError: undefined, updatedAt: new Date().toISOString() }
  await writeQueue(rows)
  return syncQueuedWorkOrderMutations()
}

export async function discardWorkOrderOfflineMutation(mutationId: string) {
  const rows = await readQueue()
  await writeQueue(rows.filter((row) => row.mutationId !== mutationId))
}
