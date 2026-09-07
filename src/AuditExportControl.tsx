import { useState } from 'react'
import { buildAuditPackage, downloadBlob } from './data/auditPackage'

type ExportSummary = {
  filename: string
  tableCount: number
  evidenceCount: number
}

function sumRecordValues(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0
  return Object.values(value as Record<string, unknown>).reduce((total, item) => {
    const parsed = Number(item)
    return total + (Number.isFinite(parsed) ? parsed : 0)
  }, 0)
}

export function AuditExportControl() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<'idle' | 'success' | 'error'>('idle')
  const [summary, setSummary] = useState<ExportSummary | null>(null)

  async function exportPackage() {
    setRunning(true)
    setTone('idle')
    setSummary(null)
    setMessage('Đang đọc dữ liệu, lập danh mục bằng chứng và tạo checksum…')
    try {
      const result = await buildAuditPackage()
      downloadBlob(result.blob, result.filename)
      const tableCounts = result.manifest.tableCounts
      const bucketCounts = result.manifest.bucketCounts
      setSummary({
        filename: result.filename,
        tableCount: tableCounts && typeof tableCounts === 'object' && !Array.isArray(tableCounts) ? Object.keys(tableCounts as Record<string, unknown>).length : 0,
        evidenceCount: sumRecordValues(bucketCounts),
      })
      setTone('success')
      setMessage('Gói bằng chứng đã được tạo và tải xuống.')
    } catch (cause) {
      setTone('error')
      setMessage(cause instanceof Error ? cause.message : 'Không thể tạo gói bằng chứng kiểm tra')
    } finally {
      setRunning(false)
    }
  }

  return <div className="audit-export-control">
    <button type="button" disabled={running} aria-busy={running} onClick={() => void exportPackage()}>{running ? 'Đang đóng gói…' : 'Xuất gói bằng chứng (.zip)'}</button>
    {message ? <div className={`audit-export-status ${tone}`} role="status" aria-live="polite">
      <strong>{message}</strong>
      {summary ? <span>{summary.tableCount} bảng dữ liệu · {summary.evidenceCount} tệp bằng chứng · {summary.filename}</span> : <span>{running ? 'Bao gồm snapshot dữ liệu, manifest Storage và checksums.sha256.' : 'Gói ZIP dành cho truy vết / kiểm tra IATF.'}</span>}
    </div> : null}
  </div>
}
