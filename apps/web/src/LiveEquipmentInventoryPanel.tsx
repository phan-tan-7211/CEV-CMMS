import { useEffect, useMemo, useState } from 'react'
import './EquipmentInventory.css'
import { LiveQrScannerPanel } from './LiveQrScannerPanel'
import { getEquipmentPhotoPreviews, type EquipmentPhotoPreview } from './data/supabaseEquipment'
import {
  closeEquipmentInventorySession,
  createEquipmentInventorySession,
  getEquipmentInventoryCacheSnapshot,
  loadEquipmentInventory,
  recordEquipmentInventory,
  type EquipmentInventoryEquipment,
  type EquipmentInventorySnapshot,
  type EquipmentInventorySource,
  type EquipmentInventoryStatus,
} from './data/liveEquipmentInventory'

const EMPTY: EquipmentInventorySnapshot = { equipment: [], sessions: [], results: [] }

const STATUS_LABEL: Record<EquipmentInventoryStatus, string> = {
  FOUND_LABEL_OK: 'Có máy + có tem QR',
  FOUND_NO_LABEL: 'Có máy · thiếu tem QR',
  MOVED: 'Sai vị trí',
  NOT_FOUND: 'Không tìm thấy',
  DATA_INVALID: 'Data rác / sai master',
}

function searchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

function searchTokens(value: string) {
  return searchText(value).split(/[^a-z0-9]+/).filter(Boolean)
}

function editDistance(left: string, right: string) {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from<number>({ length: right.length + 1 })
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j]
  }
  return previous[right.length]
}

function tokenScore(query: string, token: string) {
  if (!query || !token) return 0
  if (token === query) return 120
  if (token.startsWith(query)) return 105
  if (token.includes(query)) return 95
  if (query.startsWith(token) && token.length >= 3) return 82

  const maxLength = Math.max(query.length, token.length)
  if (maxLength >= 3) {
    const distance = editDistance(query, token)
    const allowed = Math.max(1, Math.floor(maxLength * 0.34))
    if (distance <= allowed) return 75 - distance * 8
  }

  let cursor = 0
  for (const character of token) {
    if (character === query[cursor]) cursor += 1
    if (cursor === query.length) break
  }
  if (query.length >= 3 && cursor === query.length) return 52
  return 0
}

function equipmentSearchScore(equipment: EquipmentInventoryEquipment, query: string) {
  const normalizedQuery = searchText(query)
  if (!normalizedQuery) return 1

  const queryWords = searchTokens(normalizedQuery)
  const id = searchText(equipment.equipmentId)
  const name = searchText(equipment.equipmentName)
  const area = searchText(equipment.area)
  const line = searchText(equipment.line)
  const allText = `${id} ${name} ${area} ${line}`
  const tokens = searchTokens(allText)

  let score = 0
  for (const word of queryWords) {
    let best = allText.includes(word) ? 90 : 0
    for (const token of tokens) best = Math.max(best, tokenScore(word, token))
    if (best < 45) return 0
    score += best
  }

  if (id.includes(normalizedQuery)) score += 80
  if (name.includes(normalizedQuery)) score += 60
  if (name.startsWith(normalizedQuery)) score += 30
  return score
}

