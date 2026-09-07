import { isClientCacheFresh, readClientCache, writeClientCache } from './clientDataCache'
import { dataGateway } from './dataGateway'

export type CalibrationLinkState = 'LINKED' | 'UNLINKED' | 'ORPHAN' | 'INVALID_TYPE'

export type LiveCalibration = {
  calibrationEquipmentId: string
  equipmentId: string
  controlNumber: string
  department: string
  category: string
  instrumentName: string
  localName: string
  specification: string
  accuracy: string
  model: string
  manufacturer: string
  serialNumber: string
  lastCalibrationDate: string
  nextDueDate: string
  instrumentStatus: string
  active: boolean
  linkState: CalibrationLinkState
}

export type LiveCalibrationLog = {
  calibrationLogId: string
  equipmentId: string
  calibrationDate: string
  nextDueDate: string
  result: string
  actorEmail: string
  provider: string
  note: string
  certificatePath: string
  certificateUrl: string
  createdAt: string
}

type EquipmentIdentity = {
  equipmentId: string
  equipmentType: string
  controlNumber: string
  department: string
  equipmentName: string
  model: string
  manufacturer: string
  serialNumber: string
  sourceData: Record<string, unknown>
}

type CalibrationLogCacheEntry = { savedAt: number; data: LiveCalibrationLog[] }

const CALIBRATION_CACHE_KEY = 'cev:data:calibration-master'
const CALIBRATION_CACHE_VERSION = 1
const CALIBRATION_CACHE_FRESH_MS = 30_000
const CALIBRATION_LOG_FRESH_MS = 60_000
const restoredCalibrationCache = readClientCache<LiveCalibration[]>(CALIBRATION_CACHE_KEY, CALIBRATION_CACHE_VERSION)
let calibrationCache: LiveCalibration[] | null = restoredCalibrationCache?.data || null
let calibrationCacheSavedAt = restoredCalibrationCache?.savedAt || 0
let calibrationRefreshPromise: Promise<LiveCalibration[]> | null = null
const calibrationLogCache = new Map<string, CalibrationLogCacheEntry>()
const calibrationLogPromises = new Map<string, Promise<LiveCalibrationLog[]>>()

function text(value: unknown) { return value == null ? '' : String(value).trim() }

function persistCalibrationCache() {
  if (!calibrationCache) return
  const saved = writeClientCache(CALIBRATION_CACHE_KEY, CALIBRATION_CACHE_VERSION, calibrationCache)
  calibrationCacheSavedAt = saved.savedAt
}

export function getCalibrationCacheSnapshot(): LiveCalibration[] {
  return calibrationCache ? [...calibrationCache] : []
}

function patchCalibrationCacheAfterRecord(equipmentId: string, calibrationDate: string, nextDueDate: string, result: string) {
  if (!calibrationCache) return
  calibrationCache = calibrationCache.map((row) => row.equipmentId === equipmentId ? {
    ...row,
    lastCalibrationDate: calibrationDate,
    nextDueDate,
    instrumentStatus: result === 'FAIL' ? 'FAILED' : row.instrumentStatus,
  } : row)
  persistCalibrationCache()
}

function toEquipment(row: Record<string, unknown>): EquipmentIdentity {
  return {
    equipmentId: text(row.equipment_id), equipmentType: text(row.equipment_type), controlNumber: text(row.control_number), department: text(row.department), equipmentName: text(row.equipment_name), model: text(row.model), manufacturer: text(row.manufacturer), serialNumber: text(row.serial_number), sourceData: (row.source_data as Record<string, unknown> | null) || {},
  }
}

async function fetchCalibrationFromServer(): Promise<LiveCalibration[]> {
  if (calibrationRefreshPromise) return calibrationRefreshPromise
  calibrationRefreshPromise = (async () => {
    const [calibrationResult, equipmentResult] = await Promise.all([
      dataGateway.readRows('calibration_master', { columns: '*', order: { column: 'equipment_id' } }),
      dataGateway.readRows('equipment_master', { columns: '*' }),
    ])
    if (calibrationResult.error) throw calibrationResult.error
    if (equipmentResult.error) throw equipmentResult.error

    const equipmentMap = new Map<string, EquipmentIdentity>()
    equipmentResult.data.forEach((row) => {
      const equipment = toEquipment(row)
      if (equipment.equipmentId) equipmentMap.set(equipment.equipmentId, equipment)
    })

    calibrationCache = calibrationResult.data.map((row) => {
      const equipmentId = text(row.equipment_id)
      const equipment = equipmentMap.get(equipmentId)
      const source = ((row.source_data as Record<string, unknown> | null) || {})
      const linkState: CalibrationLinkState = !equipmentId ? 'UNLINKED' : !equipment ? 'ORPHAN' : equipment.equipmentType === 'MEASUREMENT' ? 'LINKED' : 'INVALID_TYPE'
      return {
        calibrationEquipmentId: text(row.calibration_id), equipmentId,
        controlNumber: equipment?.controlNumber || text(source.controlNumber), department: equipment?.department || text(source.department), category: text(equipment?.sourceData.classification || source.category), instrumentName: equipment?.equipmentName || text(source.instrumentName), localName: text(equipment?.sourceData.description || source.localName), specification: text(equipment?.sourceData.specification || source.specification), accuracy: text(equipment?.sourceData.accuracy || source.accuracy), model: equipment?.model || text(source.model), manufacturer: equipment?.manufacturer || text(source.manufacturer), serialNumber: equipment?.serialNumber || text(source.serialNumber), lastCalibrationDate: text(row.last_calibration_date), nextDueDate: text(row.next_due_date), instrumentStatus: text(row.status), active: Boolean(equipment), linkState,
      }
    })
    persistCalibrationCache()
    return calibrationCache
  })().finally(() => { calibrationRefreshPromise = null })
  return calibrationRefreshPromise
}

