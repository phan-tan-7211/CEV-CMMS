import { useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  EMPTY_EQUIPMENT_FILTER,
  type EquipmentFilter,
  type EquipmentListItem,
  uniqueEquipmentFilterValues,
} from '../features/equipment'
import { listLocationPaths, listParties, listPeople, listTeams } from '../features/master-data'
import { EquipmentFilterPickerScreen, type EquipmentFilterPickerKey } from './equipment-filter/EquipmentFilterPickerScreen'

type PickerConfig = { key: EquipmentFilterPickerKey; title: string }
type DateKey = 'createdStart' | 'createdEnd'

const PICKERS: Record<EquipmentFilterPickerKey, Omit<PickerConfig, 'key'>> = {
  locations: { title: 'Vị trí' },
  primaryUsers: { title: 'Người dùng chính' },
  assignedUsers: { title: 'Người dùng được giao' },
  assignedTeams: { title: 'Nhóm được giao' },
  assignedVendors: { title: 'Chọn Nhà cung cấp' },
  assignedCustomers: { title: 'Chọn Khách hàng' },
}

const EMPTY_LIVE_OPTIONS: Record<EquipmentFilterPickerKey,string[]> = { locations:[],primaryUsers:[],assignedUsers:[],assignedTeams:[],assignedVendors:[],assignedCustomers:[] }

