import { EquipmentInlineCell } from '../../components/EquipmentInlineCell'
import type { LiveEquipment } from '../../data/liveEquipment'
import {
  columnValue,
  documentLinks,
  inlineValue,
  patchKeyForColumn,
  statusLabel,
  type ColumnDef,
  useEquipmentPanelController,
} from './useEquipmentPanelController'

type EquipmentPanelController = ReturnType<typeof useEquipmentPanelController>

export function EquipmentTableHeaderCell({ controller: c, column }: { controller: EquipmentPanelController; column: ColumnDef }) {
  const selected = c.columnFilters[column.key] || []
  const options = c.filterOptions(column.key).filter((value) => value.toLocaleLowerCase().includes(c.filterSearch.toLocaleLowerCase()))
  const active = c.sortKey === column.key

  return <th className="equipment-sheet-head" aria-sort={active ? (c.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <div className="equipment-sheet-head-main">
      <button className={`equipment-sort${active ? ' active' : ''}`} type="button" onClick={() => c.toggleSort(column.key)}>
        {column.label}<span aria-hidden="true">{active ? (c.sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
      <button className={`equipment-filter-button${selected.length ? ' active' : ''}`} type="button" aria-label={`Lọc ${column.label}`} onClick={() => { c.setColumnPickerOpen(false); c.setFilterColumn((current) => current === column.key ? null : column.key); c.setFilterSearch('') }}>
        ▼{selected.length ? <span className="equipment-filter-count">{selected.length}</span> : null}
      </button>
    </div>
    {c.filterColumn === column.key ? <div className="equipment-filter-popover">
      <input type="search" value={c.filterSearch} onChange={(event) => c.setFilterSearch(event.target.value)} placeholder={`Tìm trong ${column.label.toLocaleLowerCase()}…`} />
      <div className="equipment-filter-actions">
        <button type="button" onClick={() => c.clearFilter(column.key)}>Bỏ lọc</button>
        <button type="button" onClick={() => c.setColumnFilters((current) => ({ ...current, [column.key]: c.filterOptions(column.key) }))}>Chọn tất cả</button>
      </div>
      {options.map((value) => <label className="equipment-filter-option" key={value}><input type="checkbox" checked={selected.includes(value)} onChange={() => c.toggleFilterValue(column.key, value)} /><span>{value}</span></label>)}
    </div> : null}
  </th>
}

export function EquipmentTableValue({ controller: c, equipment, column }: { controller: EquipmentPanelController; equipment: LiveEquipment; column: ColumnDef }) {
  const key = column.key
  const patchKey = patchKeyForColumn(key)

  if (c.bulkMode && patchKey) return <EquipmentInlineCell equipment={equipment} columnKey={key} label={column.label} value={inlineValue(equipment, key, c.inlineChanges)} onChange={(value) => c.setInlineCell(equipment, key, value)} />
  if (c.bulkMode && !patchKey) return <span className="equipment-inline-readonly">{columnValue(equipment, key) || '—'}</span>
  if (key === 'equipmentId') return <button className="equipment-link" type="button" onClick={() => c.setProfileId(equipment.equipmentId)}>{equipment.equipmentId}</button>
  if (key === 'equipmentName') return <button className="equipment-link equipment-name-link" type="button" onClick={() => c.setProfileId(equipment.equipmentId)}>{equipment.equipmentName}</button>
  if (key === 'status') return <span className={`equipment-status status-${equipment.status.toLowerCase()}`}>{statusLabel[equipment.status] || equipment.status}</span>
  if (key === 'relatedDocuments') {
    const links = documentLinks(equipment.relatedDocuments)
    return links.length ? <div className="equipment-doc-links">{links.slice(0, 3).map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer">{index === 0 ? 'Mở tài liệu' : `Tài liệu ${index + 1}`}</a>)}</div> : <span className="equipment-cell-muted">{equipment.relatedDocuments || '—'}</span>
  }
  return columnValue(equipment, key) || '—'
}
