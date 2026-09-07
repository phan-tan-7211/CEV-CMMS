import { dataGateway } from './dataGateway'
import { fetchSourceRows } from './sourceRows'
import { createStoredZip, sha256Hex, type ZipEntry } from '../utils/zipStore'

export const AUDIT_TABLES = [
  'equipment_master', 'daily_inspection', 'daily_inspection_item', 'maintenance_plan',
  'maintenance_plan_item', 'maintenance_work_order', 'maintenance_execution', 'maintenance_result_item',
  'maintenance_log', 'equipment_handover', 'downtime_event', 'tooling_master', 'tooling_maintenance_plan',
  'tooling_modification', 'calibration_master', 'calibration_log', 'calibration_vendor_quote',
  'calibration_quote_summary', 'equipment_movement_log', 'audit_log',
] as const

export const EVIDENCE_BUCKETS = [
  'equipment-photos', 'manuals-and-setup', 'maintenance-before-after', 'calibration-certificates',
  'calibration-label-photos', 'tooling-drawings', 'tooling-change-attachments', 'handover-records',
  'official-pdf-snapshots',
] as const

type EvidenceFile = { bucket: string; path: string; id: string | null; createdAt: string | null; updatedAt: string | null; size: number | null; mimeType: string | null }

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function listBucketRecursive(bucket: string, prefix = '', depth = 0): Promise<EvidenceFile[]> {
  if (depth > 10) throw new Error(`${bucket}: storage tree exceeds safe depth`)
  const output: EvidenceFile[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await dataGateway.listFiles(bucket, prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw new Error(`${bucket}/${prefix}: ${errorMessage(error)}`)
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id) {
        output.push({
          bucket,
          path,
          id: item.id,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          size: item.size,
          mimeType: item.mimeType,
        })
      } else {
        output.push(...await listBucketRecursive(bucket, path, depth + 1))
      }
    }
    if (data.length < pageSize) break
  }
  return output
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

export type AuditPackageResult = {
  blob: Blob
  filename: string
  manifest: Record<string, unknown>
}

export async function buildAuditPackage(): Promise<AuditPackageResult> {
  const { data: user, error: sessionError } = await dataGateway.getSessionUser()
  if (sessionError) throw sessionError
  if (!user) throw new Error('AUTH_REQUIRED')

  const { data: roleRow, error: roleError } = await dataGateway.readOne('app_user_role', {
    columns: 'role',
    eq: [{ column: 'user_id', value: user.id }],
  })
  if (roleError) throw roleError
  if (roleRow?.role !== 'ADMIN') throw new Error('AUDIT_EXPORT_ADMIN_ONLY')

  const exportedAt = new Date()
  const entries: ZipEntry[] = []
  const tableCounts: Record<string, number> = {}
  for (const table of AUDIT_TABLES) {
    const rows = await fetchSourceRows(table)
    tableCounts[table] = rows.length
    entries.push({ name: `database/${table}.json`, data: stableJson(rows) })
  }

  const evidence: EvidenceFile[] = []
  const bucketCounts: Record<string, number> = {}
  for (const bucket of EVIDENCE_BUCKETS) {
    const files = await listBucketRecursive(bucket)
    bucketCounts[bucket] = files.length
    evidence.push(...files)
  }
  entries.push({ name: 'storage/evidence-manifest.json', data: stableJson(evidence) })

  const manifest = {
    packageVersion: 'CEV-IATF-AUDIT-PACKAGE-1',
    contractVersion: 'G1-frozen-2026-08-28',
    exportedAt: exportedAt.toISOString(),
    completedAt: new Date().toISOString(),
    consistency: 'sequential-read-not-transactional',
    exportedBy: user.email || user.id,
    backend: 'Supabase PostgreSQL + Auth/RLS + Storage',
    tableCounts,
    bucketCounts,
    notes: [
      'Sequential source reads between exportedAt and completedAt; concurrent writes can affect cross-table consistency.',
      'After extraction run: sha256sum -c checksums.sha256 (Linux), or shasum -a 256 -c checksums.sha256 (macOS).',
      'Checksums detect corruption; they are not a digital signature or proof of authenticity.',
      'Evidence manifest contains private Storage object paths and metadata; binary evidence remains governed by Storage RLS.',
      'checksums.sha256 covers every file inside this ZIP except itself.',
    ],
  }
  entries.unshift({ name: 'manifest.json', data: stableJson(manifest) })

  const checksumLines: string[] = []
  for (const entry of entries) checksumLines.push(`${await sha256Hex(entry.data)}  ${entry.name}`)
  entries.push({ name: 'checksums.sha256', data: `${checksumLines.join('\n')}\n` })

  const zip = createStoredZip(entries, exportedAt)
  const stamp = exportedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return {
    blob: new Blob([zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer], { type: 'application/zip' }),
    filename: `CEV-IATF-Audit-Package-${stamp}.zip`,
    manifest,
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
