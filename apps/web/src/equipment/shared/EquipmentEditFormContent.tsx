import { EquipmentMasterEditFields } from '../../EquipmentMasterEditFields'
import { EquipmentCriticalityEditor } from './EquipmentCriticalityEditor'
import { useEquipmentPanelController } from './useEquipmentPanelController'

type EquipmentPanelController = ReturnType<typeof useEquipmentPanelController>

export function EquipmentEditFormContent({ controller: c }: { controller: EquipmentPanelController }) {
  const editing = c.editing
  if (!editing) return null

  return <div className="equipment-drawer-scroll">
    <div className="equipment-edit-photo">
      {c.photos[editing.equipmentId]?.url
        ? <img src={c.photos[editing.equipmentId].url} alt={`Ảnh ${editing.equipmentName}`} />
        : <div className="equipment-edit-photo-empty">Chưa có ảnh</div>}
      <div className="equipment-edit-photo-actions">
        <button type="button" onClick={() => void c.handleClipboardUpload(editing.equipmentId)} disabled={!!c.uploadingId || !!c.deletingPhotoId}>{c.uploadingId === editing.equipmentId ? 'Đang tải…' : 'Dán ảnh từ bộ nhớ tạm'}</button>
        <label className="equipment-edit-photo-picker">Chọn ảnh<input type="file" accept="image/*" capture="environment" disabled={!!c.uploadingId || !!c.deletingPhotoId} onChange={(event) => void c.handlePhotoUpload(editing.equipmentId, event.currentTarget.files?.[0])} /></label>
        {c.photos[editing.equipmentId]?.url ? <button className="equipment-edit-photo-delete" type="button" onClick={() => void c.handlePhotoDelete(editing.equipmentId)} disabled={!!c.uploadingId || !!c.deletingPhotoId}>{c.deletingPhotoId === editing.equipmentId ? 'Đang xóa ảnh…' : 'Xóa ảnh'}</button> : null}
        <small>1 thiết bị = 1 ảnh · tự nén trước khi lưu</small>
      </div>
    </div>
    <EquipmentMasterEditFields value={editing} suggestions={c.masterSuggestions} onChange={c.setEditing} />
    <EquipmentCriticalityEditor editing={editing} setEditing={c.setEditing} result={c.editCriticality} />
  </div>
}
