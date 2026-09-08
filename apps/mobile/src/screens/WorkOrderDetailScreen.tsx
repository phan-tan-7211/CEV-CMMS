import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  addWorkOrderChecklistItem,
  addWorkOrderLabor,
  addWorkOrderPartUsage,
  completeWorkOrderChecklistItem,
  getWorkOrderDetailSnapshot,
  recordWorkOrderHandover,
  revalidateWorkOrderDetail,
  saveWorkOrderExecution,
  subscribeWorkOrderDetail,
  transitionWorkOrder,
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

function displayStatus(status: string) { return STATUS_LABEL[status.trim().toUpperCase()] || status || '—' }
function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
function asText(value: unknown) { return String(value ?? '').trim() }

export function WorkOrderDetailScreen({ workOrderId, onBack }: { workOrderId: string; onBack: () => void }) {
  const [item, setItem] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [checklistTitle, setChecklistTitle] = useState('')
  const [partName, setPartName] = useState('')
  const [partQty, setPartQty] = useState('1')
  const [partUnit, setPartUnit] = useState('EA')
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

  const execution = item?.sourceData || {}
  const selectedLaborPersonId = laborPersonId || item?.people[0]?.personId || ''
  const nextAction = item ? NEXT_ACTION[item.status] : undefined
  const canExecute = item?.status === 'IN_PROGRESS'
  const checklistCompleted = useMemo(() => item?.checklist.filter((x) => x.completed).length || 0, [item?.checklist])

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
  async function addPart() {
    const quantity = Number(partQty)
    await mutate(() => addWorkOrderPartUsage({ workOrderId, partName, quantity, unit: partUnit }), () => { setPartName(''); setPartQty('1') })
  }
  async function addLabor() {
    const minutes = Math.max(1, Number(laborMinutes) || 0)
    const ended = new Date()
    const started = new Date(ended.getTime() - minutes * 60_000)
    await mutate(() => addWorkOrderLabor({ workOrderId, personId: selectedLaborPersonId, startedAt: started.toISOString(), endedAt: ended.toISOString(), note: laborNote }), () => { setLaborMinutes('30'); setLaborNote('') })
  }
  async function saveExecution() {
    await mutate(() => saveWorkOrderExecution({ workOrderId, rootCause, correctiveAction, preventiveAction, executionNote }))
  }
  async function handover() {
    if (!item) return
    await mutate(() => recordWorkOrderHandover({ workOrderId, equipmentId: item.equipmentId, handoverPerson, receiverPerson, handoverReason, equipmentCondition: condition, accepted: true }))
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable><Text style={styles.title}>Chi tiết Work Order</Text><View style={styles.iconButton} /></View>

    {loading && !item ? <Center><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.muted}>Đang tải...</Text></Center> : item ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.hero}><Text style={styles.id}>{item.workOrderId}</Text><Text style={styles.reason}>{item.reason || 'Không có nội dung'}</Text><View style={styles.badge}><Text style={styles.badgeText}>{displayStatus(item.status)}</Text></View></View>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      <Section title="THIẾT BỊ"><Row label="Mã thiết bị" value={item.equipmentId || '—'} /><Row label="Tên thiết bị" value={item.equipmentName || '—'} /><Row label="Model" value={item.equipmentModel || '—'} last /></Section>
      <Section title="CÔNG VIỆC"><Row label="Ưu tiên" value={item.priority || '—'} /><Row label="Nguồn" value={item.sourceType || '—'} /><Row label="Mã nguồn" value={item.sourceId || '—'} /><Row label="Người tạo" value={item.createdBy || '—'} /><Row label="Tạo lúc" value={formatDate(item.createdAt)} last /></Section>

      <Section title="PHÂN CÔNG">
        {item.people.length ? item.people.map((person, index) => <Row key={person.personId} label={index === 0 ? 'Người thực hiện' : 'Người hỗ trợ'} value={`${person.displayName} · ${person.role}`} last={index === item.people.length - 1 && !item.teams.length} />) : <EmptyRow text="Chưa giao người thực hiện" />}
        {item.teams.map((team, index) => <Row key={team.teamId} label="Nhóm" value={`${team.name} · ${team.role}`} last={index === item.teams.length - 1} />)}
      </Section>

      <Section title={`CHECKLIST · ${checklistCompleted}/${item.checklist.length}`}>
        {item.checklist.length ? item.checklist.map((check) => <Pressable key={check.checklistItemId} disabled={saving || item.status === 'RELEASED'} onPress={() => void mutate(() => completeWorkOrderChecklistItem(check.checklistItemId, !check.completed))} style={styles.checkRow}><View style={[styles.checkbox, check.completed && styles.checkboxDone]}>{check.completed ? <Ionicons name="checkmark" size={16} color="#FFF" /> : null}</View><View style={styles.flex}><Text style={styles.checkTitle}>{check.title}{check.required ? ' *' : ''}</Text>{check.description ? <Text style={styles.sub}>{check.description}</Text> : null}</View></Pressable>) : <EmptyRow text="Chưa có checklist" />}
        {item.status !== 'RELEASED' ? <View style={styles.inlineForm}><TextInput value={checklistTitle} onChangeText={setChecklistTitle} placeholder="Thêm mục checklist" placeholderTextColor="#98A2B3" style={styles.input}/><SmallButton label="Thêm" disabled={!checklistTitle.trim() || saving} onPress={() => void addChecklist()} /></View> : null}
      </Section>

      <Section title="KẾT QUẢ THỰC HIỆN">
        <FormField label="Nguyên nhân gốc" value={rootCause || asText(execution.rootCause)} onChangeText={setRootCause} placeholder="Root cause" editable={item.status !== 'RELEASED'} multiline />
        <FormField label="Hành động khắc phục" value={correctiveAction || asText(execution.correctiveAction)} onChangeText={setCorrectiveAction} placeholder="Corrective action" editable={item.status !== 'RELEASED'} multiline />
        <FormField label="Hành động phòng ngừa" value={preventiveAction || asText(execution.preventiveAction)} onChangeText={setPreventiveAction} placeholder="Preventive action" editable={item.status !== 'RELEASED'} multiline />
        <FormField label="Ghi chú" value={executionNote || asText(execution.executionNote)} onChangeText={setExecutionNote} placeholder="Ghi chú thực hiện" editable={item.status !== 'RELEASED'} multiline />
        {item.status !== 'RELEASED' ? <SmallButton label="Lưu kết quả" disabled={saving} onPress={() => void saveExecution()} /> : null}
      </Section>

      <Section title="PHỤ TÙNG SỬ DỤNG">
        {item.parts.length ? item.parts.map((part) => <Row key={part.usageId} label={part.partName || 'Phụ tùng'} value={`${part.quantity} ${part.unit || ''}${part.unitCost !== null ? ` · ${part.unitCost}` : ''}`} />) : <EmptyRow text="Chưa ghi nhận phụ tùng" />}
        {canExecute ? <View style={styles.formBlock}><FormField label="Tên phụ tùng" value={partName} onChangeText={setPartName} placeholder="Tên / mã phụ tùng"/><View style={styles.twoCol}><View style={styles.flex}><FormField label="Số lượng" value={partQty} onChangeText={setPartQty} placeholder="1"/></View><View style={styles.flex}><FormField label="Đơn vị" value={partUnit} onChangeText={setPartUnit} placeholder="EA"/></View></View><SmallButton label="Ghi nhận phụ tùng" disabled={saving || !partName.trim() || !(Number(partQty) > 0)} onPress={() => void addPart()} /></View> : null}
      </Section>

      <Section title="GIỜ CÔNG">
        {item.labor.length ? item.labor.map((labor) => <Row key={labor.laborId} label={item.people.find((p) => p.personId === labor.personId)?.displayName || labor.personId || 'Nhân sự'} value={`${labor.minutes ?? '—'} phút${labor.note ? ` · ${labor.note}` : ''}`} />) : <EmptyRow text="Chưa ghi nhận giờ công" />}
        {canExecute ? <View style={styles.formBlock}>{item.people.length ? <View style={styles.chips}>{item.people.map((person) => { const active = selectedLaborPersonId === person.personId; return <Pressable key={person.personId} onPress={() => setLaborPersonId(person.personId)} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{person.displayName}</Text></Pressable>})}</View> : <Text style={styles.warning}>Cần giao người thực hiện trước khi ghi giờ công.</Text>}<FormField label="Số phút" value={laborMinutes} onChangeText={setLaborMinutes} placeholder="30"/><FormField label="Ghi chú" value={laborNote} onChangeText={setLaborNote} placeholder="Nội dung thực hiện"/><SmallButton label="Ghi giờ công" disabled={saving || !selectedLaborPersonId || !(Number(laborMinutes) > 0)} onPress={() => void addLabor()} /></View> : null}
      </Section>

      <Section title="DOWNTIME">
        {item.downtime.length ? item.downtime.map((dt) => <View key={dt.downtimeId} style={styles.dataBlock}><Text style={styles.dataTitle}>{dt.downtimeId}</Text><Text style={styles.sub}>{formatDate(dt.startedAt)} → {dt.endedAt ? formatDate(dt.endedAt) : 'Đang dừng'}</Text>{asText(dt.sourceData.causeCategory) ? <Text style={styles.sub}>Nguyên nhân: {asText(dt.sourceData.causeCategory)}</Text> : null}</View>) : <EmptyRow text="Không có downtime liên kết" />}
      </Section>

      {item.attachments.length ? <Section title="TỆP ĐÍNH KÈM">{item.attachments.map((file) => <Row key={file.attachmentId} label={file.attachmentKind || 'FILE'} value={file.fileName || file.storagePath} />)}</Section> : null}

      {item.status === 'VERIFIED' && !item.acceptedHandover ? <Section title="BÀN GIAO THIẾT BỊ"><FormField label="Người bàn giao" value={handoverPerson} onChangeText={setHandoverPerson} placeholder="Tên người bàn giao"/><FormField label="Người nhận" value={receiverPerson} onChangeText={setReceiverPerson} placeholder="Tên người nhận"/><FormField label="Lý do" value={handoverReason} onChangeText={setHandoverReason} placeholder="Lý do bàn giao"/><View style={styles.chips}>{(['NORMAL','MINOR_ISSUE','NOT_OPERATIONAL'] as const).map((value) => <Pressable key={value} onPress={() => setCondition(value)} style={[styles.chip, condition === value && styles.chipActive]}><Text style={[styles.chipText, condition === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</View><SmallButton label="Xác nhận bàn giao" disabled={saving || !handoverPerson.trim() || !receiverPerson.trim() || !handoverReason.trim()} onPress={() => void handover()} /></Section> : null}

      {nextAction ? <View style={styles.actionWrap}><Pressable disabled={saving} onPress={() => void doTransition(nextAction.action)} style={[styles.primaryButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#FFF"/> : <Text style={styles.primaryText}>{nextAction.label}</Text>}</Pressable></View> : null}
      {item.status === 'VERIFIED' && item.acceptedHandover ? <View style={styles.actionWrap}><Pressable disabled={saving} onPress={() => void doTransition('RELEASE')} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryText}>Release thiết bị</Text></Pressable></View> : null}
      {item.status === 'RELEASED' ? <View style={styles.doneBox}><Ionicons name="checkmark-circle" size={24} color="#027A48"/><Text style={styles.doneText}>Work Order đã hoàn tất và thiết bị đã được release.</Text></View> : null}
    </ScrollView> : <Center><Ionicons name="alert-circle-outline" size={38} color="#98A2B3" /><Text style={styles.emptyTitle}>Không tìm thấy Work Order</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}</Center>}
  </SafeAreaView>
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionLabel}>{title}</Text><View style={styles.card}>{children}</View></View> }
function Row({ label, value, last }: { label: string; value: string; last?: boolean }) { return <View style={[styles.row, last && styles.lastRow]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View> }
function EmptyRow({ text }: { text: string }) { return <View style={styles.emptyRow}><Text style={styles.sub}>{text}</Text></View> }
function Center({ children }: { children: ReactNode }) { return <View style={styles.center}>{children}</View> }
function FormField({ label, value, onChangeText, placeholder, editable = true, multiline = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; editable?: boolean; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98A2B3" editable={editable} multiline={multiline} style={[styles.input, multiline && styles.textarea]} /></View> }
function SmallButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onPress} style={[styles.smallButton, disabled && styles.disabled]}><Text style={styles.smallButtonText}>{label}</Text></Pressable> }

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#F1F1FA'},header:{minHeight:58,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0',backgroundColor:'#FFF'},iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},title:{fontSize:18,fontWeight:'900',color:'#101828'},content:{paddingBottom:32},hero:{margin:14,padding:20,borderRadius:18,backgroundColor:'#E9EDFF'},id:{fontSize:13,fontWeight:'900',color:'#155EEF'},reason:{marginTop:8,fontSize:21,lineHeight:27,fontWeight:'900',color:'#101828'},badge:{alignSelf:'flex-start',marginTop:12,paddingHorizontal:11,paddingVertical:6,borderRadius:12,backgroundColor:'#F2F4F7'},badgeText:{fontSize:11.5,fontWeight:'900',color:'#344054'},section:{marginTop:6,paddingHorizontal:14},sectionLabel:{marginBottom:7,paddingHorizontal:16,fontSize:10.5,fontWeight:'800',letterSpacing:.65,color:'#98A2B3'},card:{overflow:'hidden',borderRadius:17,borderWidth:StyleSheet.hairlineWidth,borderColor:'#E1E1EA',backgroundColor:'#FFF'},row:{minHeight:58,paddingHorizontal:16,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},lastRow:{borderBottomWidth:0},rowLabel:{width:120,fontSize:13,fontWeight:'700',color:'#667085'},rowValue:{flex:1,textAlign:'right',fontSize:13.5,lineHeight:19,fontWeight:'700',color:'#1D2939'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:28},muted:{marginTop:8,fontSize:12.5,color:'#667085'},emptyTitle:{marginTop:10,marginBottom:5,fontSize:15,fontWeight:'900',color:'#344054'},errorBox:{marginHorizontal:16,marginBottom:8,padding:12,borderRadius:10,backgroundColor:'#FEF3F2'},errorText:{textAlign:'center',fontSize:12.5,color:'#B42318'},emptyRow:{padding:16},sub:{fontSize:12.5,lineHeight:18,color:'#667085'},checkRow:{minHeight:58,paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},checkbox:{width:22,height:22,borderRadius:5,borderWidth:2,borderColor:'#98A2B3',alignItems:'center',justifyContent:'center'},checkboxDone:{borderColor:'#12B76A',backgroundColor:'#12B76A'},checkTitle:{fontSize:14,fontWeight:'800',color:'#1D2939'},flex:{flex:1},inlineForm:{padding:12,flexDirection:'row',alignItems:'center',gap:8},formBlock:{padding:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0'},field:{paddingHorizontal:12,paddingTop:10},fieldLabel:{marginBottom:6,fontSize:11.5,fontWeight:'800',color:'#667085'},input:{minHeight:44,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',fontSize:13.5,color:'#101828'},textarea:{minHeight:78,paddingTop:10,textAlignVertical:'top'},smallButton:{margin:12,minHeight:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'},smallButtonText:{fontSize:13.5,fontWeight:'900',color:'#FFF'},twoCol:{flexDirection:'row',gap:8},chips:{padding:12,flexDirection:'row',flexWrap:'wrap',gap:7},chip:{paddingHorizontal:10,paddingVertical:7,borderRadius:16,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},chipActive:{borderColor:'#155EEF',backgroundColor:'#E9EDFF'},chipText:{fontSize:11.5,fontWeight:'800',color:'#475467'},chipTextActive:{color:'#155EEF'},warning:{padding:12,fontSize:12.5,color:'#B54708',backgroundColor:'#FFFAEB'},dataBlock:{padding:14,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},dataTitle:{fontSize:13,fontWeight:'900',color:'#344054'},actionWrap:{paddingHorizontal:14,paddingTop:16},primaryButton:{minHeight:54,borderRadius:27,alignItems:'center',justifyContent:'center',backgroundColor:'#536DFE'},primaryText:{fontSize:15,fontWeight:'900',color:'#FFF'},disabled:{opacity:.45},doneBox:{margin:14,padding:14,flexDirection:'row',alignItems:'center',gap:9,borderRadius:14,backgroundColor:'#ECFDF3'},doneText:{flex:1,fontSize:13,fontWeight:'800',color:'#027A48'},
})