function cloneEmptyFilter(): EquipmentFilter { return { ...EMPTY_EQUIPMENT_FILTER, locations: [], primaryUsers: [], assignedUsers: [], assignedTeams: [], assignedVendors: [], assignedCustomers: [] } }
function formatDate(value: string) { if (!value) return ''; const [year, month, day] = value.split('-'); return year && month && day ? `${day}/${month}/${year}` : value }
function toIsoDate(date: Date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}` }
function parseIsoDate(value: string) { if (!value) return new Date(); const parsed = new Date(`${value}T12:00:00`); return Number.isNaN(parsed.getTime()) ? new Date() : parsed }

function FilterTextField({ value, placeholder, onChangeText }: { value: string; placeholder: string; onChangeText: (value: string) => void }) {
  return <View style={styles.textFieldWrap}><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98A2B3" autoCorrect={false} style={styles.textField}/>{value ? <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${placeholder}`} hitSlop={8} onPress={() => onChangeText('')}><Ionicons name="close-circle" size={20} color="#98A2B3" /></Pressable> : null}</View>
}
function CheckRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) { return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.checkRow}><View style={[styles.checkbox, value && styles.checkboxChecked]}>{value ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}</View><Text style={styles.checkLabel}>{label}</Text></Pressable> }
function SelectorRow({ label, selectedValues, onPress }: { label: string; selectedValues: string[]; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.selectorRow}><View style={styles.selectorCopy}><Text style={styles.selectorLabel}>{label}</Text>{selectedValues.length ? <View style={styles.chipRow}>{selectedValues.slice(0, 4).map((value) => <View key={value} style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{value}</Text></View>)}{selectedValues.length > 4 ? <Text style={styles.moreCount}>+{selectedValues.length - 4}</Text> : null}</View> : null}</View><Ionicons name="chevron-forward" size={23} color="#98A2B3" /></Pressable> }
function DateCell({ label, value, onPress, onClear }: { label: string; value: string; onPress: () => void; onClear: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={styles.dateCell}><View style={styles.dateCopy}><Text style={styles.dateLabel}>{label}</Text>{value ? <Text style={styles.dateValue}>{formatDate(value)}</Text> : null}</View>{value ? <Pressable accessibilityRole="button" accessibilityLabel={`Xóa ${label}`} hitSlop={8} onPress={(event) => { event.stopPropagation(); onClear() }}><Ionicons name="close-circle" size={20} color="#98A2B3" /></Pressable> : <Ionicons name="chevron-forward" size={20} color="#98A2B3" />}</Pressable> }

export function EquipmentFilterScreen({ items, value, onCancel, onApply }: { items: EquipmentListItem[]; value: EquipmentFilter; onCancel: () => void; onApply: (filter: EquipmentFilter) => void }) {
  const [draft, setDraft] = useState<EquipmentFilter>({ ...value, locations: [...value.locations], primaryUsers: [...value.primaryUsers], assignedUsers: [...value.assignedUsers], assignedTeams: [...value.assignedTeams], assignedVendors: [...value.assignedVendors], assignedCustomers: [...value.assignedCustomers] })
  const [picker, setPicker] = useState<PickerConfig | null>(null)
  const [dateTarget, setDateTarget] = useState<DateKey | null>(null)
  const [liveOptions,setLiveOptions]=useState<Record<EquipmentFilterPickerKey,string[]>>(EMPTY_LIVE_OPTIONS)
  const options = useMemo(() => uniqueEquipmentFilterValues(items), [items])

  useEffect(()=>{ let active=true; void Promise.all([listLocationPaths(),listPeople(),listTeams(),listParties('VENDOR'),listParties('CUSTOMER')]).then(([locations,people,teams,vendors,customers])=>{if(!active)return;setLiveOptions({locations:locations.map((item)=>item.path),primaryUsers:people.map((item)=>item.name),assignedUsers:people.map((item)=>item.name),assignedTeams:teams.map((item)=>item.name),assignedVendors:vendors.map((item)=>item.companyName),assignedCustomers:customers.map((item)=>item.companyName)})}).catch(()=>{ /* local equipment values remain as offline fallback */ }); return()=>{active=false} },[])

  function mergedValues(key:EquipmentFilterPickerKey) { return Array.from(new Set([...(options[key]||[]),...(liveOptions[key]||[])])) }
  function patch(next: Partial<EquipmentFilter>) { setDraft((current) => ({ ...current, ...next })) }
  function openPicker(key: EquipmentFilterPickerKey) { setPicker({ key, ...PICKERS[key] }) }
  function togglePickerValue(valueToToggle: string) { if (!picker) return; const selected = draft[picker.key]; patch({ [picker.key]: selected.includes(valueToToggle) ? selected.filter((value) => value !== valueToToggle) : [...selected, valueToToggle] }) }
  function onDateChange(event: DateTimePickerEvent, date?: Date) { if (Platform.OS === 'android') setDateTarget(null); if (event.type === 'dismissed' || !date || !dateTarget) return; patch({ [dateTarget]: toIsoDate(date) }) }

  if (picker) return <EquipmentFilterPickerScreen pickerKey={picker.key} title={picker.title} values={mergedValues(picker.key)} selected={draft[picker.key]} onToggle={togglePickerValue} onDone={() => setPicker(null)} />

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onCancel} hitSlop={8} style={styles.headerIcon}><Ionicons name="arrow-back" size={27} color="#101828" /></Pressable><Text style={styles.headerTitle}>Chọn bộ lọc</Text><Pressable accessibilityRole="button" onPress={() => setDraft(cloneEmptyFilter())} style={styles.resetHeaderButton}><Text style={styles.resetHeaderText}>XÓA</Text></Pressable></View>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.textFilters}><FilterTextField value={draft.name} placeholder="Tên thiết bị" onChangeText={(name) => patch({ name })} /><FilterTextField value={draft.model} placeholder="Mô hình thiết bị" onChangeText={(model) => patch({ model })} /><FilterTextField value={draft.barcode} placeholder="Mã thiết bị / mã vạch" onChangeText={(barcode) => patch({ barcode })} /><FilterTextField value={draft.area} placeholder="Khu vực thiết bị" onChangeText={(area) => patch({ area })} /><FilterTextField value={draft.category} placeholder="Danh mục thiết bị" onChangeText={(category) => patch({ category })} /></View>
      <Text style={styles.sectionCaption}>Bộ lọc bổ sung</Text><View style={styles.checkGroup}><CheckRow label="Đã lưu trữ" value={draft.archived} onChange={(archived) => patch({ archived })} /><CheckRow label="Chưa lưu trữ" value={draft.unarchived} onChange={(unarchived) => patch({ unarchived })} /><CheckRow label="Thiết bị được tạo bởi bạn" value={draft.createdByYou} onChange={(createdByYou) => patch({ createdByYou })} /></View>
      <View style={styles.selectorGroup}><SelectorRow label="Vị trí" selectedValues={draft.locations} onPress={() => openPicker('locations')} /><SelectorRow label="Người dùng chính" selectedValues={draft.primaryUsers} onPress={() => openPicker('primaryUsers')} /><Text style={styles.assignedHeading}>ĐƯỢC GIAO</Text><SelectorRow label="Người dùng được giao" selectedValues={draft.assignedUsers} onPress={() => openPicker('assignedUsers')} /><SelectorRow label="Nhóm được giao" selectedValues={draft.assignedTeams} onPress={() => openPicker('assignedTeams')} /><SelectorRow label="Nhà cung cấp được giao" selectedValues={draft.assignedVendors} onPress={() => openPicker('assignedVendors')} /><SelectorRow label="Khách hàng được giao" selectedValues={draft.assignedCustomers} onPress={() => openPicker('assignedCustomers')} /></View>
      <Text style={styles.dateSectionLabel}>Ngày tạo</Text><View style={styles.dateRow}><DateCell label="Bắt đầu" value={draft.createdStart} onPress={() => setDateTarget('createdStart')} onClear={() => patch({ createdStart: '' })} /><View style={styles.dateDivider} /><DateCell label="Kết thúc" value={draft.createdEnd} onPress={() => setDateTarget('createdEnd')} onClear={() => patch({ createdEnd: '' })} /></View>
      <Text style={styles.sessionNote}>Bộ lọc lấy danh mục live từ CMMS; nếu mất mạng sẽ giữ các giá trị có sẵn trong danh sách thiết bị.</Text>
    </ScrollView>
    <View style={styles.footer}><Pressable accessibilityRole="button" onPress={() => onApply(draft)} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}><Text style={styles.applyText}>Áp dụng bộ lọc</Text></Pressable></View>
    {dateTarget ? <DateTimePicker value={parseIsoDate(draft[dateTarget])} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} /> : null}
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F1FA' }, header: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' }, headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#101828' }, resetHeaderButton: { minWidth: 62, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }, resetHeaderText: { fontSize: 16, fontWeight: '700', color: '#344054' }, scroll: { flex: 1, backgroundColor: '#FFFFFF' }, scrollContent: { paddingBottom: 120 }, textFilters: { paddingHorizontal: 16, paddingTop: 24 }, textFieldWrap: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D0D5DD' }, textField: { flex: 1, minHeight: 62, fontSize: 18, color: '#101828' }, sectionCaption: { paddingHorizontal: 48, paddingTop: 25, paddingBottom: 8, fontSize: 14.5, color: '#667085' }, checkGroup: { paddingHorizontal: 30, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, checkRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: 12 }, checkbox: { width: 22, height: 22, borderRadius: 3, borderWidth: 2, borderColor: '#98A2B3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, checkboxChecked: { borderColor: '#155EEF', backgroundColor: '#155EEF' }, checkLabel: { flex: 1, fontSize: 17, lineHeight: 22, color: '#1D2939' }, selectorGroup: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, selectorRow: { minHeight: 68, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' }, selectorCopy: { flex: 1, minWidth: 0 }, selectorLabel: { fontSize: 17, color: '#1D2939' }, chipRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }, chip: { maxWidth: 130, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#E9EDFF' }, chipText: { fontSize: 11, fontWeight: '800', color: '#344054' }, moreCount: { fontSize: 11.5, fontWeight: '900', color: '#155EEF' }, assignedHeading: { paddingHorizontal: 30, paddingTop: 18, paddingBottom: 7, fontSize: 12, fontWeight: '900', letterSpacing: .7, color: '#98A2B3', backgroundColor: '#FFFFFF' }, dateSectionLabel: { paddingHorizontal: 48, paddingTop: 18, paddingBottom: 8, fontSize: 14.5, color: '#667085' }, dateRow: { minHeight: 75, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' }, dateCell: { flex: 1, minWidth: 0, paddingHorizontal: 30, flexDirection: 'row', alignItems: 'center' }, dateDivider: { width: StyleSheet.hairlineWidth, backgroundColor: '#D0D5DD' }, dateCopy: { flex: 1, minWidth: 0 }, dateLabel: { fontSize: 16, color: '#667085' }, dateValue: { marginTop: 4, fontSize: 13, fontWeight: '800', color: '#101828' }, sessionNote: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 14, fontSize: 11.5, lineHeight: 17, color: '#667085', backgroundColor: '#F9FAFB' }, footer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0', backgroundColor: '#FFFFFF' }, applyButton: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' }, applyText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' }, pressed: { opacity: 0.82 },
})
