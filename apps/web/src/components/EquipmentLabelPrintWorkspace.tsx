import { useMemo, useState } from 'react'
import { EQUIPMENT_LABEL_SIZES, EquipmentManagementLabel, type EquipmentLabelSize } from './EquipmentManagementLabel'
import { normalizeEquipmentLabelSize, setEquipmentDefaultLabelSize } from '../data/equipmentLabelPreference'
import './EquipmentLabelPrintWorkspace.css'

type Row = Record<string, unknown>

type Props = {
  records: Row[]
}

function sourceData(row: Row) {
  const value = row.source_data
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function text(row: Row, key: string) {
  const direct = row[key]
  if (direct !== null && direct !== undefined && String(direct).trim()) return String(direct).trim()
  const nested = sourceData(row)[key]
  return nested === null || nested === undefined ? '' : String(nested).trim()
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

function initialSizeMap(records: Row[]) {
  return Object.fromEntries(records.map((row) => [
    text(row, 'equipment_id'),
    normalizeEquipmentLabelSize(text(row, 'defaultLabelSize')),
  ])) as Record<string, EquipmentLabelSize>
}

function setDocumentTitle(title: string) {
  document.title = title
}

export function EquipmentLabelPrintWorkspace({ records }: Props) {
  const equipmentRows = useMemo(() => records.filter((row) => text(row, 'equipment_id')), [records])
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [copies, setCopies] = useState(1)
  const [sizeOverrides, setSizeOverrides] = useState<Record<string, EquipmentLabelSize>>({})
  const [savingSizeId, setSavingSizeId] = useState('')
  const [sizeMessage, setSizeMessage] = useState('')
  const sizeById = useMemo(() => ({ ...initialSizeMap(records), ...sizeOverrides }), [records, sizeOverrides])

  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    if (!words.length) return equipmentRows
    return equipmentRows.filter((row) => {
      const haystack = normalize([
        text(row, 'equipment_id'), text(row, 'equipment_name'), text(row, 'model'), text(row, 'manufacturer'),
        text(row, 'currentArea'), text(row, 'currentLine'), text(row, 'department'), text(row, 'usingDepartment'),
        text(row, 'managementResponsiblePrimary'), text(row, 'managementResponsibleSecondary'),
      ].join(' '))
      return words.every((word) => haystack.includes(word))
    })
  }, [equipmentRows, query])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedRows = useMemo(() => equipmentRows.filter((row) => selectedSet.has(text(row, 'equipment_id'))), [equipmentRows, selectedSet])
  const missingPrimaryCount = selectedRows.filter((row) => !text(row, 'managementResponsiblePrimary')).length

  const groups = useMemo(() => EQUIPMENT_LABEL_SIZES.map((config) => {
    const rows = selectedRows.filter((row) => (sizeById[text(row, 'equipment_id')] || 'standard') === config.id)
    return {
      ...config,
      rows,
      printableRows: rows.flatMap((row) => Array.from({ length: copies }, () => row)),
    }
  }).filter((group) => group.rows.length > 0), [selectedRows, sizeById, copies])

  const printableCount = groups.reduce((total, group) => total + group.printableRows.length, 0)

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  function selectFiltered() {
    setSelectedIds((current) => Array.from(new Set([...current, ...filtered.map((row) => text(row, 'equipment_id'))])))
  }

  function clearFiltered() {
    const filteredIds = new Set(filtered.map((row) => text(row, 'equipment_id')))
    setSelectedIds((current) => current.filter((id) => !filteredIds.has(id)))
  }

  async function changeDefaultSize(equipmentId: string, nextSize: EquipmentLabelSize) {
    const previous = sizeById[equipmentId] || 'standard'
    setSizeOverrides((current) => ({ ...current, [equipmentId]: nextSize }))
    setSavingSizeId(equipmentId)
    setSizeMessage('')
    try {
      await setEquipmentDefaultLabelSize(equipmentId, nextSize)
      const label = EQUIPMENT_LABEL_SIZES.find((option) => option.id === nextSize)?.label || nextSize
      setSizeMessage(`Đã nhớ ${equipmentId}: ${label}`)
    } catch (cause) {
      setSizeOverrides((current) => ({ ...current, [equipmentId]: previous }))
      setSizeMessage(cause instanceof Error ? cause.message : 'Không thể lưu khổ tem mặc định')
    } finally {
      setSavingSizeId('')
    }
  }

  function printGroup(size: EquipmentLabelSize) {
    const group = groups.find((item) => item.id === size)
    if (!group?.printableRows.length) return
    const previousTitle = document.title
    setDocumentTitle(`CEV Labels · ${group.rows.length} thiết bị · ${group.label}`)
    const style = document.createElement('style')
    style.id = 'equipment-label-page-size'
    style.textContent = `@media print { @page { size: ${group.printWidth}mm ${group.printHeight}mm; margin: 0; } .equipment-label-print-page:not(.print-size-${size}) { display:none!important; } }`
    document.head.appendChild(style)
    const restore = () => {
      style.remove()
      setDocumentTitle(previousTitle)
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore, { once: true })
    window.print()
  }

  return <div className="equipment-label-workspace">
    <section className="equipment-label-bulk-controls no-print">
      <div className="equipment-label-control-top">
        <label className="equipment-label-search"><span>Tìm thiết bị</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã, tên, model, line, người quản lý…" /></label>
        <label><span>Số bản / máy</span><input type="number" min={1} max={20} value={copies} onChange={(event) => setCopies(Math.max(1, Math.min(20, Number(event.target.value) || 1)))} /></label>
      </div>
      <div className="equipment-label-bulk-actions">
        <button type="button" onClick={selectFiltered} disabled={!filtered.length}>Chọn tất cả kết quả ({filtered.length})</button>
        <button type="button" onClick={clearFiltered} disabled={!selectedIds.length}>Bỏ chọn kết quả</button>
        <strong>{selectedRows.length} máy · {printableCount} tem</strong>
      </div>
      {groups.length ? <div className="equipment-label-auto-groups" aria-label="Nhóm in tự động theo khổ tem mặc định">
        {groups.map((group) => <div key={group.id} className="equipment-label-group-card">
          <span>Khổ {group.label}</span>
          <strong>{group.rows.length} máy · {group.printableRows.length} tem</strong>
          <button type="button" className="equipment-label-print-button" onClick={() => printGroup(group.id)}>In nhóm {group.label}</button>
        </div>)}
      </div> : null}
      {missingPrimaryCount ? <div className="equipment-label-manager-warning" role="alert">⚠ {missingPrimaryCount} thiết bị đã chọn chưa có người phụ trách quản lý chính. Tem sẽ hiển thị “CHƯA PHÂN CÔNG”.</div> : null}
      {sizeMessage ? <div className="equipment-label-size-message" role="status">{sizeMessage}</div> : null}
      <div className="equipment-label-picker" aria-label="Chọn thiết bị in tem">
        {filtered.map((row) => {
          const id = text(row, 'equipment_id')
          const checked = selectedSet.has(id)
          const primary = text(row, 'managementResponsiblePrimary')
          const secondary = text(row, 'managementResponsibleSecondary')
          const rowSize = sizeById[id] || 'standard'
          return <label key={id} className={checked ? 'selected' : ''}>
            <input type="checkbox" checked={checked} onChange={() => toggle(id)} />
            <span><strong>{id}</strong><b>{text(row, 'equipment_name') || 'Chưa có tên'}</b><small>QL chính: {primary || 'CHƯA PHÂN CÔNG'}{secondary ? ` · Phụ: ${secondary}` : ''}</small></span>
            <span className="equipment-label-default-size" onClick={(event) => event.preventDefault()}>
              <small>Khổ mặc định</small>
              <select aria-label={`Khổ tem mặc định ${id}`} value={rowSize} disabled={savingSizeId === id} onChange={(event) => void changeDefaultSize(id, event.target.value as EquipmentLabelSize)}>
                {EQUIPMENT_LABEL_SIZES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </span>
          </label>
        })}
      </div>
    </section>

    <section className="equipment-label-preview-groups" aria-label="Xem trước tem đã tự chia nhóm">
      {groups.length ? groups.map((group) => <section key={group.id} className="equipment-label-preview-group">
        <div className="equipment-label-preview-heading no-print"><strong>{group.label}</strong><span>{group.rows.length} máy · {group.printableRows.length} tem</span></div>
        <div className={`equipment-label-preview-grid label-size-${group.id}`}>
          {group.printableRows.map((row, index) => <div className={`equipment-label-print-page print-size-${group.id}`} key={`${text(row, 'equipment_id')}-${group.id}-${index}`}><EquipmentManagementLabel row={row} size={group.id}/></div>)}
        </div>
      </section>) : <div className="equipment-label-empty no-print">Chọn một hoặc nhiều thiết bị. Hệ thống sẽ tự chia nhóm theo khổ tem mặc định của từng máy.</div>}
    </section>
  </div>
}
