import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { listLocations, type LocationPickerItem } from '../features/master-data'
import {
  addFloorPlanPin,
  getSignedFileUrl,
  listChecklistTemplates,
  listCustomFields,
  listDowntime,
  listEquipmentOptions,
  listFloorPlans,
  listLibraryFiles,
  registerLibraryFile,
  saveChecklistTemplate,
  saveCustomField,
  saveFloorPlan,
  setDowntime,
  uploadImageArtifact,
  type ChecklistItem,
  type ChecklistTemplate,
  type CustomFieldDefinition,
  type DowntimeEvent,
  type EquipmentOption,
  type FloorPlan,
  type LibraryFile,
} from '../features/core-parity/api/coreParityService'

export type CoreParityTab = 'checklists' | 'fields' | 'files' | 'downtime' | 'floor'
const TABS: Array<{ key: CoreParityTab; label: string }> = [
  { key: 'checklists', label: 'Checklist' },
  { key: 'fields', label: 'Custom Fields' },
  { key: 'files', label: 'Files' },
  { key: 'downtime', label: 'Downtime' },
  { key: 'floor', label: 'Floor Plan' },
]

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>
}
function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, secondary && styles.secondaryButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text></Pressable>
}
function PickerRow({ items, selected, onSelect }: { items: Array<{ id: string; label: string }>; selected: string; onSelect: (id: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>{items.map((item) => <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.pill, item.id === selected && styles.pillSelected]}><Text style={[styles.pillText, item.id === selected && styles.pillTextSelected]}>{item.label}</Text></Pressable>)}</ScrollView>
}

export function CoreParityScreen({ onBack, initialTab = 'checklists' }: { onBack: () => void; initialTab?: CoreParityTab }) {
  const [tab, setTab] = useState<CoreParityTab>(initialTab)
  useEffect(() => { setTab(initialTab) }, [initialTab])
  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><View style={styles.header}><Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.headerCopy}><Text style={styles.headerTitle}>Core CMMS nâng cao</Text><Text style={styles.headerSub}>Checklist · Fields · Files · Downtime · Floor Plan</Text></View></View><PickerRow items={TABS.map((item) => ({ id: item.key, label: item.label }))} selected={tab} onSelect={(key) => setTab(key as CoreParityTab)}/>{tab === 'checklists' ? <ChecklistsPanel/> : null}{tab === 'fields' ? <CustomFieldsPanel/> : null}{tab === 'files' ? <FilesPanel/> : null}{tab === 'downtime' ? <DowntimePanel/> : null}{tab === 'floor' ? <FloorPlanPanel/> : null}</SafeAreaView>
}