export async function loadLiveCalibration(options: { force?: boolean } = {}): Promise<LiveCalibration[]> {
  if (!options.force && calibrationCache && isClientCacheFresh(calibrationCacheSavedAt, CALIBRATION_CACHE_FRESH_MS)) return calibrationCache
  try {
    return await fetchCalibrationFromServer()
  } catch (cause) {
    if (calibrationCache) return calibrationCache
    throw cause
  }
}

export function invalidateCalibrationLogs(equipmentId: string) {
  const id = equipmentId.trim()
  calibrationLogCache.delete(id)
  calibrationLogPromises.delete(id)
}

export async function loadCalibrationLogs(equipmentId: string, options: { force?: boolean } = {}): Promise<LiveCalibrationLog[]> {
  const id = equipmentId.trim()
  if (!id) return []
  const cached = calibrationLogCache.get(id)
  if (!options.force && cached && isClientCacheFresh(cached.savedAt, CALIBRATION_LOG_FRESH_MS)) return cached.data
  const inFlight = calibrationLogPromises.get(id)
  if (inFlight) return inFlight

  const task = (async () => {
    const { data, error } = await dataGateway.readRows('calibration_log', {
      columns: '*',
      eq: [{ column: 'equipment_id', value: id }],
      order: { column: 'calibration_date', ascending: false },
      limit: 50,
    })
    if (error) {
      if (cached) return cached.data
      throw error
    }
    const normalized = await Promise.all(data.map(async (row) => {
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const certificatePath = text(source.certificatePath)
      let certificateUrl = ''
      if (certificatePath) {
        const signed = await dataGateway.createSignedUrl('calibration-certificates', certificatePath, 3600)
        if (!signed.error) certificateUrl = signed.data
      }
      return {
        calibrationLogId: text(row.calibration_log_id), equipmentId: text(row.equipment_id), calibrationDate: text(row.calibration_date), nextDueDate: text(row.next_due_date), result: text(row.result), actorEmail: text(row.actor_email), provider: text(source.provider), note: text(source.note), certificatePath, certificateUrl, createdAt: text(row.created_at),
      }
    }))
    calibrationLogCache.set(id, { savedAt: Date.now(), data: normalized })
    return normalized
  })().finally(() => { calibrationLogPromises.delete(id) })

  calibrationLogPromises.set(id, task)
  return task
}

async function uploadCalibrationCertificate(equipmentId: string, file: File) {
  if (file.size > 15 * 1024 * 1024) throw new Error('CERTIFICATE_TOO_LARGE_MAX_15MB')
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || 'bin' : 'bin'
  const path = `${equipmentId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  const { error } = await dataGateway.upload('calibration-certificates', path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  return path
}

export async function recordCalibration(input: {
  equipmentId: string
  calibrationDate: string
  nextDueDate: string
  result: 'PASS' | 'FAIL' | 'LIMITED_USE'
  provider: string
  note: string
  certificate?: File
}) {
  let certificatePath = ''
  try {
    if (input.certificate) certificatePath = await uploadCalibrationCertificate(input.equipmentId, input.certificate)
    const { data, error } = await dataGateway.rpc<Record<string, unknown>>('rpc_record_calibration', {
      p_equipment_id: input.equipmentId,
      p_calibration_date: input.calibrationDate,
      p_next_due_date: input.nextDueDate,
      p_result: input.result,
      p_provider: input.provider.trim(),
      p_certificate_path: certificatePath,
      p_note: input.note.trim(),
    })
    if (error) throw error
    patchCalibrationCacheAfterRecord(input.equipmentId, input.calibrationDate, input.nextDueDate, input.result)
    invalidateCalibrationLogs(input.equipmentId)
    return data || {}
  } catch (cause) {
    if (certificatePath) await dataGateway.remove('calibration-certificates', [certificatePath])
    throw cause
  }
}
