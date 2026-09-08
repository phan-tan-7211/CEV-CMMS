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

function labelForPriority(priority: string) {
  const normalized = priority.trim().toUpperCase()
  if (normalized === 'LOW') return 'Thấp'
  if (normalized === 'MEDIUM' || normalized === 'NORMAL') return 'Trung bình'
  if (normalized === 'HIGH') return 'Cao'
  if (normalized === 'URGENT' || normalized === 'CRITICAL') return 'Khẩn cấp'
  return priority || 'Không ưu tiên'
}

export function WorkOrdersScreen({ onBack, onOpenWorkOrder, equipmentId, scope }: { onBack: () => void; onOpenWorkOrder: (workOrderId: string) => void; equipmentId?: string; scope?: 'pending' | 'completed' }) {
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
      if (equipmentId && item.equipmentId !== equipmentId) return false
      if (scope === 'completed' && !['COMPLETED', 'VERIFIED'].includes(item.status.trim().toUpperCase())) return false
      if (scope === 'pending' && ['COMPLETED', 'VERIFIED'].includes(item.status.trim().toUpperCase())) return false
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false
      if (!keyword) return true
      return [item.workOrderId, item.equipmentId, item.equipmentName, item.reason, item.createdBy]
        .some((value) => value.toLocaleLowerCase('vi').includes(keyword))
    })
  }, [equipmentId, items, query, scope, selectedStatus])

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
        <Pressable onPress={() => { setSelectedStatus('ALL'); setQuery('') }} hitSlop={8} style={styles.headerAction}>
          <Ionicons name="options-outline" size={22} color="#667085" />
        </Pressable>
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
          <Text style={styles.counter}>{filtered.length} lệnh công việc</Text>
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
                <View style={styles.cardHeading}>
                  <View style={styles.statusDot} />
                  <Text style={styles.workOrderId}>{item.workOrderId}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#98A2B3" />
              </View>
              <Text style={styles.reason} numberOfLines={2}>{item.reason || 'Không có nội dung'}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.statusBadge}><Text style={styles.statusText}>{labelForStatus(item.status)}</Text></View>
                <View style={styles.priorityBadge}><Text style={styles.priorityText}>{labelForPriority(item.priority || '')}</Text></View>
              </View>
              <View style={styles.metaRow}><Ionicons name="cube-outline" size={15} color="#667085" /><Text style={styles.meta} numberOfLines={1}>{item.equipmentName || item.equipmentId || 'Chưa gắn thiết bị'}</Text></View>
              <View style={styles.footerRow}>
                <Text style={styles.secondary}>{item.equipmentId || '—'}</Text>
                <Text style={styles.secondary}>{formatDate(item.createdAt)}</Text>
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
  safeArea: { flex: 1, backgroundColor: '#F1F1FA' },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EF', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#101828' },
  searchWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 9, backgroundColor: '#FFFFFF' },
  searchBox: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#D7D8E5', borderRadius: 23, backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: '#101828' },
  filters: { paddingTop: 11, paddingBottom: 5, gap: 8 },
  filterPill: { minHeight: 35, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#D9DAE7', backgroundColor: '#FFFFFF' },
  filterPillActive: { borderColor: '#536DFE', backgroundColor: '#536DFE' },
  filterText: { fontSize: 12.5, fontWeight: '700', color: '#475467' },
  filterTextActive: { color: '#FFFFFF' },
  counterRow: { minHeight: 28, paddingTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { fontSize: 12, fontWeight: '800', color: '#667085' },
  reset: { fontSize: 12, fontWeight: '800', color: '#155EEF' },
  errorBox: { margin: 14, padding: 12, borderRadius: 10, backgroundColor: '#FEF3F2' },
  errorText: { fontSize: 12.5, color: '#B42318' },
  listContent: { padding: 14, paddingBottom: 28, gap: 11 },
  emptyContent: { flexGrow: 1 },
  card: { padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E1EA', backgroundColor: '#FFFFFF', shadowColor: '#28324D', shadowOpacity: 0.04, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  cardPressed: { backgroundColor: '#F9FAFB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#536DFE' },
  workOrderId: { flex: 1, fontSize: 13, fontWeight: '900', color: '#155EEF' },
  badgeRow: { marginTop: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#E9F0FF' },
  statusText: { fontSize: 10.5, fontWeight: '800', color: '#344054' },
  priorityBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#FFF4E5' },
  priorityText: { fontSize: 10.5, fontWeight: '800', color: '#9A6700' },
  reason: { marginTop: 10, fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#1D2939' },
  metaRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flex: 1, fontSize: 12.5, color: '#475467' },
  footerRow: { marginTop: 10, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  secondary: { flex: 1, fontSize: 11.5, color: '#98A2B3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { marginTop: 10, marginBottom: 4, fontSize: 15, fontWeight: '900', color: '#344054' },
  muted: { marginTop: 8, textAlign: 'center', fontSize: 12.5, color: '#667085' },
})
