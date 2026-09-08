import { useEffect, useMemo, useState } from 'react'
import type { ClipboardEvent, FormEvent, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import './equipment/shared/styles/EquipmentPrimitives.css'
import './equipment/shared/styles/EquipmentRegistrationPrimitives.css'
import { useAppRole } from './auth/AppRoleContext'
import { SmartAutocomplete } from './components/SmartAutocomplete'
import { loadLiveEquipment, type LiveEquipment } from './data/liveEquipment'
import { uploadEquipmentPhoto } from './data/supabaseEquipment'
import { buildEquipmentMasterSuggestions, canonicalizeMasterValue, EMPTY_MASTER_SUGGESTIONS, type EquipmentMasterSuggestionKey } from './data/equipmentMasterFields'
import { createEquipmentAuto, deriveEquipmentCriticality, type EquipmentRegistrationInput } from './data/autoRegistration'

const EMPTY: EquipmentRegistrationInput = {
  equipmentType: 'PRODUCTION', equipmentName: '', equipmentCategory: '', manufacturer: '', distributor: '', model: '', serialNumber: '', department: '', currentArea: '', currentLine: '', managingDepartment: '', managementResponsiblePrimary: '', managementResponsibleSecondary: '', technicalSpecification: '', description: '', accuracy: '', origin: '', manufactureDate: '', inServiceDate: '', warrantyUntil: '', warrantyContact: '', note: '', relatedDocuments: '', status: 'RUNNING', controlsProductQuality: undefined, specialCharacteristicImpact: undefined, stopsProduction: undefined, hasBackup: undefined, capacityImpact: undefined,
}

function booleanSelectValue(value: boolean | undefined) { return value === true ? 'YES' : value === false ? 'NO' : '' }
function parseBooleanSelect(value: string) { return value === 'YES' ? true : value === 'NO' ? false : undefined }
function clipboardFileExtension(mimeType: string) { if (mimeType === 'image/png') return 'png'; if (mimeType === 'image/webp') return 'webp'; if (mimeType === 'image/gif') return 'gif'; return 'jpg' }
function cloneOptionLabel(row: LiveEquipment) { return `${row.equipmentId} · ${row.equipmentName}` }

function refreshEquipmentMasterAfterCreate() {
  requestAnimationFrame(() => {
    const refreshButton = document.querySelector<HTMLButtonElement>('.equipment-refresh')
    if (refreshButton && !refreshButton.disabled) refreshButton.click()
  })
}

function cloneRegistrationInput(row: LiveEquipment): EquipmentRegistrationInput {
  const facts = row.criticalityFacts || {}
  return {
    equipmentType: row.equipmentType,
    equipmentName: row.equipmentName,
    equipmentCategory: row.equipmentCategory || '',
    manufacturer: row.manufacturer || '',
    distributor: row.distributor || '',
    model: row.model || '',
    serialNumber: '',
    department: row.usingDepartment || '',
    currentArea: row.currentArea || '',
    currentLine: row.currentLine || '',
    managingDepartment: row.managingDepartment || '',
    managementResponsiblePrimary: row.managementResponsiblePrimary || '',
    managementResponsibleSecondary: row.managementResponsibleSecondary || '',
    technicalSpecification: row.technicalSpecification || '',
    description: row.description || '',
    accuracy: row.accuracy || '',
    origin: row.origin || '',
    manufactureDate: '',
    inServiceDate: '',
    warrantyUntil: '',
    warrantyContact: row.warrantyContact || '',
    note: row.note || '',
    relatedDocuments: row.relatedDocuments || '',
    status: 'RUNNING',
    controlsProductQuality: facts.controlsProductQuality,
    specialCharacteristicImpact: facts.specialCharacteristicImpact,
    stopsProduction: facts.stopsProduction,
    hasBackup: facts.hasBackup,
    capacityImpact: facts.capacityImpact,
  }
}

export function LiveEquipmentRegistrationPanel() {
  const role = useAppRole()
  const canCreate = ['MAINTENANCE', 'MANAGER', 'ADMIN'].includes(role)
  const [open, setOpen] = useState(false)
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null)
  const [form, setForm] = useState<EquipmentRegistrationInput>(EMPTY)
  const [cloneSourceId, setCloneSourceId] = useState('')
  const [sourceRows, setSourceRows] = useState<LiveEquipment[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState(EMPTY_MASTER_SUGGESTIONS)
  const criticality = deriveEquipmentCriticality(form)

  useEffect(() => {
    const resolveHost = () => {
      const host = document.querySelector<HTMLElement>('.equipment-page-actions')
      if (host) setActionHost(host)
      return Boolean(host)
    }
    if (resolveHost()) return
    const observer = new MutationObserver(() => { if (resolveHost()) observer.disconnect() })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      resetForm()
      setError('')
      setMessage('')
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    let active = true
    void loadLiveEquipment().then((rows) => {
      if (!active) return
      setSourceRows(rows)
      setSuggestions(buildEquipmentMasterSuggestions(rows.map((row) => ({ ...row, department: row.usingDepartment }))))
    }).catch(() => {
      if (!active) return
      setSourceRows([])
      setSuggestions(EMPTY_MASTER_SUGGESTIONS)
    })
    return () => { active = false }
  }, [open])

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const cloneOptions = useMemo(() => sourceRows.map(cloneOptionLabel), [sourceRows])

  const canonical = useMemo(() => {
    const next = { ...form }
    const keys: EquipmentMasterSuggestionKey[] = ['equipmentName','equipmentCategory','manufacturer','distributor','model','department','managingDepartment','managementResponsiblePrimary','managementResponsibleSecondary','currentArea','currentLine','technicalSpecification','description','accuracy','origin','warrantyContact','note','relatedDocuments']
    for (const key of keys) next[key] = canonicalizeMasterValue(String(next[key] || ''), suggestions[key])
    return next
  }, [form, suggestions])

  const missingRequired = useMemo(() => {
    const missing: string[] = []
    if (!canonical.equipmentName?.trim()) missing.push('Tên thiết bị')
    if (!canonical.managementResponsiblePrimary?.trim()) missing.push('Người QL chính')
    if (form.controlsProductQuality === undefined) missing.push('Kiểm soát đặc tính chất lượng')
    if (form.specialCharacteristicImpact === undefined) missing.push('Đặc tính đặc biệt / an toàn')
    if (form.stopsProduction === undefined) missing.push('Rủi ro dừng công đoạn')
    if (form.hasBackup === undefined) missing.push('Thiết bị / phương án dự phòng')
    if (form.capacityImpact === undefined) missing.push('Rủi ro sản lượng / giao hàng')
    return missing
  }, [canonical.equipmentName, canonical.managementResponsiblePrimary, form.controlsProductQuality, form.specialCharacteristicImpact, form.stopsProduction, form.hasBackup, form.capacityImpact])

  const canSubmit = canCreate && !saving && missingRequired.length === 0

  function setPhotoSelection(file: File | null) {
    setPhotoFile(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : '')
  }

  function resetForm() {
    setForm(EMPTY)
    setCloneSourceId('')
    setPhotoSelection(null)
  }

  function closeDrawer() {
    setOpen(false)
    resetForm()
    setError('')
    setMessage('')
  }

  function openDrawer() {
    setError('')
    setMessage('')
    setOpen(true)
  }

  function applyClone(value: string) {
    setCloneSourceId(value)
    const normalized = value.trim().toLocaleLowerCase('vi-VN')
    if (!normalized) return
    const source = sourceRows.find((row) => cloneOptionLabel(row).toLocaleLowerCase('vi-VN') === normalized || row.equipmentId.toLocaleLowerCase('vi-VN') === normalized)
    if (!source) return
    setCloneSourceId(cloneOptionLabel(source))
    setForm(cloneRegistrationInput(source))
    setPhotoSelection(null)
    setError('')
    setMessage(`Đã sao chép dữ liệu từ ${source.equipmentId}. Mã mới sẽ tự sinh; hãy nhập lại Số sê-ri, ngày và ảnh nếu cần.`)
  }

  function textField(key: keyof EquipmentRegistrationInput, label: string, suggestionKey?: EquipmentMasterSuggestionKey, wide = false, placeholder = '', required = false) {
    return <label className={wide ? 'wide' : undefined}><span>{label}{required ? ' *' : ''}</span>{suggestionKey ? <SmartAutocomplete required={required} value={String(form[key] || '')} options={suggestions[suggestionKey]} onChange={(nextValue) => setForm({ ...form, [key]: nextValue })} onBlur={() => setForm((current) => ({ ...current, [key]: canonicalizeMasterValue(String(current[key] || ''), suggestions[suggestionKey]) }))} placeholder={placeholder} /> : <input required={required} value={String(form[key] || '')} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={placeholder} />}</label>
  }

  function handlePhotoPaste(event: ClipboardEvent<HTMLElement>) {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'))
    if (!imageItem) return
    event.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) { setError('Không đọc được ảnh từ bộ nhớ tạm.'); return }
    setPhotoSelection(file)
    setError('')
  }

  async function pastePhotoFromClipboard() {
    if (!navigator.clipboard?.read) { setError('Trình duyệt không hỗ trợ đọc ảnh trực tiếp từ bộ nhớ tạm. Hãy nhấn Ctrl+V vào khung ảnh.'); return }
    try {
      for (const item of await navigator.clipboard.read()) {
        const imageType = item.types.find((type) => type.startsWith('image/'))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        setPhotoSelection(new File([blob], `clipboard.${clipboardFileExtension(imageType)}`, { type: imageType }))
        setError('')
        return
      }
      setError('Bộ nhớ tạm không có ảnh.')
    } catch (cause) {
      setError(cause instanceof Error ? `Không thể đọc ảnh từ bộ nhớ tạm: ${cause.message}` : 'Không thể đọc ảnh từ bộ nhớ tạm.')
    }
  }

  function handlePhotoBoxClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target.closest('button,.equipment-register-photo-pick,input')) return
    event.preventDefault()
    event.stopPropagation()
    void pastePhotoFromClipboard()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit || !criticality) return
    setSaving(true); setMessage(''); setError('')
    try {
      const result = await createEquipmentAuto(canonical)
      let photoNote = ''
      if (photoFile) {
        try { await uploadEquipmentPhoto(result.equipmentId, photoFile); photoNote = ' · Ảnh đã lưu.' }
        catch (cause) { photoNote = ` · Thiết bị đã tạo nhưng ảnh chưa lưu: ${cause instanceof Error ? cause.message : 'Không thể tải ảnh'}` }
      }
      setMessage(`Đã tạo ${result.equipmentId} · Cấp ${result.criticality}. Mã QR tự dùng mã thiết bị.${photoNote}`)
      resetForm(); setOpen(false)
      window.dispatchEvent(new CustomEvent('equipment-created', { detail: result }))
      refreshEquipmentMasterAfterCreate()
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Không thể đăng ký thiết bị') }
    finally { setSaving(false) }
  }

  if (!canCreate) return null

  const trigger = actionHost ? createPortal(
    <button type="button" className="equipment-register-header-action" onClick={openDrawer}>+ Đăng ký</button>,
    actionHost,
  ) : null

  const drawer = open ? createPortal(
    <div className="equipment-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer() }}>
      <section className="equipment-drawer equipment-register-drawer" role="dialog" aria-modal="true" aria-labelledby="equipment-register-title">
        <header>
          <div><h2 id="equipment-register-title">Đăng ký thiết bị mới</h2><p>Trường có dấu <strong>*</strong> là bắt buộc. Có thể sao chép máy tương tự rồi sửa phần khác biệt.</p></div>
          <button type="button" className="equipment-close" aria-label="Đóng" onClick={closeDrawer}>×</button>
        </header>
        <form className="equipment-register-drawer-form" onSubmit={submit}>
          <div className="equipment-register-scroll">
            {message ? <div className="equipment-register-message success">{message}</div> : null}
            {error ? <div className="equipment-register-message error">{error}</div> : null}
            <div className="equipment-register-form">
              <label className="wide"><span>Sao chép từ mã có sẵn</span><SmartAutocomplete value={cloneSourceId} options={cloneOptions} onChange={applyClone} placeholder="Nhập mã hoặc tên thiết bị để tìm nhanh" maxOptions={30} /><small className="equipment-standardize-hint">Nhập mã hoặc tên → lọc gợi ý → chọn thiết bị. Mã mới vẫn tự sinh; số sê-ri, ngày và ảnh được để trống để tránh trùng.</small></label>
              <label><span>Loại thiết bị *</span><select required value={form.equipmentType} onChange={(e) => setForm({ ...form, equipmentType: e.target.value as EquipmentRegistrationInput['equipmentType'] })}><option value="PRODUCTION">Thiết bị sản xuất → CEV-PR</option><option value="MEASUREMENT">Thiết bị đo/kiểm → CEV-ME</option></select></label>
              <label><span>Trạng thái *</span><select required value={form.status || 'RUNNING'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="RUNNING">Hoạt động</option><option value="STOPPED">Dừng</option><option value="MAINTENANCE">Bảo trì</option><option value="DOWN">Sự cố</option><option value="DISPOSED">Thanh lý</option></select></label>
              <label className="wide"><span>Tên thiết bị *</span><SmartAutocomplete autoFocus required value={form.equipmentName} options={suggestions.equipmentName} onChange={(nextValue) => setForm({ ...form, equipmentName: nextValue })} onBlur={() => setForm((current) => ({ ...current, equipmentName: canonicalizeMasterValue(current.equipmentName, suggestions.equipmentName) }))} placeholder="Chọn tên chuẩn đã có hoặc nhập tên mới" /><small className="equipment-standardize-hint">Nếu đã có tên chuẩn thì chọn đúng tên đó.</small></label>
              {textField('equipmentCategory','Nhóm thiết bị','equipmentCategory')}{textField('manufacturer','Hãng / nhà sản xuất','manufacturer')}{textField('distributor','Nhà phân phối','distributor')}{textField('model','Mẫu máy','model')}{textField('serialNumber','Số sê-ri')}
              {textField('department','Bộ phận sử dụng','department')}{textField('managingDepartment','Bộ phận quản lý','managingDepartment')}
              {textField('managementResponsiblePrimary','Người phụ trách quản lý · Chính','managementResponsiblePrimary',false,'Nhập/chọn người chịu trách nhiệm chính',true)}
              {textField('managementResponsibleSecondary','Người phụ trách quản lý · Phụ','managementResponsibleSecondary',false,'Người thay thế / hỗ trợ')}
              {textField('currentArea','Khu vực','currentArea')}{textField('currentLine','Dây chuyền','currentLine')}{textField('origin','Xuất xứ','origin')}{textField('accuracy','Độ chính xác','accuracy')}
              <label><span>Ngày sản xuất</span><input type="date" value={form.manufactureDate || ''} onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })} /></label>
              <label><span>Ngày đưa vào sử dụng</span><input type="date" value={form.inServiceDate || ''} onChange={(e) => setForm({ ...form, inServiceDate: e.target.value })} /></label>
              <label><span>Bảo hành đến ngày</span><input type="date" value={form.warrantyUntil || ''} onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })} /></label>
              {textField('warrantyContact','Liên hệ bảo hành','warrantyContact')}{textField('technicalSpecification','Thông số kỹ thuật','technicalSpecification',false,'Chọn thông số đã dùng hoặc nhập thông số mới')}{textField('description','Mô tả / chức năng chính','description')}{textField('note','Ghi chú','note')}{textField('relatedDocuments','Tài liệu liên quan','relatedDocuments')}
              <label className="wide equipment-register-photo"><span>Ảnh thiết bị</span><div className="equipment-register-photo-box" tabIndex={0} onClick={handlePhotoBoxClick} onPaste={handlePhotoPaste} title="Nhấn để dán ảnh từ clipboard hoặc Ctrl+V">{photoPreview ? <img src={photoPreview} alt="Ảnh thiết bị chuẩn bị đăng ký" /> : <div>Nhấn để dán ảnh · hoặc Ctrl+V</div>}<label className="equipment-register-photo-pick" onClick={(event) => event.stopPropagation()}>📷 Chụp / chọn ảnh<input type="file" accept="image/*" capture="environment" onClick={(event) => event.stopPropagation()} onChange={(event) => setPhotoSelection(event.currentTarget.files?.[0] || null)} /></label><button type="button" onClick={(event) => { event.stopPropagation(); void pastePhotoFromClipboard() }}>📋 Dán ảnh từ clipboard</button>{photoFile ? <button type="button" onClick={(event) => { event.stopPropagation(); setPhotoSelection(null) }}>Bỏ ảnh</button> : null}</div><small>Nhấn vào khung để dán clipboard. Chỉ nút 📷 mới mở cửa sổ chọn ảnh.</small></label>
              <fieldset className="equipment-criticality-auto"><legend>Mức độ quan trọng thiết bị · hệ thống tự xác định</legend><p>5 câu dưới đây đều bắt buộc để hệ thống tính cấp A/B/C/D.</p><div className="equipment-criticality-questions">
                <label><span>Thiết bị trực tiếp tạo / kiểm soát đặc tính chất lượng? *</span><select required value={booleanSelectValue(form.controlsProductQuality)} onChange={(e) => setForm({ ...form, controlsProductQuality: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
                <label><span>Liên quan đặc tính đặc biệt / an toàn sản phẩm? *</span><select required value={booleanSelectValue(form.specialCharacteristicImpact)} onChange={(e) => setForm({ ...form, specialCharacteristicImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
                <label><span>Mất chức năng có dừng công đoạn / dây chuyền? *</span><select required value={booleanSelectValue(form.stopsProduction)} onChange={(e) => setForm({ ...form, stopsProduction: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
                <label><span>Có thiết bị / phương án dự phòng dùng ngay? *</span><select required value={booleanSelectValue(form.hasBackup)} onChange={(e) => setForm({ ...form, hasBackup: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
                <label><span>Mất chức năng có rủi ro sản lượng / giao hàng? *</span><select required value={booleanSelectValue(form.capacityImpact)} onChange={(e) => setForm({ ...form, capacityImpact: parseBooleanSelect(e.target.value) })}><option value="">Chọn…</option><option value="YES">Có</option><option value="NO">Không</option></select></label>
              </div></fieldset>
              <div className="equipment-register-outcomes"><div className={`equipment-criticality-result${criticality ? ` level-${criticality.toLowerCase()}` : ''}`}><span>Mức hệ thống tính</span><strong>{criticality ? `Cấp ${criticality}` : 'Chưa đủ dữ kiện'}</strong></div><div className="equipment-register-result"><span>Mã thiết bị + mã QR tự sinh sau khi lưu</span><strong>{form.equipmentType === 'PRODUCTION' ? 'CEV-PR-…' : 'CEV-ME-…'}</strong><small>Không nhập mã bằng tay.</small></div></div>
            </div>
          </div>
          <footer className="equipment-register-footer">
            <div className={`equipment-register-required-state${missingRequired.length ? ' missing' : ' complete'}`}>{missingRequired.length ? `Còn thiếu (${missingRequired.length}): ${missingRequired.join(' · ')}` : 'Đã đủ các trường bắt buộc.'}</div>
            <div className="equipment-register-footer-actions"><button type="button" className="equipment-cancel" onClick={closeDrawer}>Hủy</button><button type="submit" className="equipment-primary equipment-register-save" disabled={!canSubmit}>{saving ? 'Đang tạo…' : 'Tạo thiết bị & sinh mã'}</button></div>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  ) : null

  const toast = !open && message ? createPortal(<div className="equipment-register-toast" role="status">{message}</div>, document.body) : null
  return <>{trigger}{drawer}{toast}</>
}