function ChecklistsPanel() {
  const [rows, setRows] = useState<ChecklistTemplate[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<ChecklistItem[]>([{ itemType: 'CHECK', label: '', required: true }])
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { setRows(await listChecklistTemplates()) } catch (e) { Alert.alert('Checklist', e instanceof Error ? e.message : 'Không tải được checklist.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  async function save() {
    if (!name.trim() || items.some((item) => !item.label.trim())) return Alert.alert('Thiếu thông tin', 'Nhập tên checklist và nội dung từng task.')
    try { await saveChecklistTemplate({ name: name.trim(), description: description.trim(), items }); setName(''); setDescription(''); setItems([{ itemType: 'CHECK', label: '', required: true }]); await load() } catch (e) { Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Lỗi checklist.') }
  }
  return <ScrollView contentContainerStyle={styles.body}><SectionHeader title="Checklist Templates" subtitle="Template tái sử dụng cho Work Order / PM"/><View style={styles.card}><TextInput value={name} onChangeText={setName} placeholder="Tên checklist *" style={styles.input}/><TextInput value={description} onChangeText={setDescription} placeholder="Mô tả" style={styles.input}/>{items.map((item, index) => <View key={index} style={styles.taskBox}><TextInput value={item.label} onChangeText={(value) => setItems((current) => current.map((x, i) => i === index ? { ...x, label: value } : x))} placeholder={`Task ${index + 1} *`} style={styles.input}/><PickerRow items={['CHECK','TEXT','NUMBER','SELECT'].map((x) => ({ id: x, label: x }))} selected={item.itemType} onSelect={(value) => setItems((current) => current.map((x, i) => i === index ? { ...x, itemType: value } : x))}/><Pressable onPress={() => setItems((current) => current.map((x, i) => i === index ? { ...x, required: !x.required } : x))}><Text style={styles.toggleText}>{item.required ? '✓ Bắt buộc' : '○ Không bắt buộc'}</Text></Pressable></View>)}<View style={styles.row}><ActionButton label="+ Task" secondary onPress={() => setItems((current) => [...current, { itemType: 'CHECK', label: '', required: false }])}/><ActionButton label="Lưu template" onPress={() => { void save() }}/></View></View>{loading ? <ActivityIndicator/> : rows.map((row) => <View key={row.templateId} style={styles.listCard}><Text style={styles.listTitle}>{row.name}</Text><Text style={styles.muted}>{row.description || 'Không có mô tả'} · {row.items.length} task</Text>{row.items.slice(0, 4).map((item, i) => <Text key={i} style={styles.line}>• {item.label} <Text style={styles.muted}>({item.itemType})</Text></Text>)}</View>)}</ScrollView>
}

function CustomFieldsPanel() {
  const entityTypes = ['ASSET','WORK_ORDER','PART','LOCATION','METER','VENDOR','CUSTOMER']
  const fieldTypes = ['TEXT','NUMBER','DATE','BOOLEAN','SELECT','MULTI_SELECT']
  const [entityType, setEntityType] = useState('ASSET')
  const [fieldType, setFieldType] = useState('TEXT')
  const [label, setLabel] = useState('')
  const [required, setRequired] = useState(false)
  const [rows, setRows] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(false)
  async function load(type = entityType) { setLoading(true); try { setRows(await listCustomFields(type)) } catch (e) { Alert.alert('Custom Fields', e instanceof Error ? e.message : 'Không tải được custom fields.') } finally { setLoading(false) } }
  useEffect(() => { void load(entityType) }, [entityType])
  async function save() { if (!label.trim()) return Alert.alert('Thiếu tên field'); try { await saveCustomField({ entityType, label: label.trim(), fieldType, required }); setLabel(''); await load() } catch (e) { Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Lỗi custom field.') } }
  return <ScrollView contentContainerStyle={styles.body}><SectionHeader title="Custom Fields" subtitle="Field động theo từng loại dữ liệu"/><PickerRow items={entityTypes.map((x) => ({ id: x, label: x }))} selected={entityType} onSelect={setEntityType}/><View style={styles.card}><TextInput value={label} onChangeText={setLabel} placeholder="Tên field *" style={styles.input}/><PickerRow items={fieldTypes.map((x) => ({ id: x, label: x }))} selected={fieldType} onSelect={setFieldType}/><Pressable onPress={() => setRequired((value) => !value)}><Text style={styles.toggleText}>{required ? '✓ Required' : '○ Optional'}</Text></Pressable><ActionButton label="Thêm field" onPress={() => { void save() }}/></View>{loading ? <ActivityIndicator/> : rows.map((row) => <View key={row.fieldId} style={styles.listCard}><Text style={styles.listTitle}>{row.label}</Text><Text style={styles.muted}>{row.entityType} · {row.fieldType} · {row.required ? 'Required' : 'Optional'}</Text></View>)}</ScrollView>
}

function FilesPanel() {
  const [rows, setRows] = useState<LibraryFile[]>([])
  const [busy, setBusy] = useState(false)
  async function load() { try { setRows(await listLibraryFiles()) } catch (e) { Alert.alert('Files', e instanceof Error ? e.message : 'Không tải được Files Library.') } }
  useEffect(() => { void load() }, [])
  async function upload() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]; setBusy(true)
    try { const uploaded = await uploadImageArtifact(asset.uri, 'files', asset.mimeType || 'image/jpeg'); await registerLibraryFile({ fileName: asset.fileName || `image-${Date.now()}.jpg`, bucket: uploaded.bucket, path: uploaded.path, mimeType: asset.mimeType || 'image/jpeg', size: uploaded.size, tags: ['mobile'] }); await load() } catch (e) { Alert.alert('Upload lỗi', e instanceof Error ? e.message : 'Không upload được file.') } finally { setBusy(false) }
  }
  return <ScrollView contentContainerStyle={styles.body}><SectionHeader title="Files Library" subtitle="Kho file dùng lại cho Asset / WO / Part / Location"/><ActionButton label={busy ? 'Đang upload...' : '+ Upload ảnh/tệp hình'} disabled={busy} onPress={() => { void upload() }}/>{rows.map((row) => <View key={row.fileId} style={styles.listCard}><Text style={styles.listTitle}>{row.fileName}</Text><Text style={styles.muted}>{row.mimeType || 'file'} · {row.links.length} liên kết</Text><Text style={styles.path} numberOfLines={1}>{row.path}</Text></View>)}</ScrollView>
}

function DowntimePanel() {
  const [equipment, setEquipment] = useState<EquipmentOption[]>([])
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('')
  const [events, setEvents] = useState<DowntimeEvent[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { void listEquipmentOptions().then((rows) => { setEquipment(rows); if (rows[0]) setSelected(rows[0].id) }).catch(() => {}) }, [])
  useEffect(() => { if (selected) void listDowntime(selected).then(setEvents).catch(() => setEvents([])) }, [selected])
  const open = events.find((item) => !item.endedAt)
  async function change(action: 'START' | 'STOP') { if (!selected) return; setBusy(true); try { await setDowntime({ equipmentId: selected, action, reason: reason.trim() }); setReason(''); setEvents(await listDowntime(selected)) } catch (e) { Alert.alert('Downtime', e instanceof Error ? e.message : 'Không cập nhật downtime.') } finally { setBusy(false) } }
  return <ScrollView contentContainerStyle={styles.body}><SectionHeader title="Asset Downtime" subtitle="Ghi event downtime thật để tính availability / MTBF / MTTR"/><PickerRow items={equipment.map((x) => ({ id: x.id, label: x.name }))} selected={selected} onSelect={setSelected}/><View style={styles.card}><Text style={[styles.stateText, open ? styles.downText : styles.upText]}>{open ? '● ĐANG DOWNTIME' : '● ĐANG HOẠT ĐỘNG'}</Text><TextInput value={reason} onChangeText={setReason} placeholder="Lý do / ghi chú" style={styles.input}/><ActionButton label={open ? 'Kết thúc downtime' : 'Bắt đầu downtime'} disabled={busy} onPress={() => { void change(open ? 'STOP' : 'START') }}/></View>{events.map((event) => <View key={event.downtimeId} style={styles.listCard}><Text style={styles.listTitle}>{event.endedAt ? 'Downtime đã kết thúc' : 'Downtime đang mở'}</Text><Text style={styles.muted}>{event.reason || 'Không ghi lý do'} · {event.durationMinutes} phút</Text><Text style={styles.path}>{event.startedAt || ''}{event.endedAt ? ` → ${event.endedAt}` : ' → hiện tại'}</Text></View>)}</ScrollView>
}

function FloorPlanPanel() {
  const [locations, setLocations] = useState<LocationPickerItem[]>([])
  const [equipment, setEquipment] = useState<EquipmentOption[]>([])
  const [locationId, setLocationId] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [plans, setPlans] = useState<FloorPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [planUrl, setPlanUrl] = useState('')
  const [planName, setPlanName] = useState('Mặt bằng')
  const [x, setX] = useState('50')
  const [y, setY] = useState('50')
  useEffect(() => { void Promise.all([listLocations({ limit: 200 }), listEquipmentOptions()]).then(([locs, eqs]) => { setLocations(locs); setEquipment(eqs); if (locs[0]) setLocationId(locs[0].id); if (eqs[0]) setEquipmentId(eqs[0].id) }).catch(() => {}) }, [])
  async function loadPlans(id = locationId) { if (!id) return; const next = await listFloorPlans(id); setPlans(next); if (next[0]) setSelectedPlanId(next[0].floorPlanId); else setSelectedPlanId('') }
  useEffect(() => { if (locationId) void loadPlans(locationId) }, [locationId])
  const selectedPlan = useMemo(() => plans.find((p) => p.floorPlanId === selectedPlanId), [plans, selectedPlanId])
  useEffect(() => { if (selectedPlan) void getSignedFileUrl(selectedPlan.bucket, selectedPlan.path).then(setPlanUrl); else setPlanUrl('') }, [selectedPlan])
  async function addPlan() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.95 }); if (result.canceled || !result.assets[0] || !locationId) return; const asset = result.assets[0]; try { const uploaded = await uploadImageArtifact(asset.uri, 'floor-plans', asset.mimeType || 'image/jpeg'); await saveFloorPlan({ locationId, name: planName.trim() || 'Mặt bằng', bucket: uploaded.bucket, path: uploaded.path }); await loadPlans() } catch (e) { Alert.alert('Floor Plan', e instanceof Error ? e.message : 'Không lưu được floor plan.') } }
  async function addPin() { if (!selectedPlanId || !equipmentId) return; const xr = Number(x) / 100; const yr = Number(y) / 100; if (!Number.isFinite(xr) || !Number.isFinite(yr) || xr < 0 || xr > 1 || yr < 0 || yr > 1) return Alert.alert('Tọa độ', 'X/Y nhập từ 0 đến 100%.'); try { await addFloorPlanPin({ floorPlanId: selectedPlanId, equipmentId, label: equipment.find((e) => e.id === equipmentId)?.name || equipmentId, x: xr, y: yr, color: '#155EEF' }); await loadPlans() } catch (e) { Alert.alert('Pin lỗi', e instanceof Error ? e.message : 'Không thêm được pin.') } }
  return <ScrollView contentContainerStyle={styles.body}><SectionHeader title="Floor Plans" subtitle="Upload mặt bằng và pin thiết bị theo vị trí"/><PickerRow items={locations.map((x) => ({ id: x.id, label: x.name }))} selected={locationId} onSelect={setLocationId}/><View style={styles.card}><TextInput value={planName} onChangeText={setPlanName} placeholder="Tên mặt bằng" style={styles.input}/><ActionButton label="+ Upload mặt bằng" onPress={() => { void addPlan() }}/></View>{plans.length ? <PickerRow items={plans.map((p) => ({ id: p.floorPlanId, label: p.name }))} selected={selectedPlanId} onSelect={setSelectedPlanId}/> : <Text style={styles.muted}>Chưa có floor plan tại location này.</Text>}{selectedPlan ? <><View style={styles.planWrap}>{planUrl ? <Image source={{ uri: planUrl }} style={styles.planImage} resizeMode="contain"/> : <View style={styles.planImage}/>} {selectedPlan.pins.map((pin) => <View key={pin.pinId} style={[styles.pin, { left: `${Math.round(pin.x * 100)}%`, top: `${Math.round(pin.y * 100)}%` }]}><Ionicons name="location" size={25} color="#D92D20"/></View>)}</View><View style={styles.card}><Text style={styles.listTitle}>Thêm pin thiết bị</Text><PickerRow items={equipment.map((e) => ({ id: e.id, label: e.name }))} selected={equipmentId} onSelect={setEquipmentId}/><View style={styles.row}><TextInput value={x} onChangeText={setX} keyboardType="numeric" placeholder="X %" style={[styles.input, styles.flex]}/><TextInput value={y} onChangeText={setY} keyboardType="numeric" placeholder="Y %" style={[styles.input, styles.flex]}/></View><ActionButton label="Đặt pin" onPress={() => { void addPin() }}/></View></> : null}</ScrollView>
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8F9FB'},header:{minHeight:72,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},iconButton:{width:48,height:48,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},headerTitle:{fontSize:20,fontWeight:'900',color:'#101828'},headerSub:{marginTop:2,fontSize:11.5,color:'#667085'},pickerRow:{paddingHorizontal:12,paddingVertical:9,gap:8},pill:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'#EEF2F6'},pillSelected:{backgroundColor:'#155EEF'},pillText:{fontSize:12,fontWeight:'800',color:'#344054'},pillTextSelected:{color:'#FFF'},body:{padding:14,paddingBottom:40,gap:12},sectionHeader:{gap:3},sectionTitle:{fontSize:22,fontWeight:'900',color:'#101828'},sectionSubtitle:{fontSize:13,lineHeight:18,color:'#667085'},card:{padding:14,borderRadius:16,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:'#E4E7EC',gap:10},input:{minHeight:46,paddingHorizontal:12,borderRadius:11,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',fontSize:14,color:'#101828'},taskBox:{padding:10,borderRadius:12,backgroundColor:'#F9FAFB',gap:7},toggleText:{paddingVertical:7,fontSize:13,fontWeight:'800',color:'#344054'},row:{flexDirection:'row',gap:8,alignItems:'center'},flex:{flex:1},actionButton:{flex:1,minHeight:44,paddingHorizontal:14,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#155EEF'},secondaryButton:{backgroundColor:'#EEF4FF'},actionText:{fontSize:13.5,fontWeight:'900',color:'#FFF'},secondaryText:{color:'#155EEF'},disabled:{opacity:.5},pressed:{opacity:.72},listCard:{padding:14,borderRadius:15,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:'#E4E7EC',gap:5},listTitle:{fontSize:15,fontWeight:'900',color:'#101828'},muted:{fontSize:12.5,lineHeight:18,color:'#667085'},line:{fontSize:13,lineHeight:20,color:'#344054'},path:{fontSize:10.5,color:'#98A2B3'},stateText:{fontSize:17,fontWeight:'900'},downText:{color:'#D92D20'},upText:{color:'#039855'},planWrap:{height:300,borderRadius:16,overflow:'hidden',backgroundColor:'#EAECF0',position:'relative'},planImage:{width:'100%',height:'100%'},pin:{position:'absolute',marginLeft:-12,marginTop:-22},
})
