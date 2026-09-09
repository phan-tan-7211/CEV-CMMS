import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WorkOrderTimerCard } from '../components/WorkOrderTimerCard'
import { listPeople, type PersonPickerItem } from '../features/master-data'
import {
  addWorkOrderChecklistItem,
  addWorkOrderLabor,
  completeWorkOrderChecklistItem,
  getWorkOrderDetailSnapshot,
  issuePartToWorkOrder,
  listAvailablePartStock,
  recordWorkOrderHandover,
  revalidateWorkOrderDetail,
  saveWorkOrderExecution,
  setWorkOrderReviewAssignments,
  subscribeWorkOrderDetail,
  transitionWorkOrder,
  type AvailablePartStock,
  type WorkOrderDetail,
  type WorkOrderTransitionAction,
} from '../features/work-orders'

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Mở', WAITING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt', IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành', VERIFIED: 'Đã xác nhận', RELEASED: 'Đã bàn giao', ON_HOLD: 'Tạm dừng',
}
const NEXT_ACTION: Record<string, { action: WorkOrderTransitionAction; label: string } | undefined> = {
  OPEN: { action: 'REQUEST_APPROVAL', label: 'Gửi duyệt' },
  WAITING_APPROVAL: { action: 'APPROVE', label: 'Duyệt Work Order' },
  APPROVED: { action: 'START', label: 'Bắt đầu thực hiện' },
  IN_PROGRESS: { action: 'COMPLETE', label: 'Hoàn thành công việc' },
  COMPLETED: { action: 'VERIFY', label: 'Xác nhận hoàn thành' },
}
type ReviewRole = 'WATCHER' | 'APPROVER' | 'VERIFIER'

function text(value: unknown) { return String(value ?? '').trim() }
function displayStatus(status: string) { return STATUS_LABEL[status.trim().toUpperCase()] || status || '—' }
function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
function reviewLabel(role: ReviewRole) { return role === 'WATCHER' ? 'Theo dõi' : role === 'APPROVER' ? 'Người duyệt' : 'Người xác nhận' }

