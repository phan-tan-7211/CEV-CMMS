import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { revalidateEquipmentList, type EquipmentListItem } from '../features/equipment'
import { listOeeMetrics, saveOeePeriod, type OeeMetric } from '../features/oee'

function pct(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`
}
function num(value: string) {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : NaN
}

export function OeeScreen({ onBack }: { onBack: () => void }) {
  const [metrics, setMetrics] = useState<OeeMetric[]>([])
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [equipmentQuery, setEquipmentQuery] = useState('')
  const [equipmentId, setEquipmentId] = useState('')
  const [shiftCode, setShiftCode] = useState('')
  const [durationHours, setDurationHours] = useState('8')
  const [plannedMinutes, setPlannedMinutes] = useState('450')
  const [idealCycleSeconds, setIdealCycleSeconds] = useState('60')
  const [totalCount, setTotalCount] = useState('0')
  const [goodCount, setGoodCount] = useState('0')
  const [note, setNote] = useState('')

  async function refresh() {
    setError('')
    try {
      const [nextMetrics, nextEquipment] = await Promise.all([
        listOeeMetrics(30),
        revalidateEquipmentList({ force: true }),
      ])
      setMetrics(nextMetrics)
      setEquipment(nextEquipment.filter((item) => !item.archived))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu OEE.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const equipmentMatches = useMemo(() => {
    const q = equipmentQuery.trim().toLowerCase()
    if (!q) return equipment.slice(0, 8)
    return equipment.filter((item) => `${item.equipmentId} ${item.equipmentName}`.toLowerCase().includes(q)).slice(0, 12)
  }, [equipment, equipmentQuery])

  async function handleSave() {
    const duration = num(durationHours)
    const planned = num(plannedMinutes)
    const cycle = num(idealCycleSeconds)
    const total = num(totalCount)
    const good = num(goodCount)
    if (!equipmentId) return Alert.alert('OEE', 'Chọn thiết bị trước khi lưu.')
    if (!Number.isFinite(duration) || duration <= 0) return Alert.alert('OEE', 'Thời lượng ca phải lớn hơn 0.')
    if (planned > duration * 60) return Alert.alert('OEE', 'Phút sản xuất kế hoạch không thể lớn hơn thời lượng ca.')

    const end = new Date()
    const start = new Date(end.getTime() - duration * 60 * 60 * 1000)
    setSaving(true)
    setError('')
    try {
      await saveOeePeriod({
        equipmentId,
        periodStartAt: start.toISOString(),
        periodEndAt: end.toISOString(),
        shiftCode,
        plannedProductionMinutes: planned,
        idealCycleSeconds: cycle,
        totalCount: total,
        goodCount: good,
        note,
      })
      setFormOpen(false)
      setShiftCode('')
      setTotalCount('0')
      setGoodCount('0')
      setNote('')
      setLoading(true)
      await refresh()
      Alert.alert('OEE', 'Đã lưu dữ liệu ca sản xuất.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được dữ liệu OEE.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={25} color="#101828" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Hiệu suất OEE</Text>
          <Text style={styles.subtitle}>Availability · Performance · Quality</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Làm mới OEE" onPress={() => { setLoading(true); void refresh() }} style={styles.iconButton}>
          <Ionicons name="refresh" size={22} color="#155EEF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>30 NGÀY GẦN NHẤT</Text>
            <Text style={styles.heroTitle}>OEE từ dữ liệu sản xuất thật</Text>
            <Text style={styles.heroBody}>Downtime được lấy tự động từ lịch sử dừng máy. Sản lượng và chu kỳ lấy từ dữ liệu ca.</Text>
          </View>
          <Pressable onPress={() => setFormOpen((current) => !current)} style={styles.primaryButton}>
            <Ionicons name={formOpen ? 'close' : 'add'} size={20} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{formOpen ? 'Đóng' : 'Ghi nhận ca'}</Text>
          </Pressable>
        </View>

        {formOpen ? <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Ca vừa kết thúc</Text>
          <Text style={styles.label}>Thiết bị</Text>
          <TextInput value={equipmentQuery} onChangeText={setEquipmentQuery} placeholder="Tìm mã hoặc tên thiết bị" style={styles.input} />
          <View style={styles.choiceList}>
            {equipmentMatches.map((item) => {
              const selected = item.equipmentId === equipmentId
              return <Pressable key={item.equipmentId} onPress={() => { setEquipmentId(item.equipmentId); setEquipmentQuery(`${item.equipmentId} · ${item.equipmentName}`) }} style={[styles.choiceRow, selected && styles.choiceRowSelected]}>
                <View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{item.equipmentName || item.equipmentId}</Text><Text style={styles.choiceMeta}>{item.equipmentId}</Text></View>
                {selected ? <Ionicons name="checkmark-circle" size={22} color="#155EEF" /> : null}
              </Pressable>
            })}
          </View>

          <View style={styles.twoColumns}>
            <View style={styles.field}><Text style={styles.label}>Mã ca</Text><TextInput value={shiftCode} onChangeText={setShiftCode} placeholder="VD: A" style={styles.input} /></View>
            <View style={styles.field}><Text style={styles.label}>Thời lượng ca (giờ)</Text><TextInput value={durationHours} onChangeText={setDurationHours} keyboardType="decimal-pad" style={styles.input} /></View>
          </View>
          <View style={styles.twoColumns}>
            <View style={styles.field}><Text style={styles.label}>Kế hoạch (phút)</Text><TextInput value={plannedMinutes} onChangeText={setPlannedMinutes} keyboardType="decimal-pad" style={styles.input} /></View>
            <View style={styles.field}><Text style={styles.label}>Chu kỳ lý tưởng (giây/sp)</Text><TextInput value={idealCycleSeconds} onChangeText={setIdealCycleSeconds} keyboardType="decimal-pad" style={styles.input} /></View>
          </View>
          <View style={styles.twoColumns}>
            <View style={styles.field}><Text style={styles.label}>Tổng sản lượng</Text><TextInput value={totalCount} onChangeText={setTotalCount} keyboardType="decimal-pad" style={styles.input} /></View>
            <View style={styles.field}><Text style={styles.label}>Sản lượng đạt</Text><TextInput value={goodCount} onChangeText={setGoodCount} keyboardType="decimal-pad" style={styles.input} /></View>
          </View>
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput value={note} onChangeText={setNote} placeholder="Ghi chú ca sản xuất" multiline style={[styles.input, styles.noteInput]} />
          <Pressable disabled={saving} onPress={() => void handleSave()} style={[styles.saveButton, saving && styles.disabled]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Lưu dữ liệu OEE</Text>}
          </Pressable>
        </View> : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? <ActivityIndicator size="large" color="#155EEF" style={styles.loader} /> : null}
        {!loading && metrics.length === 0 ? <View style={styles.emptyCard}><Ionicons name="analytics-outline" size={30} color="#667085" /><Text style={styles.emptyTitle}>Chưa có dữ liệu OEE</Text><Text style={styles.emptyBody}>Ghi nhận ca sản xuất đầu tiên để bắt đầu theo dõi OEE.</Text></View> : null}

        {metrics.map((item) => <View key={item.equipmentId} style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View style={styles.metricCopy}><Text style={styles.metricTitle}>{item.equipmentName || item.equipmentId}</Text><Text style={styles.metricMeta}>{item.equipmentId}{item.locationName ? ` · ${item.locationName}` : ''} · {item.periodCount} ca</Text></View>
            <View style={styles.oeeBadge}><Text style={styles.oeeBadgeLabel}>OEE</Text><Text style={styles.oeeBadgeValue}>{pct(item.oeePercent)}</Text></View>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}><Text style={styles.kpiLabel}>Availability</Text><Text style={styles.kpiValue}>{pct(item.availabilityPercent)}</Text></View>
            <View style={styles.kpi}><Text style={styles.kpiLabel}>Performance</Text><Text style={styles.kpiValue}>{pct(item.performancePercent)}</Text></View>
            <View style={styles.kpi}><Text style={styles.kpiLabel}>Quality</Text><Text style={styles.kpiValue}>{pct(item.qualityPercent)}</Text></View>
          </View>
          <View style={styles.detailsRow}><Text style={styles.detailText}>Kế hoạch {item.plannedProductionMinutes.toFixed(0)} phút</Text><Text style={styles.detailText}>Dừng {item.downtimeMinutes.toFixed(0)} phút</Text><Text style={styles.detailText}>{item.goodCount.toFixed(0)}/{item.totalCount.toFixed(0)} đạt</Text></View>
        </View>)}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 70, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: '900', color: '#101828' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#667085' },
  content: { padding: 14, gap: 12, paddingBottom: 34 },
  hero: { backgroundColor: '#EEF4FF', borderRadius: 18, padding: 16, gap: 14 },
  heroCopy: { gap: 5 },
  heroEyebrow: { fontSize: 11, fontWeight: '800', color: '#155EEF', letterSpacing: 0.8 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#101828' },
  heroBody: { fontSize: 13, lineHeight: 19, color: '#475467' },
  primaryButton: { alignSelf: 'flex-start', minHeight: 42, borderRadius: 11, backgroundColor: '#155EEF', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, gap: 10, borderWidth: 1, borderColor: '#EAECF0' },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#101828', marginBottom: 2 },
  label: { fontSize: 12, fontWeight: '700', color: '#475467' },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, color: '#101828', fontSize: 14 },
  noteInput: { minHeight: 76, paddingTop: 11, textAlignVertical: 'top' },
  choiceList: { gap: 6 },
  choiceRow: { minHeight: 50, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#F9FAFB', flexDirection: 'row', alignItems: 'center', gap: 8 },
  choiceRowSelected: { backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#B2CCFF' },
  choiceCopy: { flex: 1 },
  choiceTitle: { fontSize: 14, fontWeight: '800', color: '#101828' },
  choiceMeta: { marginTop: 2, fontSize: 12, color: '#667085' },
  twoColumns: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, gap: 6 },
  saveButton: { minHeight: 46, borderRadius: 11, backgroundColor: '#155EEF', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  disabled: { opacity: 0.55 },
  errorText: { color: '#B42318', backgroundColor: '#FEF3F2', borderRadius: 10, padding: 11, fontSize: 13, fontWeight: '600' },
  loader: { marginVertical: 28 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 28, alignItems: 'center', gap: 7, borderWidth: 1, borderColor: '#EAECF0' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#101828' },
  emptyBody: { textAlign: 'center', fontSize: 13, color: '#667085' },
  metricCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, gap: 14, borderWidth: 1, borderColor: '#EAECF0' },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricCopy: { flex: 1 },
  metricTitle: { fontSize: 16, fontWeight: '900', color: '#101828' },
  metricMeta: { marginTop: 3, fontSize: 12, color: '#667085' },
  oeeBadge: { minWidth: 76, borderRadius: 12, backgroundColor: '#ECFDF3', paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center' },
  oeeBadgeLabel: { fontSize: 10, fontWeight: '800', color: '#027A48' },
  oeeBadgeValue: { marginTop: 1, fontSize: 17, fontWeight: '900', color: '#027A48' },
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, minHeight: 62, borderRadius: 11, backgroundColor: '#F9FAFB', padding: 9, justifyContent: 'center' },
  kpiLabel: { fontSize: 10, color: '#667085', fontWeight: '700' },
  kpiValue: { marginTop: 4, fontSize: 16, color: '#101828', fontWeight: '900' },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailText: { fontSize: 11, color: '#475467', fontWeight: '600' },
})
