import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getEquipmentListSnapshot,
  revalidateEquipmentList,
  type EquipmentListItem,
} from '../features/equipment'
import { getSparePart, saveSparePart } from '../features/scan/api/partSearchService'

const EMPTY_FORM = { partName: '', barcode: '', partNumber: '', maker: '', location: '', stockQty: '0', minQty: '0' }

function saveErrorMessage(message: string) {
  if (message.includes('SPARE_PART_BARCODE_DUPLICATE')) return 'Barcode này đã được sử dụng cho một phụ tùng khác.'
  if (message.includes('SPARE_PART_NUMBER_DUPLICATE') || message.includes('CMMS_PART_NUMBER_DUPLICATE')) return 'Part number này đã được sử dụng cho một phụ tùng khác.'
  if (message.includes('INITIAL_STOCK_LOCATION_REQUIRED')) return 'Cần nhập vị trí kho khi tồn đầu kỳ lớn hơn 0.'
  return message
}

export function PartFormScreen({ onBack, partId = '', initialBarcode = '', onSaved }: { onBack: () => void; partId?: string; initialBarcode?: string; onSaved: (partId: string) => void }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, barcode: partId ? '' : initialBarcode.trim() }))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(partId))
  const [equipmentLoading, setEquipmentLoading] = useState(true)
  const [equipmentItems, setEquipmentItems] = useState<EquipmentListItem[]>([])
  const [equipmentIds, setEquipmentIds] = useState<string[]>([])
  const [equipmentQuery, setEquipmentQuery] = useState('')

  useEffect(() => {
    if (partId) return
    const barcode = initialBarcode.trim()
    if (!barcode) return
    setForm((current) => current.barcode ? current : { ...current, barcode })
  }, [initialBarcode, partId])

  useEffect(() => {
    let active = true
    void getEquipmentListSnapshot().then((snapshot) => {
      if (active && snapshot) setEquipmentItems(snapshot.filter((item) => !item.archived))
      return revalidateEquipmentList()
    }).then((items) => {
      if (active) setEquipmentItems(items.filter((item) => !item.archived))
    }).catch(() => undefined).finally(() => {
      if (active) setEquipmentLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!partId) return
    let active = true
    setLoading(true)
    void getSparePart(partId).then((part) => {
      if (!active) return
      setForm({
        partName: part.partName,
        barcode: part.barcode,
        partNumber: part.partNumber,
        maker: part.maker,
        location: part.location,
        stockQty: String(part.stockQty),
        minQty: String(part.minQty),
      })
      setEquipmentIds(part.equipment.map((item) => item.equipmentId))
    }).catch((error) => {
      if (active) Alert.alert('Không tải được phụ tùng', error instanceof Error ? error.message : 'Vui lòng thử lại.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [partId])

  const selectedEquipment = useMemo(() => {
    const byId = new Map(equipmentItems.map((item) => [item.equipmentId, item]))
    return equipmentIds.map((id) => byId.get(id) || { equipmentId: id, equipmentName: id } as EquipmentListItem)
  }, [equipmentIds, equipmentItems])

  const equipmentResults = useMemo(() => {
    const query = equipmentQuery.trim().toLowerCase()
    if (!query) return []
    return equipmentItems.filter((item) => {
      if (equipmentIds.includes(item.equipmentId)) return false
      return [item.equipmentId, item.equipmentName, item.model, item.manufacturer, item.area, item.line]
        .some((value) => String(value || '').toLowerCase().includes(query))
    }).slice(0, 8)
  }, [equipmentIds, equipmentItems, equipmentQuery])

  function patch(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addEquipment(equipmentId: string) {
    setEquipmentIds((current) => current.includes(equipmentId) ? current : [...current, equipmentId])
    setEquipmentQuery('')
  }

  function removeEquipment(equipmentId: string) {
    setEquipmentIds((current) => current.filter((value) => value !== equipmentId))
  }

  async function submit() {
    if (!form.partName.trim() || saving) return
    const stockQty = Number(form.stockQty || 0)
    const minQty = Number(form.minQty || 0)
    if (!Number.isFinite(stockQty) || stockQty < 0 || !Number.isFinite(minQty) || minQty < 0) {
      Alert.alert('Kiểm tra số lượng', 'Tồn đầu kỳ và mức tối thiểu phải là số từ 0 trở lên.')
      return
    }
    if (!partId && stockQty > 0 && !form.location.trim()) {
      Alert.alert('Thiếu vị trí kho', 'Nhập vị trí kho để ghi nhận tồn đầu kỳ vào sổ kho.')
      return
    }

    setSaving(true)
    try {
      const part = await saveSparePart({ partId, ...form, stockQty, minQty, equipmentIds })
      Alert.alert('Đã lưu phụ tùng', part.partId, [{ text: 'Mở chi tiết', onPress: () => onSaved(part.partId) }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vui lòng thử lại.'
      Alert.alert('Không thể lưu phụ tùng', saveErrorMessage(message))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}><View style={styles.loading}><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.loadingText}>Đang tải phụ tùng...</Text></View></SafeAreaView>
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable>
        <Text style={styles.title}>{partId ? 'Sửa phụ tùng' : 'Thêm phụ tùng'}</Text>
        <View style={styles.icon} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {!partId ? (
          <View style={styles.infoBox}>
            <Ionicons name="cube-outline" size={20} color="#175CD3" />
            <Text style={styles.infoText}>{initialBarcode.trim() ? `Barcode “${initialBarcode.trim()}” đã được điền từ mã vừa quét. ` : ''}Tạo phụ tùng mới sẽ đồng thời mở mã trong kho CMMS. Nếu có tồn đầu kỳ, hệ thống ghi giao dịch vào sổ kho tự động.</Text>
          </View>
        ) : null}
        <Field label="Tên phụ tùng *" value={form.partName} onChange={(value) => patch('partName', value)} />
        <Field label="Barcode" value={form.barcode} onChange={(value) => patch('barcode', value)} />
        <Field label="Part number" value={form.partNumber} onChange={(value) => patch('partNumber', value)} />
        <Field label="Nhà sản xuất" value={form.maker} onChange={(value) => patch('maker', value)} />
        <Field label={partId ? 'Vị trí kho' : 'Vị trí kho (bắt buộc nếu có tồn đầu kỳ)'} value={form.location} onChange={(value) => patch('location', value)} />
        <View style={styles.two}>
          <View style={styles.flex}><Field label={partId ? 'Tồn kho' : 'Tồn đầu kỳ'} value={form.stockQty} onChange={(value) => patch('stockQty', value)} keyboard="numeric" /></View>
          <View style={styles.flex}><Field label="Tối thiểu" value={form.minQty} onChange={(value) => patch('minQty', value)} keyboard="numeric" /></View>
        </View>
        {!partId ? <Text style={styles.helper}>Tồn đầu kỳ chỉ được ghi một lần khi mã phụ tùng lần đầu đi vào ledger CMMS.</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>Thiết bị sử dụng phụ tùng</Text><Text style={styles.sectionHint}>Có thể chọn nhiều thiết bị</Text></View>
            <View style={styles.countBadge}><Text style={styles.countText}>{equipmentIds.length}</Text></View>
          </View>
          {selectedEquipment.map((item) => (
            <View key={item.equipmentId} style={styles.selectedRow}>
              <Ionicons name="construct-outline" size={18} color="#155EEF" />
              <View style={styles.selectedCopy}><Text style={styles.selectedName}>{item.equipmentName || item.equipmentId}</Text><Text style={styles.selectedId}>{item.equipmentId}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Bỏ thiết bị ${item.equipmentName || item.equipmentId}`} onPress={() => removeEquipment(item.equipmentId)} style={styles.removeButton}><Ionicons name="close" size={19} color="#B42318" /></Pressable>
            </View>
          ))}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#667085" />
            <TextInput value={equipmentQuery} onChangeText={setEquipmentQuery} placeholder="Tìm theo mã hoặc tên thiết bị" placeholderTextColor="#98A2B3" style={styles.searchInput} />
            {equipmentLoading ? <ActivityIndicator size="small" color="#155EEF" /> : null}
          </View>
          {equipmentResults.map((item) => (
            <Pressable key={item.equipmentId} onPress={() => addEquipment(item.equipmentId)} style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}>
              <View style={styles.resultIcon}><Ionicons name="add" size={20} color="#155EEF" /></View>
              <View style={styles.resultCopy}><Text style={styles.resultName}>{item.equipmentName || item.equipmentId}</Text><Text style={styles.resultMeta}>{item.equipmentId}{item.area ? ` · ${item.area}` : ''}{item.line ? ` · ${item.line}` : ''}</Text></View>
            </Pressable>
          ))}
          {equipmentQuery.trim() && !equipmentLoading && equipmentResults.length === 0 ? <Text style={styles.noResult}>Không tìm thấy thiết bị phù hợp.</Text> : null}
        </View>
      </ScrollView>
      <View style={styles.bottom}>
        <Pressable disabled={!form.partName.trim() || saving} onPress={() => void submit()} style={[styles.submit, (!form.partName.trim() || saving) && styles.disabled]}>
          {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Lưu phụ tùng</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

function Field({ label, value, onChange, keyboard }: { label: string; value: string; onChange: (value: string) => void; keyboard?: 'numeric' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChange} keyboardType={keyboard} style={styles.input} /></View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F9FB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#667085' },
  header: { minHeight: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF' },
  icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#101828' },
  content: { padding: 16, paddingBottom: 30 },
  infoBox: { marginBottom: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: '#B2DDFF', backgroundColor: '#EFF8FF' },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#175CD3' },
  field: { marginBottom: 14 },
  label: { marginBottom: 7, fontSize: 13, fontWeight: '900', color: '#344054' },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFF', fontSize: 15, color: '#101828' },
  two: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  helper: { marginTop: -3, fontSize: 11.5, lineHeight: 16, color: '#667085' },
  section: { marginTop: 20, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFF' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#344054' },
  sectionHint: { marginTop: 2, fontSize: 11, color: '#667085' },
  countBadge: { minWidth: 28, height: 28, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#E9F0FF' },
  countText: { fontSize: 12, fontWeight: '900', color: '#155EEF' },
  selectedRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  selectedCopy: { flex: 1, minWidth: 0 },
  selectedName: { fontSize: 13, fontWeight: '800', color: '#344054' },
  selectedId: { marginTop: 2, fontSize: 10.5, color: '#667085' },
  removeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  searchBox: { minHeight: 48, marginTop: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFF' },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: '#101828' },
  resultRow: { minHeight: 58, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  resultIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#EFF4FF' },
  resultCopy: { flex: 1, minWidth: 0 },
  resultName: { fontSize: 13, fontWeight: '800', color: '#344054' },
  resultMeta: { marginTop: 2, fontSize: 10.5, color: '#667085' },
  noResult: { paddingVertical: 14, textAlign: 'center', fontSize: 11.5, color: '#667085' },
  pressed: { opacity: 0.72 },
  bottom: { padding: 16, backgroundColor: '#FFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  submit: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  disabled: { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
})
