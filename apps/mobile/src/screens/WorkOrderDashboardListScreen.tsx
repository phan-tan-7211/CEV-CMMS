import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getWorkOrderListSnapshot,
  listBookmarkedWorkOrderIds,
  revalidateWorkOrderList,
  setWorkOrderBookmarked,
  subscribeWorkOrderList,
  type WorkOrderListItem,
} from '../features/work-orders'
import type { WorkOrderDashboardFilter } from './WorkOrderDashboardScreen'

function normalized(value: string) { return String(value || '').trim().toUpperCase() }
function dayKey(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
function titleFor(filter: WorkOrderDashboardFilter) {
  return ({ all: 'Tất cả Work Order', open: 'Đang mở', 'in-progress': 'Đang thực hiện', 'due-today': 'Đến hạn hôm nay', 'high-priority': 'Ưu tiên cao', overdue: 'Quá hạn', completed: 'Hoàn thành', pm: 'Bảo trì định kỳ' } as const)[filter]
}
function statusLabel(value: string) {
  const v = normalized(value)
  if (v === 'OPEN') return 'Mở'
  if (v === 'WAITING_APPROVAL') return 'Chờ duyệt'
  if (v === 'APPROVED') return 'Đã duyệt'
  if (v === 'IN_PROGRESS') return 'Đang thực hiện'
  if (v === 'COMPLETED') return 'Hoàn thành'
  if (v === 'VERIFIED') return 'Đã xác nhận'
  if (v === 'RELEASED') return 'Đã bàn giao'
  return value || '—'
}

export function WorkOrderDashboardListScreen({ filter, onBack, onOpenWorkOrder }: { filter: WorkOrderDashboardFilter; onBack: () => void; onOpenWorkOrder: (id: string) => void }) {
  const [items, setItems] = useState<WorkOrderListItem[]>([])
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [bookmarkSavingId, setBookmarkSavingId] = useState('')
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeWorkOrderList((next) => { if (mounted) setItems(next) })
    void Promise.all([getWorkOrderListSnapshot(), listBookmarkedWorkOrderIds()]).then(([snapshot, bookmarks]) => {
      if (!mounted) return
      if (snapshot) setItems(snapshot)
      setBookmarkedIds(new Set(bookmarks))
      setLoading(!snapshot)
      return revalidateWorkOrderList()
    }).then((next) => { if (mounted && next) setItems(next) })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false; unsubscribe() }
  }, [])

  const filtered = useMemo(() => {
    const today = dayKey(new Date().toISOString())
    return items.filter((item) => {
      if (bookmarkedOnly && !bookmarkedIds.has(item.workOrderId)) return false
      const status = normalized(item.status)
      const active = !['COMPLETED', 'VERIFIED', 'RELEASED', 'CANCELLED'].includes(status)
      if (filter === 'all') return true
      if (filter === 'open') return status === 'OPEN'
      if (filter === 'in-progress') return status === 'IN_PROGRESS'
      if (filter === 'completed') return ['COMPLETED', 'VERIFIED', 'RELEASED'].includes(status)
      if (filter === 'pm') return normalized(item.sourceType) === 'PREVENTIVE_MAINTENANCE'
      if (filter === 'high-priority') return active && ['HIGH', 'URGENT', 'CRITICAL'].includes(normalized(item.priority))
      if (filter === 'due-today') return active && dayKey(item.dueDate) === today
      if (filter === 'overdue') return active && Boolean(item.dueDate) && new Date(item.dueDate).getTime() < Date.now() && dayKey(item.dueDate) !== today
      return true
    })
  }, [bookmarkedIds, bookmarkedOnly, filter, items])

  async function refresh() {
    setRefreshing(true); setError('')
    try {
      const [next, bookmarks] = await Promise.all([revalidateWorkOrderList({ force: true }), listBookmarkedWorkOrderIds()])
      setItems(next)
      setBookmarkedIds(new Set(bookmarks))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.') }
    finally { setRefreshing(false) }
  }

  async function toggleBookmark(workOrderId: string) {
    if (bookmarkSavingId) return
    const nextBookmarked = !bookmarkedIds.has(workOrderId)
    setBookmarkSavingId(workOrderId)
    setError('')
    setBookmarkedIds((current) => {
      const next = new Set(current)
      if (nextBookmarked) next.add(workOrderId)
      else next.delete(workOrderId)
      return next
    })
    try {
      await setWorkOrderBookmarked(workOrderId, nextBookmarked)
    } catch (reason) {
      setBookmarkedIds((current) => {
        const next = new Set(current)
        if (nextBookmarked) next.delete(workOrderId)
        else next.add(workOrderId)
        return next
      })
      setError(reason instanceof Error ? reason.message : 'Không lưu được Work Order ngoại tuyến.')
    } finally { setBookmarkSavingId('') }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>{titleFor(filter)}</Text><Text style={styles.subtitle}>{filtered.length} Work Order</Text></View>
        <Pressable onPress={() => setBookmarkedOnly((value) => !value)} style={[styles.savedFilterButton, bookmarkedOnly && styles.savedFilterButtonActive]} accessibilityRole="button" accessibilityLabel="Lọc Work Order đã lưu ngoại tuyến">
          <Ionicons name={bookmarkedOnly ? 'bookmark' : 'bookmark-outline'} size={20} color={bookmarkedOnly ? '#FFFFFF' : '#155EEF'} />
        </Pressable>
      </View>
      <View style={styles.offlineHint}><Ionicons name="cloud-offline-outline" size={16} color="#175CD3" /><Text style={styles.offlineHintText}>{bookmarkedOnly ? 'Đang chỉ hiển thị Work Order đã lưu ngoại tuyến' : 'Nhấn biểu tượng đánh dấu ở từng Work Order để lưu dùng khi mất mạng'}</Text></View>
      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
      {loading && items.length === 0 ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View> : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.workOrderId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#155EEF" />}
          contentContainerStyle={filtered.length ? styles.list : styles.emptyList}
          renderItem={({ item }) => {
            const bookmarked = bookmarkedIds.has(item.workOrderId)
            return (
              <View style={styles.card}>
                <Pressable onPress={() => onOpenWorkOrder(item.workOrderId)} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
                  <View style={styles.topRow}><Text style={styles.id}>{item.workOrderId}</Text><Ionicons name="chevron-forward" size={19} color="#98A2B3" /></View>
                  <Text style={styles.reason} numberOfLines={2}>{item.reason || 'Không có nội dung'}</Text>
                  <View style={styles.badges}>
                    <View style={styles.statusBadge}><Text style={styles.statusText}>{statusLabel(item.status)}</Text></View>
                    {item.priority ? <View style={styles.priorityBadge}><Text style={styles.priorityText}>{item.priority}</Text></View> : null}
                    {bookmarked ? <View style={styles.offlineBadge}><Ionicons name="cloud-offline-outline" size={12} color="#175CD3" /><Text style={styles.offlineBadgeText}>Đã lưu ngoại tuyến</Text></View> : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>{item.equipmentName || item.equipmentId || 'Chưa gắn thiết bị'}</Text>
                  {item.dueDate ? <Text style={styles.due}>Hạn: {new Date(item.dueDate).toLocaleDateString('vi-VN')}</Text> : null}
                </Pressable>
                <Pressable disabled={bookmarkSavingId === item.workOrderId} onPress={() => void toggleBookmark(item.workOrderId)} style={[styles.bookmarkButton, bookmarked && styles.bookmarkButtonActive]} accessibilityRole="button" accessibilityLabel={bookmarked ? `Bỏ lưu ngoại tuyến ${item.workOrderId}` : `Lưu ngoại tuyến ${item.workOrderId}`}>
                  <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={23} color={bookmarked ? '#155EEF' : '#667085'} />
                </Pressable>
              </View>
            )
          }}
          ListEmptyComponent={<View style={styles.center}><Ionicons name={bookmarkedOnly ? 'cloud-offline-outline' : 'checkmark-done-circle-outline'} size={42} color="#98A2B3" /><Text style={styles.emptyTitle}>{bookmarkedOnly ? 'Chưa có Work Order đã lưu ngoại tuyến' : 'Không có Work Order'}</Text><Text style={styles.emptyText}>{bookmarkedOnly ? 'Tắt bộ lọc hoặc đánh dấu một Work Order để lưu dùng khi mất mạng.' : 'Không có dữ liệu phù hợp với nhóm dashboard này.'}</Text></View>}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F1FA' },
  header: { minHeight: 64, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EF', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '900', color: '#101828' },
  subtitle: { marginTop: 2, fontSize: 11.5, color: '#667085' },
  savedFilterButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#EFF4FF' },
  savedFilterButtonActive: { backgroundColor: '#155EEF' },
  offlineHint: { minHeight: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF8FF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1E9FF' },
  offlineHintText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#175CD3' },
  errorBox: { margin: 14, padding: 12, borderRadius: 12, backgroundColor: '#FEF3F2' },
  errorText: { fontSize: 12.5, color: '#B42318' },
  list: { padding: 14, paddingBottom: 30, gap: 10 },
  emptyList: { flexGrow: 1 },
  card: { position: 'relative', borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E1EA', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  cardMain: { padding: 16, paddingRight: 58 },
  pressed: { opacity: 0.82 },
  bookmarkButton: { position: 'absolute', top: 8, right: 7, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  bookmarkButtonActive: { backgroundColor: '#EFF4FF' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  id: { flex: 1, fontSize: 13, fontWeight: '900', color: '#155EEF' },
  reason: { marginTop: 9, fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#1D2939' },
  badges: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#E9F0FF' },
  statusText: { fontSize: 10.5, fontWeight: '800', color: '#344054' },
  priorityBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#FFF4E5' },
  priorityText: { fontSize: 10.5, fontWeight: '800', color: '#9A6700' },
  offlineBadge: { paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, backgroundColor: '#EFF8FF' },
  offlineBadgeText: { fontSize: 10.5, fontWeight: '800', color: '#175CD3' },
  meta: { marginTop: 10, fontSize: 12.5, color: '#667085' },
  due: { marginTop: 4, fontSize: 11.5, fontWeight: '700', color: '#B54708' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { marginTop: 10, fontSize: 15, fontWeight: '900', color: '#344054' },
  emptyText: { marginTop: 5, textAlign: 'center', fontSize: 12.5, color: '#667085' },
})
