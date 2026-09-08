import { useEffect, useMemo, useState } from 'react'
import type { LiveEquipment } from '../data/liveEquipment'
import { getEquipmentPhotoPreviews, type EquipmentPhotoPreview } from '../data/supabaseEquipment'
import './EquipmentMultiSelect.css'

type Props = {
  equipment: LiveEquipment[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  title?: string
  helper?: string
  disabled?: boolean
  selectionMode?: 'multiple' | 'single'
  compact?: boolean
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

export function EquipmentMultiSelect({
  equipment,
  selectedIds,
  onChange,
  title = 'Máy sử dụng',
  helper = 'Có thể chọn nhiều thiết bị cùng lúc.',
  disabled = false,
  selectionMode = 'multiple',
  compact = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION' | 'MEASUREMENT'>('ALL')
  const [photos, setPhotos] = useState<Record<string, EquipmentPhotoPreview>>({})
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)

  useEffect(() => {
    let active = true
    const ids = equipment.map((item) => item.equipmentId)
    if (!ids.length) return () => { active = false }
    void getEquipmentPhotoPreviews(ids)
      .then((result) => { if (active) setPhotos(result) })
      .catch(() => { if (active) setPhotos({}) })
    return () => { active = false }
  }, [equipment])

  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedOnly = showSelectedOnly && selectedIds.length > 0
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    return equipment.filter((item) => {
      if (typeFilter !== 'ALL' && item.equipmentType !== typeFilter) return false
      const haystack = normalize([
        item.equipmentId,
        item.equipmentName,
        item.equipmentCategory,
        item.manufacturer,
        item.model,
        item.usingDepartment,
        item.managingDepartment,
        item.currentArea,
        item.currentLine,
      ].join(' '))
      return words.every((word) => haystack.includes(word))
    })
  }, [equipment, query, typeFilter])

  const visible = useMemo(
    () => selectedOnly ? filtered.filter((item) => selected.has(item.equipmentId)) : filtered,
    [filtered, selected, selectedOnly],
  )

  function emitSelection(next: string[]) {
    if (!next.length) setShowSelectedOnly(false)
    onChange(next)
  }

  function toggle(id: string) {
    if (disabled) return
    if (selectionMode === 'single') {
      emitSelection(selected.has(id) ? [] : [id])
      return
    }
    if (selected.has(id)) emitSelection(selectedIds.filter((value) => value !== id))
    else emitSelection([...selectedIds, id])
  }

  function selectFiltered() {
    if (disabled || selectionMode === 'single') return
    const next = new Set(selectedIds)
    filtered.forEach((item) => next.add(item.equipmentId))
    emitSelection(Array.from(next))
  }

  function clearFiltered() {
    if (disabled) return
    if (selectionMode === 'single') { emitSelection([]); return }
    const filteredIds = new Set(filtered.map((item) => item.equipmentId))
    emitSelection(selectedIds.filter((id) => !filteredIds.has(id)))
  }

  function toggleSelectedView() {
    if (disabled || selectionMode === 'single' || !selectedIds.length) return
    setShowSelectedOnly((current) => {
      const next = !current
      if (next) {
        setQuery('')
        setTypeFilter('ALL')
      }
      return next
    })
  }

  const filteredSelected = filtered.filter((item) => selected.has(item.equipmentId)).length

  return <section className={`equipment-multi-select${compact ? ' compact' : ''}`} aria-label={title}>
    <header>
      <div>
        <h4>{title}</h4>
        <p>{helper}</p>
      </div>
      <strong>{selectionMode === 'single' ? (selectedIds.length ? 'Đã chọn' : 'Chưa chọn') : `${selectedIds.length} đã chọn`}</strong>
    </header>

    <div className="equipment-multi-toolbar">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={selectedOnly ? 'Tìm trong các máy đang chọn…' : 'Tìm mã, tên máy, model, line, bộ phận…'}
        disabled={disabled}
      />
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} disabled={disabled}>
        <option value="ALL">Tất cả thiết bị</option>
        <option value="PRODUCTION">Thiết bị sản xuất</option>
        <option value="MEASUREMENT">Thiết bị đo kiểm</option>
      </select>
      {selectionMode === 'multiple' ? <>
        <button type="button" onClick={selectFiltered} disabled={disabled || !filtered.length}>Chọn tất cả kết quả</button>
        <button type="button" onClick={clearFiltered} disabled={disabled || !filteredSelected}>Bỏ chọn kết quả</button>
        <button
          type="button"
          className={`equipment-multi-selected-toggle${selectedOnly ? ' active' : ''}`}
          onClick={toggleSelectedView}
          disabled={disabled || !selectedIds.length}
          aria-pressed={selectedOnly}
        >{selectedOnly ? 'Hiện tất cả' : `Hiện đang chọn (${selectedIds.length})`}</button>
      </> : selectedIds.length ? <button type="button" onClick={() => emitSelection([])} disabled={disabled}>Bỏ chọn</button> : null}
    </div>

    <div className="equipment-multi-summary">
      <span>{selectedOnly ? `${visible.length} thiết bị đang chọn` : `${filtered.length} thiết bị phù hợp`}</span>
      {selectionMode === 'multiple' && !selectedOnly ? <span>{filteredSelected} đang chọn trong kết quả</span> : null}
      {selectionMode === 'multiple' && selectedOnly ? <span>Bỏ tích máy chọn nhầm rồi lưu thay đổi như bình thường</span> : null}
    </div>

    <div className="equipment-multi-grid">
      {visible.map((item) => {
        const checked = selected.has(item.equipmentId)
        const photo = photos[item.equipmentId]
        return <label key={item.equipmentId} className={`equipment-multi-card${checked ? ' selected' : ''}`}>
          <input type={selectionMode === 'single' ? 'radio' : 'checkbox'} checked={checked} onChange={() => toggle(item.equipmentId)} disabled={disabled} />
          <div className="equipment-multi-photo">
            {photo?.exists && photo.signedUrl
              ? <img src={photo.signedUrl} alt={`Ảnh ${item.equipmentName}`} />
              : <span>Không ảnh</span>}
          </div>
          <div className="equipment-multi-info">
            <strong>{item.equipmentId}</strong>
            <b>{item.equipmentName}</b>
            <small>{[item.model, item.currentLine || item.currentArea, item.usingDepartment].filter(Boolean).join(' · ') || 'Chưa có thông tin vị trí'}</small>
          </div>
          <span className={`equipment-multi-criticality level-${(item.criticality || 'na').toLowerCase()}`}>{item.criticality ? `Cấp ${item.criticality}` : '—'}</span>
        </label>
      })}
      {!visible.length ? <div className="equipment-multi-empty">{selectedOnly ? 'Không còn thiết bị nào đang chọn.' : 'Không tìm thấy thiết bị phù hợp.'}</div> : null}
    </div>
  </section>
}
