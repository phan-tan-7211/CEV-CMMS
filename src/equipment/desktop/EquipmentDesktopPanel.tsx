import './EquipmentDesktopOperations.css'
import '../shared/styles/EquipmentPrimitives.css'
import '../shared/styles/EquipmentSheetPrimitives.css'
import { EquipmentProfile } from '../../EquipmentProfile'
import { EquipmentEditFormContent } from '../shared/EquipmentEditFormContent'
import { EquipmentTableHeaderCell, EquipmentTableValue } from '../shared/EquipmentTablePrimitives'
import {
  COLUMNS,
  defaultVisibleColumns,
  photoHoverPosition,
  statusLabel,
  useEquipmentPanelController,
} from '../shared/useEquipmentPanelController'

const STATUS_FILTERS = [
  { key: 'RUNNING', label: 'Hoạt động' },
  { key: 'DOWN', label: 'Sự cố' },
  { key: 'MAINTENANCE', label: 'Bảo trì' },
  { key: 'STOPPED', label: 'Dừng' },
  { key: 'DISPOSED', label: 'Thanh lý' },
] as const

export function EquipmentDesktopPanel() {
  const c = useEquipmentPanelController()
  const selectedStatuses = c.columnFilters.status || []
  const statusCounts = Object.fromEntries(STATUS_FILTERS.map(({ key }) => [key, c.rows.filter((row) => row.status === key).length])) as Record<(typeof STATUS_FILTERS)[number]['key'], number>

  function toggleOperationalStatus(status: (typeof STATUS_FILTERS)[number]['key']) {
    const label = statusLabel[status]
    c.setColumnFilters((current) => {
      const selected = current.status || []
      const next = selected.includes(label) ? selected.filter((item) => item !== label) : [...selected, label]
      const result = { ...current, status: next }
      if (!next.length) delete result.status
      return result
    })
  }

  return <div className="equipment-page equipment-desktop-panel">
    <section className="equipment-summary" aria-label="Tổng quan thiết bị"><article><span>Tổng thiết bị</span><strong>{c.rows.length}</strong></article><article><span>Thiết bị sản xuất</span><strong>{c.productionCount}</strong></article><article><span>Thiết bị đo kiểm</span><strong>{c.measurementCount}</strong></article></section>
    <section className="equipment-surface" aria-labelledby="equipment-title-desktop">
      <header className="equipment-page-header"><div><p className="eyebrow">Danh mục thiết bị</p><h2 id="equipment-title-desktop">Danh sách thiết bị</h2><p>{c.sortedRows.length} / {c.rows.length} thiết bị · toàn bộ trường master đều có thể bật cột và lọc</p></div><div className="equipment-page-actions">{c.canBulkEdit?<button className={`equipment-bulk-mode-toggle${c.bulkMode?' active':''}`} type="button" onClick={()=>c.bulkMode?c.exitBulkMode():c.setBulkMode(true)}>{c.bulkMode?'Thoát sửa trực tiếp':'Sửa hàng loạt'}</button>:null}<button className="equipment-refresh" type="button" onClick={()=>void c.reloadEquipment(true)} disabled={c.loading||c.bulkSaving}>Làm mới</button></div></header>
      <div className="equipment-operations-strip" aria-label="Lọc nhanh theo trạng thái">
        <span className="equipment-operations-label">Trạng thái</span>
        {STATUS_FILTERS.map(({ key, label }) => {
          const active = selectedStatuses.includes(statusLabel[key])
          return <button key={key} type="button" className={`equipment-status-filter status-${key.toLowerCase()}${active?' active':''}`} aria-pressed={active} onClick={()=>toggleOperationalStatus(key)}><span className="equipment-status-filter-dot" aria-hidden="true"/><span>{label}</span><strong>{statusCounts[key]}</strong></button>
        })}
        {selectedStatuses.length?<button className="equipment-status-clear" type="button" onClick={()=>c.clearFilter('status')}>Xóa lọc trạng thái</button>:null}
      </div>
      <div className="equipment-toolbar" role="search"><label className="equipment-search"><span className="sr-only">Tìm thiết bị</span><input value={c.query} onChange={(event)=>c.setQuery(event.target.value)} placeholder="Tìm mã, tên máy, hãng, model, bộ phận, khu vực…"/></label><div className="equipment-sheet-tools"><div className="equipment-column-picker"><button className={c.columnPickerOpen?'active':''} type="button" aria-expanded={c.columnPickerOpen} onClick={()=>{c.setFilterColumn(null);c.setFilterSearch('');c.setColumnPickerOpen((value)=>!value)}}>Cột hiển thị · {c.visibleColumns.length}/{COLUMNS.length}</button>{c.columnPickerOpen?<div className="equipment-column-menu"><header><strong>Ẩn / hiện cột</strong><div><button type="button" onClick={()=>c.setVisibleColumns(COLUMNS.map((column)=>column.key))}>Hiện tất cả</button><button type="button" onClick={()=>c.setVisibleColumns(defaultVisibleColumns())}>Mặc định</button></div></header>{(['Nhận diện','Quản lý','Kỹ thuật','Vòng đời','Tài liệu','Hệ thống'] as const).map((group)=><div key={group}><small>{group}</small>{COLUMNS.filter((column)=>column.group===group).map((column)=><label key={column.key}><input type="checkbox" checked={c.visibleColumns.includes(column.key)} onChange={()=>c.toggleColumn(column.key)}/><span>{column.label}</span></label>)}</div>)}</div>:null}</div><button type="button" className={c.activeFilterCount?'active':''} onClick={()=>c.setColumnFilters({})}>Bỏ toàn bộ lọc{c.activeFilterCount?` · ${c.activeFilterCount}`:''}</button></div></div>
      {c.bulkMode&&c.canBulkEdit?<div className="equipment-spreadsheet-bar"><div className="equipment-spreadsheet-copy"><strong>Chế độ sửa như Excel · {c.dirtyCount} dòng đã thay đổi</strong><span>Gõ trực tiếp trong ô · Tab/Shift+Tab để chuyển ô · Cấp A/B/C/D tự tính từ 5 câu kỹ thuật.</span></div><div className="equipment-spreadsheet-actions"><button type="button" onClick={()=>c.setInlineChanges({})} disabled={!c.dirtyCount||c.bulkSaving}>Hoàn tác chưa lưu</button><button className="save" type="button" onClick={()=>void c.saveInlineChanges()} disabled={!c.dirtyCount||c.bulkSaving}>{c.bulkSaving?'Đang lưu…':`Lưu ${c.dirtyCount} dòng`}</button><button type="button" onClick={c.exitBulkMode} disabled={c.bulkSaving}>Thoát</button></div></div>:null}
      {c.message?<div className="equipment-feedback" role="status">{c.message}</div>:null}{c.error?<div className="equipment-state error" role="alert">{c.error}</div>:null}{c.loading&&c.rows.length===0?<div className="equipment-state">Đang tải danh mục thiết bị…</div>:null}
      {c.rows.length>0?<div className="equipment-table-scroll"><table className={`equipment-data-table${c.bulkMode?' spreadsheet-mode':''}`}><caption className="sr-only">Danh sách thiết bị</caption><thead><tr><th>Ảnh</th>{COLUMNS.filter((column)=>c.visibleColumns.includes(column.key)).map((column)=><EquipmentTableHeaderCell key={column.key} controller={c} column={column}/>) }<th aria-label="Thao tác"/></tr></thead><tbody>{c.sortedRows.map((equipment)=>{const photo=c.photos[equipment.equipmentId]||{state:'loading',url:''};const pasteReady=photo.state==='no';const dirty=Boolean(c.inlineChanges[equipment.equipmentId]);return <tr key={equipment.equipmentId} className={dirty?'is-dirty':''}><td className={`equipment-image-col${pasteReady?' paste-ready':''}`} tabIndex={pasteReady?0:undefined} title={pasteReady?'Chọn ô ảnh rồi nhấn Ctrl+V để dán ảnh':'Mở hồ sơ thiết bị'} onPaste={pasteReady?(event)=>void c.handleEmptyPhotoCellPaste(equipment.equipmentId,event):undefined}>{photo.state==='yes'&&photo.url?<button className="equipment-image-button" type="button" onClick={()=>c.setProfileId(equipment.equipmentId)} onMouseEnter={(event)=>c.openPhotoHover(photo.url,equipment.equipmentName,event.clientX,event.clientY)} onMouseMove={(event)=>{if(c.photoHover?.url===photo.url)c.setPhotoHover({...c.photoHover,...photoHoverPosition(event.clientX,event.clientY)})}} onMouseLeave={()=>c.setPhotoHover(null)}><img src={photo.url} alt={equipment.equipmentName}/></button>:photo.state==='loading'?<span className="equipment-photo-state">…</span>:<button className="equipment-photo-empty" type="button" onClick={()=>c.setProfileId(equipment.equipmentId)}>Chưa có ảnh</button>}</td>{COLUMNS.filter((column)=>c.visibleColumns.includes(column.key)).map((column)=><td key={column.key}><EquipmentTableValue controller={c} equipment={equipment} column={column}/></td>)}<td>{c.bulkMode?<span className={dirty?'equipment-inline-dirty-dot':'equipment-cell-muted'}>{dirty?'Đã sửa':'—'}</span>:<button className="equipment-edit-row" type="button" onClick={()=>c.openEdit(equipment)}>Sửa</button>}</td></tr>})}</tbody></table></div>:null}
    </section>
    {c.photoHover?<div className="equipment-photo-hover-preview" aria-hidden="true" style={{left:c.photoHover.x,top:c.photoHover.y,width:c.photoHover.size,height:c.photoHover.size}}><img src={c.photoHover.url} alt=""/></div>:null}
    <DesktopOverlays controller={c}/>
  </div>
}

