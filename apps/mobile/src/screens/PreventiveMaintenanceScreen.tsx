import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { revalidateEquipmentList, type EquipmentListItem } from '../features/equipment'
import {
  generatePmWorkOrder,
  listMeters,
  listPmSchedules,
  savePmSchedule,
  setPmScheduleActive,
  type MeterItem,
  type PmDueItem,
} from '../features/preventive-maintenance'

const TIME_UNITS = [
  ['HOURS', 'Giờ'], ['DAYS', 'Ngày'], ['WEEKS', 'Tuần'], ['MONTHS', 'Tháng'], ['YEARS', 'Năm'],
] as const
const TYPES = ['TIME', 'METER', 'EITHER'] as const
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}
function nextDate(interval: number, unit: string) {
  const date = new Date()
  if (unit === 'HOURS') date.setHours(date.getHours() + interval)
  if (unit === 'DAYS') date.setDate(date.getDate() + interval)
  if (unit === 'WEEKS') date.setDate(date.getDate() + interval * 7)
  if (unit === 'MONTHS') date.setMonth(date.getMonth() + interval)
  if (unit === 'YEARS') date.setFullYear(date.getFullYear() + interval)
  return date.toISOString()
}

export function PreventiveMaintenanceScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<PmDueItem[]>([])
  const [meters, setMeters] = useState<MeterItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [lastGeneratedWorkOrderId, setLastGeneratedWorkOrderId] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState('')
  const [equipmentQuery, setEquipmentQuery] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduleType, setScheduleType] = useState<'TIME' | 'METER' | 'EITHER'>('TIME')
  const [priority, setPriority] = useState('NORMAL')
  const [timeInterval, setTimeInterval] = useState('1')
  const [timeUnit, setTimeUnit] = useState<'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS'>('MONTHS')
  const [meterId, setMeterId] = useState('')
  const [meterInterval, setMeterInterval] = useState('100')
  const [leadTimeMinutes, setLeadTimeMinutes] = useState('0')

  async function refresh() {
    setError('')
    try {
      const [nextItems, nextMeters, nextEquipment] = await Promise.all([
        listPmSchedules(true), listMeters(), revalidateEquipmentList({ force: true }),
      ])
      setItems(nextItems); setMeters(nextMeters); setEquipment(nextEquipment.filter((item) => !item.archived))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được lịch bảo trì phòng ngừa.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((item) => `${item.title} ${item.equipmentId} ${item.scheduleType}`.toLowerCase().includes(q)) : items
  }, [items, search])
  const equipmentMatches = useMemo(() => {
    const q = equipmentQuery.trim().toLowerCase()
    return equipment.filter((item) => !q || `${item.equipmentId} ${item.equipmentName} ${item.model}`.toLowerCase().includes(q)).slice(0, 8)
  }, [equipment, equipmentQuery])
  const equipmentMeters = useMemo(() => meters.filter((meter) => meter.equipmentId === equipmentId), [equipmentId, meters])
  const selectedEquipment = equipment.find((item) => item.equipmentId === equipmentId)
  const selectedMeter = meters.find((meter) => meter.meterId === meterId)
  const editing = items.find((item) => item.scheduleId === editingId)

  function resetForm() {
    setEditingId(''); setEquipmentQuery(''); setEquipmentId(''); setTitle(''); setDescription('')
    setScheduleType('TIME'); setPriority('NORMAL'); setTimeInterval('1'); setTimeUnit('MONTHS')
    setMeterId(''); setMeterInterval('100'); setLeadTimeMinutes('0'); setFormOpen(false)
  }
  function openCreate() { resetForm(); setFormOpen(true) }
  function openEdit(item: PmDueItem) {
    setEditingId(item.scheduleId); setEquipmentId(item.equipmentId); setEquipmentQuery('')
    setTitle(item.title); setDescription(item.description); setScheduleType(item.scheduleType)
    setPriority(item.priority || 'NORMAL'); setTimeInterval(String(item.timeInterval || 1))
    setTimeUnit((item.timeUnit || 'MONTHS') as typeof timeUnit); setMeterId(item.meterId)
    setMeterInterval(String(item.meterInterval || 100)); setLeadTimeMinutes(String(item.leadTimeMinutes || 0)); setFormOpen(true)
  }

  async function saveSchedule() {
    const interval = Number(timeInterval)
    const meterStep = Number(meterInterval)
    const lead = Math.max(0, Number(leadTimeMinutes) || 0)
    const needsTime = scheduleType !== 'METER'
    const needsMeter = scheduleType !== 'TIME'
    if (!equipmentId || !title.trim()) { setError('Chọn thiết bị và nhập tên kế hoạch.'); return }
    if (needsTime && !(interval > 0)) { setError('Chu kỳ thời gian phải lớn hơn 0.'); return }
    if (needsMeter && (!meterId || !(meterStep > 0))) { setError('Chọn meter và nhập chu kỳ meter lớn hơn 0.'); return }

    setSavingId(editingId || 'NEW'); setError('')
    try {
      await savePmSchedule({
        scheduleId: editingId || undefined,
        equipmentId,
        title,
        description,
        scheduleType,
        priority,
        active: editing?.active ?? true,
        timeInterval: needsTime ? interval : null,
        timeUnit: needsTime ? timeUnit : null,
        nextDueAt: needsTime ? (editing?.nextDueAt || nextDate(interval, timeUnit)) : undefined,
        meterId: needsMeter ? meterId : null,
        meterInterval: needsMeter ? meterStep : null,
        nextMeterDue: needsMeter ? (editing?.nextMeterDue ?? ((selectedMeter?.latestValue ?? 0) + meterStep)) : null,
        leadTimeMinutes: lead,
      })
      resetForm(); await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được kế hoạch PM.') }
    finally { setSavingId('') }
  }

  async function toggleActive(item: PmDueItem) {
    if (savingId) return
    setSavingId(item.scheduleId); setError('')
    try { await setPmScheduleActive(item.scheduleId, !item.active); await refresh() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không cập nhật được kế hoạch PM.') }
    finally { setSavingId('') }
  }

  async function generate(item: PmDueItem) {
    if (!item.active || !item.isDue || savingId) return
    setSavingId(item.scheduleId); setError(''); setLastGeneratedWorkOrderId('')
    try {
      const result = await generatePmWorkOrder(item.scheduleId)
      if (result.workOrderId) setLastGeneratedWorkOrderId(result.workOrderId)
      await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tạo được Work Order từ lịch PM.') }
    finally { setSavingId('') }
  }

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable><Text style={styles.title}>Bảo trì phòng ngừa</Text><Pressable onPress={() => void refresh()} style={styles.iconButton}><Ionicons name="refresh" size={21} color="#344054" /></Pressable></View>
    <View style={styles.toolbar}><View style={styles.searchBox}><Ionicons name="search" size={18} color="#667085"/><TextInput value={search} onChangeText={setSearch} placeholder="Tìm kế hoạch hoặc thiết bị" placeholderTextColor="#98A2B3" style={styles.searchInput}/></View><Pressable onPress={openCreate} style={styles.addButton}><Ionicons name="add" size={20} color="#FFF"/></Pressable></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {lastGeneratedWorkOrderId ? <View style={styles.successBox}><Text style={styles.success}>Đã tạo Work Order: {lastGeneratedWorkOrderId}</Text></View> : null}
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF"/><Text style={styles.muted}>Đang tải lịch PM...</Text></View> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {formOpen ? <View style={styles.formCard}>
        <View style={styles.formHeader}><Text style={styles.formTitle}>{editingId ? 'Sửa kế hoạch PM' : 'Thêm kế hoạch PM'}</Text><Pressable onPress={resetForm}><Ionicons name="close" size={22} color="#667085"/></Pressable></View>
        <Text style={styles.fieldLabel}>Thiết bị</Text>
        {selectedEquipment ? <View style={styles.selectedBox}><Text style={styles.selectedText}>{selectedEquipment.equipmentName || selectedEquipment.equipmentId}</Text><Text style={styles.sub}>{selectedEquipment.equipmentId}</Text></View> : <><TextInput value={equipmentQuery} onChangeText={setEquipmentQuery} placeholder="Tìm tên / mã thiết bị" placeholderTextColor="#98A2B3" style={styles.input}/>{equipmentMatches.map((eq) => <Pressable key={eq.equipmentId} onPress={() => { setEquipmentId(eq.equipmentId); setMeterId('') }} style={styles.optionRow}><Text style={styles.optionTitle}>{eq.equipmentName || eq.equipmentId}</Text><Text style={styles.sub}>{eq.equipmentId}{eq.model ? ` · ${eq.model}` : ''}</Text></Pressable>)}</>}
        {selectedEquipment ? <Pressable onPress={() => { setEquipmentId(''); setMeterId('') }}><Text style={styles.link}>Đổi thiết bị</Text></Pressable> : null}
        <Text style={styles.fieldLabel}>Tên kế hoạch</Text><TextInput value={title} onChangeText={setTitle} placeholder="Ví dụ: Bôi trơn máy hàng tháng" placeholderTextColor="#98A2B3" style={styles.input}/>
        <Text style={styles.fieldLabel}>Mô tả</Text><TextInput value={description} onChangeText={setDescription} multiline placeholder="Nội dung bảo trì" placeholderTextColor="#98A2B3" style={[styles.input,styles.multiline]}/>
        <Text style={styles.fieldLabel}>Loại lịch</Text><View style={styles.chips}>{TYPES.map((value) => <Chip key={value} label={value} active={scheduleType===value} onPress={() => { setScheduleType(value); if (value==='TIME') setMeterId('') }}/>)}</View>
        <Text style={styles.fieldLabel}>Ưu tiên</Text><View style={styles.chips}>{PRIORITIES.map((value) => <Chip key={value} label={value} active={priority===value} onPress={() => setPriority(value)}/>)}</View>
        {scheduleType !== 'METER' ? <><Text style={styles.fieldLabel}>Chu kỳ thời gian</Text><View style={styles.inline}><TextInput value={timeInterval} onChangeText={setTimeInterval} keyboardType="number-pad" style={[styles.input,styles.smallInput]}/><View style={[styles.chips,styles.flex]}>{TIME_UNITS.map(([value,label]) => <Chip key={value} label={label} active={timeUnit===value} onPress={() => setTimeUnit(value)}/>)}</View></View></> : null}
        {scheduleType !== 'TIME' ? <><Text style={styles.fieldLabel}>Meter</Text>{equipmentMeters.length ? <View style={styles.chips}>{equipmentMeters.map((meter) => <Chip key={meter.meterId} label={`${meter.name} (${meter.latestValue ?? '—'} ${meter.unit})`} active={meterId===meter.meterId} onPress={() => setMeterId(meter.meterId)}/>)}</View> : <Text style={styles.warning}>Thiết bị này chưa có meter đang hoạt động.</Text>}<Text style={styles.fieldLabel}>Chu kỳ meter</Text><TextInput value={meterInterval} onChangeText={setMeterInterval} keyboardType="decimal-pad" style={styles.input}/></> : null}
        <Text style={styles.fieldLabel}>Lead time (phút)</Text><TextInput value={leadTimeMinutes} onChangeText={setLeadTimeMinutes} keyboardType="number-pad" style={styles.input}/>
        <Pressable disabled={Boolean(savingId)} onPress={() => void saveSchedule()} style={[styles.primaryButton,Boolean(savingId)&&styles.disabled]}><Text style={styles.primaryText}>{savingId ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo kế hoạch'}</Text></Pressable>
      </View> : null}

      {filtered.length ? filtered.map((item) => <View key={item.scheduleId} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.sub}>{item.equipmentId} · {item.scheduleType}</Text></View><View style={[styles.badge,!item.active ? styles.badgePaused : item.isDue ? styles.badgeDue : styles.badgeOk]}><Text style={[styles.badgeText,!item.active ? styles.badgeTextPaused : item.isDue ? styles.badgeTextDue : styles.badgeTextOk]}>{!item.active ? 'TẠM DỪNG' : item.isDue ? 'ĐẾN HẠN' : 'SẮP TỚI'}</Text></View></View>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        <View style={styles.infoRow}><Text style={styles.label}>Chu kỳ</Text><Text style={styles.value}>{item.scheduleType !== 'METER' ? `${item.timeInterval ?? '—'} ${item.timeUnit || ''}` : '—'}{item.scheduleType === 'EITHER' ? ' + meter' : ''}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Lịch thời gian</Text><Text style={styles.value}>{formatDate(item.nextDueAt)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Meter kế tiếp</Text><Text style={styles.value}>{item.nextMeterDue ?? '—'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Meter hiện tại</Text><Text style={styles.value}>{item.latestMeterValue ?? '—'}</Text></View>
        <View style={styles.reasonRow}>{item.timeDue ? <Text style={styles.reasonChip}>Theo thời gian</Text> : null}{item.meterDue ? <Text style={styles.reasonChip}>Theo meter</Text> : null}</View>
        <View style={styles.actions}><Pressable disabled={Boolean(savingId)} onPress={() => openEdit(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Sửa</Text></Pressable><Pressable disabled={Boolean(savingId)} onPress={() => void toggleActive(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{item.active ? 'Tạm dừng' : 'Kích hoạt'}</Text></Pressable></View>
        {item.active && item.isDue ? <Pressable disabled={Boolean(savingId)} onPress={() => void generate(item)} style={[styles.primaryButton,savingId===item.scheduleId&&styles.disabled]}><Text style={styles.primaryText}>{savingId===item.scheduleId?'Đang tạo...':'Tạo Work Order ngay'}</Text></Pressable> : null}
      </View>) : <View style={styles.center}><Ionicons name="calendar-outline" size={34} color="#98A2B3"/><Text style={styles.muted}>Không có kế hoạch phù hợp.</Text></View>}
    </ScrollView>}
  </SafeAreaView>
}

function Chip({ label, active, onPress }: { label:string; active:boolean; onPress:()=>void }) { return <Pressable onPress={onPress} style={[styles.chip,active&&styles.chipActive]}><Text style={[styles.chipText,active&&styles.chipTextActive]}>{label}</Text></Pressable> }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8FAFC'},header:{height:56,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},iconButton:{width:40,height:40,alignItems:'center',justifyContent:'center'},title:{fontSize:18,fontWeight:'700',color:'#101828'},toolbar:{flexDirection:'row',alignItems:'center',gap:8,padding:16,paddingBottom:8},searchBox:{height:44,borderWidth:1,borderColor:'#D0D5DD',borderRadius:10,backgroundColor:'#FFF',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8,flex:1},searchInput:{flex:1,color:'#101828'},addButton:{width:44,height:44,borderRadius:10,backgroundColor:'#155EEF',alignItems:'center',justifyContent:'center'},content:{padding:16,paddingTop:8,paddingBottom:32,gap:12},center:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',gap:10},muted:{color:'#667085'},error:{marginHorizontal:16,marginBottom:8,color:'#B42318'},successBox:{marginHorizontal:16,marginBottom:8,padding:12,borderRadius:10,backgroundColor:'#ECFDF3'},success:{color:'#027A48',fontWeight:'600'},card:{backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:'#EAECF0',padding:14,gap:10},cardTop:{flexDirection:'row',alignItems:'flex-start',gap:10},flex:{flex:1},cardTitle:{fontSize:16,fontWeight:'700',color:'#101828'},sub:{fontSize:13,color:'#667085',marginTop:3},description:{fontSize:13,color:'#475467'},badge:{paddingHorizontal:8,paddingVertical:4,borderRadius:999},badgeDue:{backgroundColor:'#FEF3F2'},badgeOk:{backgroundColor:'#ECFDF3'},badgePaused:{backgroundColor:'#F2F4F7'},badgeText:{fontSize:11,fontWeight:'700'},badgeTextDue:{color:'#B42318'},badgeTextOk:{color:'#027A48'},badgeTextPaused:{color:'#475467'},infoRow:{flexDirection:'row',justifyContent:'space-between',gap:16},label:{color:'#667085',fontSize:13},value:{color:'#344054',fontSize:13,fontWeight:'600',textAlign:'right'},reasonRow:{flexDirection:'row',gap:6,flexWrap:'wrap'},reasonChip:{backgroundColor:'#EFF8FF',color:'#175CD3',paddingHorizontal:8,paddingVertical:4,borderRadius:999,fontSize:12},primaryButton:{minHeight:42,borderRadius:9,backgroundColor:'#155EEF',alignItems:'center',justifyContent:'center',paddingHorizontal:14},primaryText:{color:'#FFF',fontWeight:'700'},disabled:{opacity:.55},actions:{flexDirection:'row',gap:8},secondaryButton:{flex:1,minHeight:40,borderWidth:1,borderColor:'#D0D5DD',borderRadius:9,alignItems:'center',justifyContent:'center'},secondaryText:{color:'#344054',fontWeight:'700'},formCard:{backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:'#B2CCFF',padding:14,gap:9},formHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},formTitle:{fontSize:17,fontWeight:'800',color:'#101828'},fieldLabel:{fontSize:12,fontWeight:'700',color:'#475467',marginTop:3},input:{minHeight:42,borderWidth:1,borderColor:'#D0D5DD',borderRadius:9,paddingHorizontal:12,color:'#101828',backgroundColor:'#FFF'},multiline:{minHeight:76,paddingTop:10,textAlignVertical:'top'},optionRow:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F2F4F7'},optionTitle:{fontSize:14,fontWeight:'700',color:'#101828'},selectedBox:{padding:10,borderRadius:9,backgroundColor:'#EFF8FF'},selectedText:{fontWeight:'700',color:'#175CD3'},link:{color:'#155EEF',fontWeight:'700'},chips:{flexDirection:'row',gap:6,flexWrap:'wrap'},chip:{paddingHorizontal:10,paddingVertical:7,borderRadius:999,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},chipActive:{borderColor:'#155EEF',backgroundColor:'#EFF8FF'},chipText:{fontSize:12,color:'#475467'},chipTextActive:{color:'#175CD3',fontWeight:'700'},inline:{flexDirection:'row',alignItems:'flex-start',gap:8},smallInput:{width:70},warning:{color:'#B54708',fontSize:12},
})
