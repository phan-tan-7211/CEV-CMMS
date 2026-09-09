import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { saveSparePart } from '../features/scan/api/partSearchService'

export function PartFormScreen({ onBack, partId = '', onSaved }: { onBack: () => void; partId?: string; onSaved: (partId: string) => void }) {
  const [form, setForm] = useState({ partName: '', barcode: '', partNumber: '', maker: '', location: '', stockQty: '0', minQty: '0' })
  const [saving, setSaving] = useState(false)

  function patch(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
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
      const part = await saveSparePart({ partId, ...form, stockQty, minQty })
      Alert.alert('Đã lưu phụ tùng', part.partId, [{ text: 'Mở chi tiết', onPress: () => onSaved(part.partId) }])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vui lòng thử lại.'
      Alert.alert('Không thể lưu phụ tùng', message.includes('INITIAL_STOCK_LOCATION_REQUIRED') ? 'Cần nhập vị trí kho khi tồn đầu kỳ lớn hơn 0.' : message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable>
        <Text style={styles.title}>{partId ? 'Sửa phụ tùng' : 'Thêm phụ tùng'}</Text>
        <View style={styles.icon} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!partId ? (
          <View style={styles.infoBox}>
            <Ionicons name="cube-outline" size={20} color="#175CD3" />
            <Text style={styles.infoText}>Tạo phụ tùng mới sẽ đồng thời mở mã trong kho CMMS. Nếu có tồn đầu kỳ, hệ thống ghi giao dịch vào sổ kho tự động.</Text>
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
  header: { minHeight: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF' },
  icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#101828' },
  content: { padding: 16 },
  infoBox: { marginBottom: 16, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: '#B2DDFF', backgroundColor: '#EFF8FF' },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#175CD3' },
  field: { marginBottom: 14 },
  label: { marginBottom: 7, fontSize: 13, fontWeight: '900', color: '#344054' },
  input: { minHeight: 48, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFF', fontSize: 15, color: '#101828' },
  two: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  helper: { marginTop: -3, fontSize: 11.5, lineHeight: 16, color: '#667085' },
  bottom: { padding: 16, backgroundColor: '#FFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  submit: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  disabled: { opacity: 0.45 },
  submitText: { fontSize: 16, fontWeight: '900', color: '#FFF' },
})