function currentInventoryName() {
  const now = new Date()
  return `Kiểm kê ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export function LiveEquipmentInventoryPanel() {
  const cached = getEquipmentInventoryCacheSnapshot()
  const [snapshot, setSnapshot] = useState<EquipmentInventorySnapshot>(() => cached || EMPTY)
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState(() => cached?.sessions.find((item) => item.status === 'OPEN')?.sessionId || cached?.sessions[0]?.sessionId || '')
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'SCAN' | 'MANUAL'>('SCAN')
  const [scannerKey, setScannerKey] = useState(0)
  const [manualQuery, setManualQuery] = useState('')
  const [manualPhotos, setManualPhotos] = useState<Record<string, EquipmentPhotoPreview>>({})
  const [selectedId, setSelectedId] = useState('')
  const [selectedSource, setSelectedSource] = useState<EquipmentInventorySource>('MANUAL')
  const [moveOpen, setMoveOpen] = useState(false)
  const [actualArea, setActualArea] = useState('')
  const [actualLine, setActualLine] = useState('')
  const [moveLabelOk, setMoveLabelOk] = useState<boolean | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let active = true
    const existing = getEquipmentInventoryCacheSnapshot()
    void loadEquipmentInventory({ force: Boolean(existing) })
      .then((result) => {
        if (!active) return
        setSnapshot(result)
        setError('')
        setSessionId((current) => current || result.sessions.find((item) => item.status === 'OPEN')?.sessionId || result.sessions[0]?.sessionId || '')
      })
      .catch((cause) => {
        if (active && !existing) setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu kiểm kê')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const activeSession = snapshot.sessions.find((item) => item.sessionId === sessionId) || null
  const sessionResults = useMemo(() => snapshot.results.filter((item) => item.sessionId === sessionId), [snapshot.results, sessionId])
  const resultByEquipment = useMemo(() => new Map(sessionResults.map((item) => [item.equipmentId, item])), [sessionResults])
  const selectedEquipment = selectedId ? snapshot.equipment.find((item) => item.equipmentId === selectedId) || null : null
  const checkedCount = sessionResults.length
  const missingLabelCount = sessionResults.filter((item) => item.status === 'FOUND_NO_LABEL' || (item.status === 'MOVED' && item.labelOk === false)).length
  const movedCount = sessionResults.filter((item) => item.status === 'MOVED').length
  const notFoundCount = sessionResults.filter((item) => item.status === 'NOT_FOUND').length
  const invalidCount = sessionResults.filter((item) => item.status === 'DATA_INVALID').length
  const pendingCount = Math.max(snapshot.equipment.length - checkedCount, 0)

  const manualMatches = useMemo(() => {
    const query = manualQuery.trim()
    if (!query) return snapshot.equipment
      .filter((item) => !resultByEquipment.has(item.equipmentId))
      .slice(0, 20)

    return snapshot.equipment
      .map((equipment) => ({
        equipment,
        score: equipmentSearchScore(equipment, query) + (resultByEquipment.has(equipment.equipmentId) ? 0 : 20),
      }))
      .filter((item) => item.score > 0)
      .toSorted((left, right) => right.score - left.score || left.equipment.equipmentId.localeCompare(right.equipment.equipmentId))
      .slice(0, 30)
      .map((item) => item.equipment)
  }, [manualQuery, resultByEquipment, snapshot.equipment])

  useEffect(() => {
    if (mode !== 'MANUAL' || !manualMatches.length) return
    const missingIds = manualMatches.map((item) => item.equipmentId).filter((id) => !(id in manualPhotos))
    if (!missingIds.length) return
    let active = true
    void getEquipmentPhotoPreviews(missingIds)
      .then((photos) => {
        if (active) setManualPhotos((current) => ({ ...current, ...photos }))
      })
      .catch(() => {
        if (!active) return
        setManualPhotos((current) => ({
          ...current,
          ...Object.fromEntries(missingIds.map((id) => [id, { exists: false, path: '', signedUrl: '' }])),
        }))
      })
    return () => { active = false }
  }, [manualMatches, manualPhotos, mode])

  const abnormalResults = useMemo(() => sessionResults.filter((item) => item.status !== 'FOUND_LABEL_OK').slice(0, 50), [sessionResults])

  function refreshFromCache() {
    const next = getEquipmentInventoryCacheSnapshot()
    if (next) setSnapshot(next)
  }

  async function createSession() {
    setCreating(true)
    setError('')
    setMessage('')
    try {
      const session = await createEquipmentInventorySession(currentInventoryName())
      refreshFromCache()
      setSessionId(session.sessionId)
      setMessage(`Đã tạo ${session.sessionId}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tạo kỳ kiểm kê')
    } finally {
      setCreating(false)
    }
  }

  async function closeSession() {
    if (!activeSession || activeSession.status !== 'OPEN') return
    if (!window.confirm(`Đóng kỳ kiểm kê ${activeSession.sessionId}? Sau khi đóng không thể ghi thêm kết quả.`)) return
    setClosing(true)
    setError('')
    setMessage('')
    try {
      await closeEquipmentInventorySession(activeSession.sessionId)
      refreshFromCache()
      setMessage(`Đã đóng ${activeSession.sessionId}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể đóng kỳ kiểm kê')
    } finally {
      setClosing(false)
    }
  }

  function resetFinding() {
    setSelectedId('')
    setSelectedSource('MANUAL')
    setMoveOpen(false)
    setActualArea('')
    setActualLine('')
    setMoveLabelOk(null)
    setNote('')
  }

  function selectEquipment(equipmentId: string, source: EquipmentInventorySource) {
    setSelectedId(equipmentId)
    setSelectedSource(source)
    setMoveOpen(false)
    setActualArea('')
    setActualLine('')
    setMoveLabelOk(null)
    setNote('')
  }

  async function saveStatus(status: EquipmentInventoryStatus, labelOk?: boolean | null, area?: string, line?: string) {
    if (!activeSession || activeSession.status !== 'OPEN' || !selectedEquipment) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await recordEquipmentInventory({
        sessionId: activeSession.sessionId,
        equipmentId: selectedEquipment.equipmentId,
        status,
        source: selectedSource,
        labelOk: labelOk ?? null,
        actualArea: area || undefined,
        actualLine: line || undefined,
        note: note.trim() || undefined,
      })
      refreshFromCache()
      setMessage(`Đã ghi ${selectedEquipment.equipmentId}: ${STATUS_LABEL[status]}.`)
      resetFinding()
      if (mode === 'SCAN') setScannerKey((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu kết quả kiểm kê')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !snapshot.equipment.length) return <div className="workspace-loading">Đang tải kiểm kê thiết bị…</div>

  return <section className="equipment-inventory-page">
    <header className="equipment-inventory-header">
      <div><p className="equipment-inventory-eyebrow">BM10B · Kiểm kê thiết bị</p><h2>Kiểm kê thiết bị thực tế</h2><p>Quét QR để xác nhận máy + tem. Nếu thiếu tem hoặc máy đã di chuyển, ghi nhận ngay tại hiện trường.</p></div>
      <div className="equipment-inventory-header-actions"><button type="button" onClick={() => void loadEquipmentInventory({ force: true }).then((result) => { setSnapshot(result); setMessage('Đã làm mới kiểm kê.') }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Không thể làm mới'))}>↻ Làm mới</button>{activeSession?.status === 'OPEN' ? <button type="button" onClick={() => void closeSession()} disabled={closing}>{closing ? 'Đang đóng…' : 'Đóng kỳ'}</button> : <button type="button" onClick={() => void createSession()} disabled={creating}>{creating ? 'Đang tạo…' : '+ Kỳ kiểm kê'}</button>}</div>
    </header>

    {error ? <div className="equipment-inventory-message error">{error}</div> : null}
    {message ? <div className="equipment-inventory-message success">{message}</div> : null}

    <div className="equipment-inventory-session-row">
      <label><span>Kỳ kiểm kê</span><select value={sessionId} onChange={(event) => { setSessionId(event.target.value); resetFinding() }}>{snapshot.sessions.map((item) => <option key={item.sessionId} value={item.sessionId}>{item.name} · {item.status === 'OPEN' ? 'Đang mở' : 'Đã đóng'}</option>)}</select></label>
      {activeSession ? <div className="equipment-inventory-session-meta"><span>{activeSession.sessionId}</span><span>{formatDate(activeSession.startedAt)}</span>{activeSession.closedAt ? <span>Đóng {formatDate(activeSession.closedAt)}</span> : null}</div> : null}
    </div>

    <div className="equipment-inventory-summary">
      <div><span>Tổng master</span><strong>{snapshot.equipment.length}</strong></div>
      <div><span>Đã kiểm</span><strong>{checkedCount}</strong></div>
      <div><span>Còn lại</span><strong>{pendingCount}</strong></div>
      <div><span>Thiếu tem</span><strong>{missingLabelCount}</strong></div>
      <div><span>Sai vị trí</span><strong>{movedCount}</strong></div>
      <div><span>Không thấy</span><strong>{notFoundCount}</strong></div>
      <div><span>Data sai</span><strong>{invalidCount}</strong></div>
    </div>

    <div className="equipment-inventory-mode-tabs">
      <button type="button" className={mode === 'SCAN' ? 'active' : ''} onClick={() => { setMode('SCAN'); resetFinding() }}>Quét QR</button>
      <button type="button" className={mode === 'MANUAL' ? 'active' : ''} onClick={() => { setMode('MANUAL'); resetFinding() }}>Tìm thủ công</button>
    </div>

    {activeSession?.status === 'OPEN' ? <div className="equipment-inventory-workspace">
      {mode === 'SCAN' ? <div className="equipment-inventory-scanner"><LiveQrScannerPanel key={scannerKey} onOpenEquipment={(equipmentId: string) => selectEquipment(equipmentId, 'QR')} /></div> : <div className="equipment-inventory-manual">
        <input type="search" value={manualQuery} onChange={(event) => setManualQuery(event.target.value)} placeholder="Tìm gần đúng: mã, tên máy, khu vực, line…" autoFocus />
        <div className="equipment-inventory-manual-results">
          {manualMatches.map((equipment) => {
            const preview = manualPhotos[equipment.equipmentId]
            const done = resultByEquipment.has(equipment.equipmentId)
            return <button type="button" key={equipment.equipmentId} className={done ? 'done' : ''} onClick={() => selectEquipment(equipment.equipmentId, 'MANUAL')}>
              <span className="equipment-inventory-manual-photo">{preview?.signedUrl ? <img src={preview.signedUrl} alt="" /> : <span>📷</span>}</span>
              <span><strong>{equipment.equipmentId}</strong><b>{equipment.equipmentName}</b><small>{equipment.area || '—'} · {equipment.line || '—'}{done ? ' · Đã kiểm' : ''}</small></span>
            </button>
          })}
        </div>
      </div>}

      {selectedEquipment ? <aside className="equipment-inventory-found-card">
        <h3>{selectedEquipment.equipmentId}</h3><strong>{selectedEquipment.equipmentName}</strong><p>Master: {selectedEquipment.area || '—'} · {selectedEquipment.line || '—'}</p>
        {!moveOpen ? <div className="equipment-inventory-status-actions">
          <button type="button" disabled={saving} onClick={() => void saveStatus('FOUND_LABEL_OK', true)}>✓ Có máy + tem QR</button>
          <button type="button" disabled={saving} onClick={() => void saveStatus('FOUND_NO_LABEL', false)}>⚠ Có máy · thiếu tem</button>
          <button type="button" disabled={saving} onClick={() => setMoveOpen(true)}>↔ Sai vị trí</button>
          <button type="button" disabled={saving} onClick={() => void saveStatus('NOT_FOUND', null)}>✕ Không tìm thấy</button>
        </div> : <div className="equipment-inventory-move-form">
          <label><span>Khu vực thực tế</span><input value={actualArea} onChange={(event) => setActualArea(event.target.value)} /></label>
          <label><span>Line thực tế</span><input value={actualLine} onChange={(event) => setActualLine(event.target.value)} /></label>
          <label><span>Tem QR</span><select value={moveLabelOk === null ? '' : moveLabelOk ? 'yes' : 'no'} onChange={(event) => setMoveLabelOk(event.target.value === '' ? null : event.target.value === 'yes')}><option value="">Chọn…</option><option value="yes">Có tem</option><option value="no">Thiếu tem</option></select></label>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú di chuyển…" />
          <div><button type="button" onClick={() => setMoveOpen(false)}>Hủy</button><button type="button" disabled={saving || (!actualArea.trim() && !actualLine.trim()) || moveLabelOk === null} onClick={() => void saveStatus('MOVED', moveLabelOk, actualArea.trim(), actualLine.trim())}>{saving ? 'Đang lưu…' : 'Lưu sai vị trí'}</button></div>
        </div>}
      </aside> : null}
    </div> : <div className="equipment-inventory-closed-note">Kỳ này đã đóng. Chọn kỳ đang mở hoặc tạo kỳ mới để tiếp tục kiểm kê.</div>}

    {abnormalResults.length ? <section className="equipment-inventory-abnormal"><h3>Bất thường gần nhất</h3><div>{abnormalResults.map((item) => <article key={`${item.sessionId}:${item.equipmentId}`}><strong>{item.equipmentId}</strong><span>{STATUS_LABEL[item.status]}</span><small>{item.actualArea || item.actualLine ? `${item.actualArea || '—'} · ${item.actualLine || '—'}` : formatDate(item.checkedAt)}</small></article>)}</div></section> : null}
  </section>
}
