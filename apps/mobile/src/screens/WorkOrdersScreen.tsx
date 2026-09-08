import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getWorkOrderListSnapshot,
  revalidateWorkOrderList,
  subscribeWorkOrderList,
  type WorkOrderListItem,
} from '../features/work-orders'

function labelForStatus(status: string) {
  const normalized = status.trim().toUpperCase()
  if (normalized === 'OPEN') return 'Mở'
  if (normalized === 'IN_PROGRESS') return 'Đang thực hiện'
  if (normalized === 'ON_HOLD') return 'Tạm dừng'
  if (normalized === 'COMPLETED') return 'Hoàn thành'
  if (normalized === 'VERIFIED') return 'Đã xác nhận'
  return status || 'Chưa có trạng thái'
}

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function WorkOrdersScreen({ onBack, onOpenWorkOrder }: { onBack: () => void; onOpenWorkOrder: (workOrderId: string) => void }) {
  const [items, setItems] = useState<WorkOrderListItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeWorkOrderList((next) => { if (mounted) setItems(next) })
    void getWorkOrderListSnapshot().then((snapshot) => {
      if (!mounted) return
      if (snapshot) setItems(snapshot)
      setLoading(!snapshot)
      return revalidateWorkOrderList()
    }).then((next) => {
      if (mounted && next) setItems(next)
    }).catch((reason) => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.')
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false; unsubscribe() }
  }, [])

  const statuses = useMemo(() => Array.from(new Set(items.map((item) => item.status).filter(Boolean))).sort(), [items])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return items.filter((item) => {
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false
      if (!keyword) return true
      return [item.workOrderId, item.equipmentId, item.equipmentName, item.reason, item.createdBy]
        .some((value) => value.toLocaleLowerCase('vi').includes(keyword))
    })
  }, [items, query, selectedStatus])

  async function refresh() {
    setRefreshing(true)
    setError('')
    try {
      setItems(await revalidateWorkOrderList({ force: true }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable>
        <Text style={styles.title}>Công việc</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color="#98A2B3" />
          <TextInput value={query} onChangeText={setQuery} placeholder="Tìm mã WO, thiết bị, nội dung..." placeholderTextColor="#98A2B3" style={styles.searchInput} />
          {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color="#98A2B3" /></Pressable> : null}
        </View>
        <FlatList
          horizontal
          data={['ALL', ...statuses]}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          renderItem={({ item }) => {
            const active = selectedStatus === item
            return (
              <Pressable onPress={() => setSelectedStatus(item)} style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{item === 'ALL' ? 'Tất cả' : labelForStatus(item)}</Text>
              </Pressable>
            )
          }}
        />
        <View style={styles.counterRow}>
          <Text style={styles.counter}>{filtered.length} Work Order</Text>
          {selectedStatus !== 'ALL' || query ? <Pressable onPress={() => { setSelectedStatus('ALL'); setQuery('') }}><Text style={styles.reset}>Đặt lại tất cả</Text></Pressable> : null}
        </View>
      </View>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.muted}>Đang tải Work Order...</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.workOrderId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh() }} tintColor="#155EEF" />}
          contentContainerStyle={filtered.length ? styles.listContent : styles.emptyContent}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenWorkOrder(item.workOrderId)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.cardTop}>
                <Text style={styles.workOrderId}>{item.workOrderId}</Text>
                <View style={styles.statusBadge}><Text style={styles.statusText}>{labelForStatus(item.status)}</Text></View>
              </View>
              <Text style={styles.reason} numberOfLines={2}>{item.reason || 'Không có nội dung'}</Text>
              <View style={styles.metaRow}><Ionicons name="cube-outline" size={15} color="#667085" /><Text style={styles.meta} numberOfLines={1}>{item.equipmentName || item.equipmentId || 'Chưa gắn thiết bị'}</Text></View>
              <View style={styles.footerRow}>
                <Text style={styles.secondary}>{item.equipmentId || '—'}</Text>
                <Text style={styles.secondary}>{formatDate(item.createdAt)}</Text>
                <Ionicons name="chevron-forward" size={19} color="#B0B7C3" />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<View style={styles.center}><Ionicons name="clipboard-outline" size={38} color="#98A2B3" /><Text style={styles.emptyTitle}>Không có Work Order phù hợp</Text><Text style={styles.muted}>Thử điều chỉnh tìm kiếm hoặc bộ lọc.</Text></View>}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '900', color: '#101828' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 9, backgroundColor: '#FFFFFF' },
  searchBox: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: '#101828' },
  filters: { paddingTop: 10, paddingBottom: 4, gap: 7 },
  filterPill: { minHeight: 34, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#F2F4F7' },
  filterPillActive: { backgroundColor: '#101828' },
  filterText: { fontSize: 12.5, fontWeight: '700', color: '#475467' },
  filterTextActive: { color: '#FFFFFF' },
  counterRow: { minHeight: 28, paddingTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontSize: 12, fontWeight: '800', color: '#667085' },
  reset: { fontSize: 12, fontWeight: '800', color: '#155EEF' },
  errorBox: { margin: 14, padding: 12, borderRadius: 10, backgroundColor: '#FEF3F2' },
  errorText: { fontSize: 12.5, color: '#B42318' },
  listContent: { padding: 12, paddingBottom: 24, gap: 9 },
  emptyContent: { flexGrow: 1 },
  card: { padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE1E7', backgroundColor: '#FFFFFF' },
  cardPressed: { backgroundColor: '#F9FAFB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  workOrderId: { flex: 1, fontSize: 13, fontWeight: '900', color: '#155EEF' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#F2F4F7' },
  statusText: { fontSize: 10.5, fontWeight: '800', color: '#344054' },
  reason: { marginTop: 9, fontSize: 15, lineHeight: 20, fontWeight: '800', color: '#1D2939' },
  metaRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, fontSize: 12.5, color: '#475467' },
  footerRow: { marginTop: 10, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  secondary: { flex: 1, fontSize: 11.5, color: '#98A2B3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { marginTop: 10, marginBottom: 4, fontSize: 15, fontWeight: '900', color: '#344054' },
  muted: { marginTop: 8, textAlign: 'center', fontSize: 12.5, color: '#667085' },
})