function DesktopOverlays({controller:c}:{controller:ReturnType<typeof useEquipmentPanelController>}) {
  const editing=c.editing
  return <>
    {c.profileEquipment?<EquipmentProfile equipment={c.profileEquipment} photoUrl={c.photos[c.profileEquipment.equipmentId]?.url||''} onClose={()=>c.setProfileId('')} onEdit={()=>c.openEdit(c.profileEquipment!)}/>:null}
    {editing?<div className="equipment-drawer-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!c.saving&&!c.deleting)c.setEditing(null)}}><section className="equipment-drawer" role="dialog" aria-modal="true" aria-labelledby="equipment-drawer-title-desktop"><header><div><p className="eyebrow">Danh mục thiết bị</p><h2 id="equipment-drawer-title-desktop">Chỉnh sửa thiết bị</h2></div><button type="button" onClick={()=>c.setEditing(null)} disabled={c.saving||c.deleting} aria-label="Đóng">×</button></header><EquipmentEditFormContent controller={c}/><footer><button className="equipment-delete" type="button" onClick={()=>void c.handleDelete()} disabled={c.saving||c.deleting}>{c.deleting?'Đang xóa…':'Xóa thiết bị'}</button><div className="equipment-drawer-footer-actions"><button type="button" onClick={()=>c.setEditing(null)} disabled={c.saving||c.deleting}>Hủy</button><button type="button" onClick={()=>void c.handleSave()} disabled={c.saving||c.deleting||!c.editCriticality}>{c.saving?'Đang lưu…':'Lưu thay đổi'}</button></div></footer></section></div>:null}
  </>
}