export function WorkOrderDetailScreen({ workOrderId, onBack }: { workOrderId: string; onBack: () => void }) {
  const [item, setItem] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [checklistTitle, setChecklistTitle] = useState('')
  const [laborPersonId, setLaborPersonId] = useState('')
  const [laborMinutes, setLaborMinutes] = useState('30')
  const [laborNote, setLaborNote] = useState('')
  const [rootCause, setRootCause] = useState('')
  const [correctiveAction, setCorrectiveAction] = useState('')
  const [preventiveAction, setPreventiveAction] = useState('')
  const [executionNote, setExecutionNote] = useState('')
  const [handoverPerson, setHandoverPerson] = useState('')
  const [receiverPerson, setReceiverPerson] = useState('')
  const [handoverReason, setHandoverReason] = useState('Bảo trì hoàn tất, bàn giao lại thiết bị')
  const [condition, setCondition] = useState<'NORMAL' | 'MINOR_ISSUE' | 'NOT_OPERATIONAL'>('NORMAL')

  const [people, setPeople] = useState<PersonPickerItem[]>([])
  const [reviewPicker, setReviewPicker] = useState<ReviewRole | null>(null)
  const [reviewIds, setReviewIds] = useState<Record<ReviewRole, string[]>>({ WATCHER: [], APPROVER: [], VERIFIER: [] })
  const [reviewSearch, setReviewSearch] = useState('')

  const [stockPickerVisible, setStockPickerVisible] = useState(false)
  const [stockRows, setStockRows] = useState<AvailablePartStock[]>([])
  const [stockSearch, setStockSearch] = useState('')
  const [selectedStock, setSelectedStock] = useState<AvailablePartStock | null>(null)
  const [stockQty, setStockQty] = useState('1')
  const [stockNote, setStockNote] = useState('')

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeWorkOrderDetail(workOrderId, (next) => { if (mounted) setItem(next) })
    void getWorkOrderDetailSnapshot(workOrderId)
      .then((snapshot) => {
        if (!mounted) return null
        if (snapshot) setItem(snapshot)
        setLoading(!snapshot)
        return revalidateWorkOrderDetail(workOrderId)
      })
      .then((next) => { if (mounted && next) setItem(next) })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false; unsubscribe() }
  }, [workOrderId])

  useEffect(() => {
    if (!item) return
    setReviewIds({
      WATCHER: item.people.filter((p) => p.role === 'WATCHER').map((p) => p.personId),
      APPROVER: item.people.filter((p) => p.role === 'APPROVER').map((p) => p.personId),
      VERIFIER: item.people.filter((p) => p.role === 'VERIFIER').map((p) => p.personId),
    })
  }, [item])

  const execution = item?.sourceData || {}
  const selectedLaborPersonId = laborPersonId || item?.people.find((p) => p.role === 'PRIMARY_ASSIGNEE' || p.role === 'ASSIGNEE')?.personId || ''
  const nextAction = item ? NEXT_ACTION[item.status] : undefined
  const canExecute = item?.status === 'IN_PROGRESS'
  const canEditExecution = item?.status === 'IN_PROGRESS' || item?.status === 'COMPLETED'
  const canEditReviewers = Boolean(item && !['VERIFIED', 'RELEASED'].includes(item.status))
  const canAddChecklist = Boolean(item && ['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS'].includes(item.status))
  const checklistCompleted = useMemo(() => item?.checklist.filter((x) => x.completed).length || 0, [item?.checklist])
  const requiredIncomplete = useMemo(() => item?.checklist.filter((x) => x.required && !x.completed).length || 0, [item?.checklist])
  const filteredPeople = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase()
    return q ? people.filter((p) => `${p.name} ${p.email} ${p.jobTitle}`.toLowerCase().includes(q)) : people
  }, [people, reviewSearch])
  const filteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase()
    return q ? stockRows.filter((row) => `${row.partNumber} ${row.partName} ${row.barcode} ${row.stockLocationCode} ${row.stockLocationName}`.toLowerCase().includes(q)) : stockRows
  }, [stockRows, stockSearch])

  async function refresh() {
    const next = await revalidateWorkOrderDetail(workOrderId)
    if (next) setItem(next)
  }
  async function mutate(task: () => Promise<unknown>, after?: () => void) {
    if (saving) return
    setSaving(true); setError('')
    try { await task(); after?.(); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được thay đổi.') }
    finally { setSaving(false) }
  }
  async function doTransition(action: WorkOrderTransitionAction) { await mutate(() => transitionWorkOrder(workOrderId, action)) }
  async function addChecklist() {
    if (!checklistTitle.trim()) return
    await mutate(() => addWorkOrderChecklistItem(workOrderId, checklistTitle, false), () => setChecklistTitle(''))
  }
  async function addLabor() {
    const minutes = Math.max(1, Number(laborMinutes) || 0)
    const ended = new Date(); const started = new Date(ended.getTime() - minutes * 60_000)
    await mutate(() => addWorkOrderLabor({ workOrderId, personId: selectedLaborPersonId, startedAt: started.toISOString(), endedAt: ended.toISOString(), note: laborNote }), () => { setLaborMinutes('30'); setLaborNote('') })
  }
  async function saveExecution() {
    await mutate(() => saveWorkOrderExecution({ workOrderId, rootCause: rootCause || text(execution.rootCause), correctiveAction: correctiveAction || text(execution.correctiveAction), preventiveAction: preventiveAction || text(execution.preventiveAction), executionNote: executionNote || text(execution.executionNote) }))
  }
  async function handover() {
    if (!item) return
    await mutate(() => recordWorkOrderHandover({ workOrderId, equipmentId: item.equipmentId, handoverPerson, receiverPerson, handoverReason, equipmentCondition: condition, accepted: true }))
  }
  async function openReviewPicker(role: ReviewRole) {
    try {
      setError(''); setReviewSearch(''); setPeople(await listPeople({ limit: 300 })); setReviewPicker(role)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được danh sách nhân sự.') }
  }
  function toggleReviewPerson(personId: string) {
    if (!reviewPicker) return
    setReviewIds((current) => ({ ...current, [reviewPicker]: current[reviewPicker].includes(personId) ? current[reviewPicker].filter((id) => id !== personId) : [...current[reviewPicker], personId] }))
  }
  async function saveReviewers() {
    await mutate(() => setWorkOrderReviewAssignments({ workOrderId, watcherPersonIds: reviewIds.WATCHER, approverPersonIds: reviewIds.APPROVER, verifierPersonIds: reviewIds.VERIFIER }), () => setReviewPicker(null))
  }
  async function openStockPicker() {
    try {
      setError(''); setStockSearch(''); setSelectedStock(null); setStockQty('1'); setStockNote(''); setStockRows(await listAvailablePartStock()); setStockPickerVisible(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được tồn kho.') }
  }
  async function issueSelectedStock() {
    if (!selectedStock) return
    const quantity = Number(stockQty)
    if (!(quantity > 0) || quantity > selectedStock.quantityAvailable) { setError('Số lượng xuất phải lớn hơn 0 và không vượt tồn khả dụng.'); return }
    await mutate(() => issuePartToWorkOrder({ workOrderId, partId: selectedStock.partId, stockLocationId: selectedStock.stockLocationId, quantity, note: stockNote }), () => { setStockPickerVisible(false); setSelectedStock(null) })
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable><Text style={styles.title}>Chi tiết Work Order</Text><View style={styles.iconButton} /></View>
    {loading && !item ? <Center><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.muted}>Đang tải...</Text></Center> : item ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.hero}><Text style={styles.id}>{item.workOrderId}</Text><Text style={styles.reason}>{item.reason || 'Không có nội dung'}</Text><View style={styles.badge}><Text style={styles.badgeText}>{displayStatus(item.status)}</Text></View></View>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      <Section title="THIẾT BỊ"><Row label="Mã thiết bị" value={item.equipmentId || '—'} /><Row label="Tên thiết bị" value={item.equipmentName || '—'} /><Row label="Model" value={item.equipmentModel || '—'} last /></Section>
      <Section title="CÔNG VIỆC"><Row label="Ưu tiên" value={item.priority || '—'} /><Row label="Nguồn" value={item.sourceType || '—'} /><Row label="Mã nguồn" value={item.sourceId || '—'} /><Row label="Người tạo" value={item.createdBy || '—'} /><Row label="Tạo lúc" value={formatDate(item.createdAt)} last /></Section>

      <Section title="PHÂN CÔNG">
        {item.people.filter((p) => p.role === 'PRIMARY_ASSIGNEE' || p.role === 'ASSIGNEE').map((person) => <Row key={`${person.role}-${person.personId}`} label={person.role === 'PRIMARY_ASSIGNEE' ? 'Người thực hiện' : 'Người hỗ trợ'} value={person.displayName} />)}
        {item.teams.map((team) => <Row key={`${team.role}-${team.teamId}`} label="Nhóm" value={`${team.name} · ${team.role}`} />)}
        {(['WATCHER','APPROVER','VERIFIER'] as ReviewRole[]).map((role) => {
          const names = item.people.filter((p) => p.role === role).map((p) => p.displayName)
          return <View key={role} style={styles.assignmentRow}><View style={styles.flex}><Text style={styles.rowLabel}>{reviewLabel(role)}</Text><Text style={styles.rowValue}>{names.length ? names.join(', ') : 'Chưa chọn'}</Text></View>{canEditReviewers ? <Pressable style={styles.linkButton} onPress={() => void openReviewPicker(role)}><Text style={styles.linkText}>Chọn</Text></Pressable> : null}</View>
        })}
      </Section>

      <Section title={`CHECKLIST · ${checklistCompleted}/${item.checklist.length}`}>
        {requiredIncomplete ? <Text style={styles.warning}>Còn {requiredIncomplete} mục bắt buộc chưa hoàn tất.</Text> : null}
        {item.checklist.length ? item.checklist.map((check) => <Pressable key={check.checklistItemId} disabled={saving || !canExecute} onPress={() => void mutate(() => completeWorkOrderChecklistItem(check.checklistItemId, !check.completed))} style={styles.checkRow}><View style={[styles.checkbox, check.completed && styles.checkboxDone]}>{check.completed ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}</View><View style={styles.flex}><Text style={styles.checkTitle}>{check.title}{check.required ? ' *' : ''}</Text>{check.description ? <Text style={styles.sub}>{check.description}</Text> : null}</View></Pressable>) : <EmptyRow text="Chưa có checklist" />}
        {canAddChecklist ? <View style={styles.inlineForm}><TextInput value={checklistTitle} onChangeText={setChecklistTitle} placeholder="Thêm mục checklist" placeholderTextColor="#98A2B3" style={styles.input}/><SmallButton label="Thêm" disabled={!checklistTitle.trim() || saving} onPress={() => void addChecklist()} /></View> : null}
      </Section>

      <Section title="KẾT QUẢ THỰC HIỆN">
        <FormField label="Nguyên nhân gốc" value={rootCause || text(execution.rootCause)} onChangeText={setRootCause} placeholder="Root cause" editable={canEditExecution} multiline />
        <FormField label="Hành động khắc phục" value={correctiveAction || text(execution.correctiveAction)} onChangeText={setCorrectiveAction} placeholder="Corrective action" editable={canEditExecution} multiline />
        <FormField label="Hành động phòng ngừa" value={preventiveAction || text(execution.preventiveAction)} onChangeText={setPreventiveAction} placeholder="Preventive action" editable={canEditExecution} multiline />
        <FormField label="Ghi chú" value={executionNote || text(execution.executionNote)} onChangeText={setExecutionNote} placeholder="Ghi chú thực hiện" editable={canEditExecution} multiline />
        {canEditExecution ? <SmallButton label="Lưu kết quả" disabled={saving} onPress={() => void saveExecution()} /> : <Text style={styles.muted}>Kết quả đã khóa ở trạng thái hiện tại.</Text>}
      </Section>

      <Section title="PHỤ TÙNG SỬ DỤNG">
        {item.parts.length ? item.parts.map((part) => <Row key={part.usageId} label={part.partName || 'Phụ tùng'} value={`${part.quantity} ${part.unit || ''}${part.unitCost !== null ? ` · ${part.unitCost}` : ''}`} />) : <EmptyRow text="Chưa ghi nhận phụ tùng" />}
        {canExecute ? <SmallButton label="Chọn từ tồn kho" disabled={saving} onPress={() => void openStockPicker()} /> : null}
      </Section>

      <Section title="GIỜ CÔNG">
        <WorkOrderTimerCard workOrderId={workOrderId} enabled={canExecute} onLaborCreated={refresh} />
        {item.labor.length ? item.labor.map((labor) => <Row key={labor.laborId} label={item.people.find((p) => p.personId === labor.personId)?.displayName || labor.personId || 'Nhân sự'} value={`${labor.minutes ?? '—'} phút${labor.note ? ` · ${labor.note}` : ''}`} />) : <EmptyRow text="Chưa ghi nhận giờ công" />}
        {canExecute ? <View style={styles.formBlock}>{item.people.filter((p) => p.role === 'PRIMARY_ASSIGNEE' || p.role === 'ASSIGNEE').length ? <View style={styles.chips}>{item.people.filter((p) => p.role === 'PRIMARY_ASSIGNEE' || p.role === 'ASSIGNEE').map((person) => { const active = selectedLaborPersonId === person.personId; return <Pressable key={person.personId} onPress={() => setLaborPersonId(person.personId)} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{person.displayName}</Text></Pressable>})}</View> : <Text style={styles.warning}>Cần giao người thực hiện trước khi ghi giờ công.</Text>}<FormField label="Số phút" value={laborMinutes} onChangeText={setLaborMinutes} placeholder="30"/><FormField label="Ghi chú" value={laborNote} onChangeText={setLaborNote} placeholder="Nội dung thực hiện"/><SmallButton label="Ghi giờ công" disabled={saving || !selectedLaborPersonId || !(Number(laborMinutes) > 0)} onPress={() => void addLabor()} /></View> : null}
      </Section>

      <Section title="DOWNTIME">{item.downtime.length ? item.downtime.map((dt) => <View key={dt.downtimeId} style={styles.dataBlock}><Text style={styles.dataTitle}>{dt.downtimeId}</Text><Text style={styles.sub}>{formatDate(dt.startedAt)} → {dt.endedAt ? formatDate(dt.endedAt) : 'Đang dừng'}</Text>{text(dt.sourceData.causeCategory) ? <Text style={styles.sub}>Nguyên nhân: {text(dt.sourceData.causeCategory)}</Text> : null}</View>) : <EmptyRow text="Không có downtime liên kết" />}</Section>
      {item.attachments.length ? <Section title="TỆP ĐÍNH KÈM">{item.attachments.map((file) => <Row key={file.attachmentId} label={file.attachmentKind || 'FILE'} value={file.fileName || file.storagePath} />)}</Section> : null}

      {item.status === 'VERIFIED' && !item.acceptedHandover ? <Section title="BÀN GIAO THIẾT BỊ"><FormField label="Người bàn giao" value={handoverPerson} onChangeText={setHandoverPerson} placeholder="Tên người bàn giao"/><FormField label="Người nhận" value={receiverPerson} onChangeText={setReceiverPerson} placeholder="Tên người nhận"/><FormField label="Lý do" value={handoverReason} onChangeText={setHandoverReason} placeholder="Lý do bàn giao"/><View style={styles.chips}>{(['NORMAL','MINOR_ISSUE','NOT_OPERATIONAL'] as const).map((value) => <Pressable key={value} onPress={() => setCondition(value)} style={[styles.chip, condition === value && styles.chipActive]}><Text style={[styles.chipText, condition === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</View><SmallButton label="Xác nhận bàn giao" disabled={saving || !handoverPerson.trim() || !receiverPerson.trim() || !handoverReason.trim()} onPress={() => void handover()} /></Section> : null}
      {item.status === 'VERIFIED' && item.acceptedHandover ? <View style={styles.actionBox}><Text style={styles.successText}>Thiết bị đã được chấp nhận bàn giao.</Text><SmallButton label="Release Work Order" disabled={saving} onPress={() => void doTransition('RELEASE')} /></View> : null}
      {nextAction ? <View style={styles.actionBox}><SmallButton label={nextAction.label} disabled={saving || (nextAction.action === 'COMPLETE' && requiredIncomplete > 0)} onPress={() => void doTransition(nextAction.action)} /></View> : null}
      <View style={styles.bottomSpace} />
    </ScrollView> : <Center><Text style={styles.muted}>Không tìm thấy Work Order.</Text></Center>}

    <Modal visible={reviewPicker !== null} transparent animationType="slide" onRequestClose={() => setReviewPicker(null)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>{reviewPicker ? reviewLabel(reviewPicker) : ''}</Text><TextInput value={reviewSearch} onChangeText={setReviewSearch} placeholder="Tìm nhân sự" style={styles.input}/><ScrollView style={styles.modalList}>{filteredPeople.map((person) => { const active = Boolean(reviewPicker && reviewIds[reviewPicker].includes(person.id)); return <Pressable key={person.id} onPress={() => toggleReviewPerson(person.id)} style={styles.pickerRow}><View style={[styles.checkbox, active && styles.checkboxDone]}>{active ? <Ionicons name="checkmark" size={16} color="#FFF"/> : null}</View><View style={styles.flex}><Text style={styles.checkTitle}>{person.name}</Text><Text style={styles.sub}>{[person.jobTitle, person.email].filter(Boolean).join(' · ')}</Text></View></Pressable>})}</ScrollView><View style={styles.modalActions}><SmallButton label="Hủy" disabled={saving} onPress={() => setReviewPicker(null)} secondary/><SmallButton label="Lưu" disabled={saving} onPress={() => void saveReviewers()} /></View></View></View></Modal>

    <Modal visible={stockPickerVisible} transparent animationType="slide" onRequestClose={() => setStockPickerVisible(false)}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Chọn phụ tùng từ kho</Text><TextInput value={stockSearch} onChangeText={setStockSearch} placeholder="Mã, tên, barcode hoặc vị trí kho" style={styles.input}/><ScrollView style={styles.modalList}>{filteredStock.map((row) => { const active = selectedStock?.partId === row.partId && selectedStock.stockLocationId === row.stockLocationId; return <Pressable key={`${row.partId}-${row.stockLocationId}`} onPress={() => setSelectedStock(row)} style={[styles.stockRow, active && styles.stockRowActive]}><Text style={styles.checkTitle}>{row.partNumber} · {row.partName}</Text><Text style={styles.sub}>{row.stockLocationCode} · {row.stockLocationName}</Text><Text style={styles.stockQty}>Khả dụng: {row.quantityAvailable} {row.unit}</Text></Pressable>})}</ScrollView>{selectedStock ? <View style={styles.formBlock}><Text style={styles.selectedText}>Đã chọn: {selectedStock.partNumber} · {selectedStock.stockLocationCode}</Text><FormField label={`Số lượng (tối đa ${selectedStock.quantityAvailable})`} value={stockQty} onChangeText={setStockQty} placeholder="1"/><FormField label="Ghi chú" value={stockNote} onChangeText={setStockNote} placeholder="Ghi chú xuất kho"/></View> : null}<View style={styles.modalActions}><SmallButton label="Hủy" disabled={saving} onPress={() => setStockPickerVisible(false)} secondary/><SmallButton label="Xuất cho WO" disabled={saving || !selectedStock || !(Number(stockQty) > 0)} onPress={() => void issueSelectedStock()} /></View></View></View></Modal>
  </SafeAreaView>
}

function Center({ children }: { children: ReactNode }) { return <View style={styles.center}>{children}</View> }
function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><View style={styles.card}>{children}</View></View> }
function Row({ label, value, last = false }: { label: string; value: string; last?: boolean }) { return <View style={[styles.row, last && styles.rowLast]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View> }
function EmptyRow({ text: value }: { text: string }) { return <Text style={styles.empty}>{value}</Text> }
function SmallButton({ label, onPress, disabled, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled]}><Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text></Pressable> }
function FormField({ label, value, onChangeText, placeholder, editable = true, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; editable?: boolean; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} editable={editable} multiline={multiline} style={[styles.input, multiline && styles.textarea, !editable && styles.inputDisabled]} /></View> }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F4F7' }, header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EAECF0' }, iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 18, fontWeight: '700', color: '#101828' }, content: { padding: 16 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { color: '#667085', fontSize: 13 }, hero: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, gap: 6 }, id: { color: '#155EEF', fontWeight: '800', fontSize: 16 }, reason: { color: '#101828', fontSize: 20, fontWeight: '700' }, badge: { alignSelf: 'flex-start', backgroundColor: '#EFF4FF', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 }, badgeText: { color: '#3538CD', fontWeight: '700', fontSize: 12 }, errorBox: { marginTop: 12, backgroundColor: '#FEF3F2', borderRadius: 10, padding: 12 }, errorText: { color: '#B42318', fontSize: 13 }, section: { marginTop: 16 }, sectionTitle: { color: '#667085', fontWeight: '700', fontSize: 12, marginBottom: 7 }, card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, gap: 10 }, row: { paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' }, rowLast: { borderBottomWidth: 0, paddingBottom: 0 }, rowLabel: { color: '#667085', fontSize: 12, marginBottom: 3 }, rowValue: { color: '#101828', fontSize: 14, fontWeight: '600' }, empty: { color: '#98A2B3', fontStyle: 'italic', paddingVertical: 4 }, assignmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }, linkButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#EFF4FF' }, linkText: { color: '#155EEF', fontWeight: '700' }, checkRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }, checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center' }, checkboxDone: { backgroundColor: '#155EEF', borderColor: '#155EEF' }, checkTitle: { color: '#101828', fontWeight: '600', fontSize: 14 }, sub: { color: '#667085', fontSize: 12, marginTop: 2 }, warning: { color: '#B54708', fontSize: 12, backgroundColor: '#FFFAEB', padding: 9, borderRadius: 8 }, inlineForm: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 }, input: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 9, paddingHorizontal: 11, color: '#101828', backgroundColor: '#FFF' }, inputDisabled: { backgroundColor: '#F2F4F7', color: '#667085' }, textarea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }, field: { gap: 5 }, fieldLabel: { color: '#475467', fontSize: 12, fontWeight: '600' }, formBlock: { gap: 10, marginTop: 4 }, chips: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, chip: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 }, chipActive: { backgroundColor: '#EFF4FF', borderColor: '#8098F9' }, chipText: { color: '#475467', fontSize: 12 }, chipTextActive: { color: '#3538CD', fontWeight: '700' }, dataBlock: { paddingVertical: 5 }, dataTitle: { color: '#101828', fontWeight: '700' }, actionBox: { marginTop: 16, backgroundColor: '#FFF', borderRadius: 12, padding: 14 }, button: { minHeight: 42, borderRadius: 9, backgroundColor: '#155EEF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, buttonSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D0D5DD' }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: '#FFF', fontWeight: '700' }, buttonTextSecondary: { color: '#344054' }, successText: { color: '#027A48', fontWeight: '600', marginBottom: 10 }, bottomSpace: { height: 24 }, flex: { flex: 1 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.45)', justifyContent: 'flex-end' }, modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '82%', gap: 12 }, modalTitle: { color: '#101828', fontSize: 18, fontWeight: '800' }, modalList: { maxHeight: 360 }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }, pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F2F4F7' }, stockRow: { padding: 11, borderRadius: 9, borderWidth: 1, borderColor: '#EAECF0', marginBottom: 8 }, stockRowActive: { borderColor: '#155EEF', backgroundColor: '#F5F8FF' }, stockQty: { color: '#027A48', fontWeight: '700', fontSize: 12, marginTop: 4 }, selectedText: { color: '#344054', fontWeight: '700' },
})
