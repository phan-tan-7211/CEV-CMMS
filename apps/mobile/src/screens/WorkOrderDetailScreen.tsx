import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getWorkOrderDetailSnapshot,
  revalidateWorkOrderDetail,
  subscribeWorkOrderDetail,
  type WorkOrderDetail,
} from '../features/work-orders'

function displayStatus(status: string) {
  const normalized = status.trim().toUpperCase()
  if (normalized === 'OPEN') return 'Mở'
  if (normalized === 'IN_PROGRESS') return 'Đang thực hiện'
  if (normalized === 'ON_HOLD') return 'Tạm dừng'
  if (normalized === 'COMPLETED') return 'Hoàn thành'
  if (normalized === 'VERIFIED') return 'Đã xác nhận'
  return status || '—'
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function WorkOrderDetailScreen({ workOrderId, onBack }: { workOrderId: string; onBack: () => void }) {
  const [item, setItem] = useState<WorkOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeWorkOrderDetail(workOrderId, (next) => { if (mounted) setItem(next) })
    void getWorkOrderDetailSnapshot(workOrderId)
      .then((snapshot) => {
        if (!mounted) return
        if (snapshot) setItem(snapshot)
        setLoading(!snapshot)
        return revalidateWorkOrderDetail(workOrderId)
      })
      .then((next) => { if (mounted && next) setItem(next) })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false; unsubscribe() }
  }, [workOrderId])

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable>
        <Text style={styles.title}>Chi tiết Work Order</Text>
        <View style={styles.iconButton} />
      </View>

      {loading && !item ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.muted}>Đang tải...</Text></View>
      ) : item ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.id}>{item.workOrderId}</Text>
            <Text style={styles.reason}>{item.reason || 'Không có nội dung'}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{displayStatus(item.status)}</Text></View>
          </View>

          <Section title="THIẾT BỊ">
            <Row label="Mã thiết bị" value={item.equipmentId || '—'} />
            <Row label="Tên thiết bị" value={item.equipmentName || '—'} />
            <Row label="Model" value={item.equipmentModel || '—'} last />
          </Section>

          <Section title="THÔNG TIN CÔNG VIỆC">
            <Row label="Trạng thái" value={displayStatus(item.status)} />
            <Row label="Ưu tiên" value={item.priority || '—'} />
            <Row label="Nguồn" value={item.sourceType || '—'} />
            <Row label="Mã nguồn" value={item.sourceId || '—'} />
            <Row label="Người tạo / thực hiện" value={item.createdBy || '—'} last />
          </Section>

          <Section title="THỜI GIAN">
            <Row label="Tạo lúc" value={formatDate(item.createdAt)} />
            <Row label="Cập nhật" value={formatDate(item.updatedAt)} last />
          </Section>

          {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        </ScrollView>
      ) : (
        <View style={styles.center}><Ionicons name="alert-circle-outline" size={38} color="#98A2B3" /><Text style={styles.emptyTitle}>Không tìm thấy Work Order</Text>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>
      )}
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionLabel}>{title}</Text><View style={styles.card}>{children}</View></View>
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.row, last && styles.lastRow]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: '#101828' },
  content: { paddingBottom: 28 },
  hero: { padding: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  id: { fontSize: 13, fontWeight: '900', color: '#155EEF' },
  reason: { marginTop: 8, fontSize: 21, lineHeight: 27, fontWeight: '900', color: '#101828' },
  badge: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F2F4F7' },
  badgeText: { fontSize: 11.5, fontWeight: '900', color: '#344054' },
  section: { marginTop: 16 },
  sectionLabel: { marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  card: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  row: { minHeight: 58, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { width: 125, fontSize: 13, fontWeight: '700', color: '#667085' },
  rowValue: { flex: 1, textAlign: 'right', fontSize: 13.5, lineHeight: 19, fontWeight: '700', color: '#1D2939' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  muted: { marginTop: 8, fontSize: 12.5, color: '#667085' },
  emptyTitle: { marginTop: 10, marginBottom: 5, fontSize: 15, fontWeight: '900', color: '#344054' },
  errorBox: { margin: 16, padding: 12, borderRadius: 10, backgroundColor: '#FEF3F2' },
  errorText: { textAlign: 'center', fontSize: 12.5, color: '#B42318' },
})
