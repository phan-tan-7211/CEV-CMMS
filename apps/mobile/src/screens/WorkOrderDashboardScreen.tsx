import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getWorkOrderListSnapshot,
  revalidateWorkOrderList,
  subscribeWorkOrderList,
  type WorkOrderListItem,
} from '../features/work-orders'

export type WorkOrderDashboardFilter = 'all' | 'open' | 'in-progress' | 'due-today' | 'high-priority' | 'overdue' | 'completed' | 'pm'

function normalized(value: string) { return String(value || '').trim().toUpperCase() }
function dayKey(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function WorkOrderDashboardScreen({
  onBack,
  onOpenList,
}: {
  onBack: () => void
  onOpenList: (filter: WorkOrderDashboardFilter) => void
}) {
  const [items, setItems] = useState<WorkOrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [visibleFilters, setVisibleFilters] = useState<WorkOrderDashboardFilter[]>(['due-today', 'high-priority', 'overdue', 'open', 'in-progress', 'pm', 'completed', 'all'])

  useEffect(() => {
    let mounted = true
    const unsubscribe = subscribeWorkOrderList((next) => { if (mounted) setItems(next) })
    void getWorkOrderListSnapshot().then((snapshot) => {
      if (!mounted) return
      if (snapshot) setItems(snapshot)
      setLoading(!snapshot)
      return revalidateWorkOrderList()
    }).then((next) => { if (mounted && next) setItems(next) })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false; unsubscribe() }
  }, [])

  const stats = useMemo(() => {
    const today = dayKey(new Date().toISOString())
    const active = items.filter((item) => !['COMPLETED', 'VERIFIED', 'RELEASED', 'CANCELLED'].includes(normalized(item.status)))
    return {
      all: items.length,
      open: items.filter((item) => normalized(item.status) === 'OPEN').length,
      inProgress: items.filter((item) => normalized(item.status) === 'IN_PROGRESS').length,
      dueToday: active.filter((item) => dayKey(item.dueDate) === today).length,
      highPriority: active.filter((item) => ['HIGH', 'URGENT', 'CRITICAL'].includes(normalized(item.priority))).length,
      overdue: active.filter((item) => item.dueDate && new Date(item.dueDate).getTime() < Date.now() && dayKey(item.dueDate) !== today).length,
      completed: items.filter((item) => ['COMPLETED', 'VERIFIED', 'RELEASED'].includes(normalized(item.status))).length,
      pm: items.filter((item) => normalized(item.sourceType) === 'PREVENTIVE_MAINTENANCE').length,
    }
  }, [items])

  async function refresh() {
    setRefreshing(true); setError('')
    try { setItems(await revalidateWorkOrderList({ force: true })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.') }
    finally { setRefreshing(false) }
  }

  const cards: Array<{ filter: WorkOrderDashboardFilter; label: string; count: number; icon: keyof typeof Ionicons.glyphMap; hint: string }> = [
    { filter: 'due-today', label: 'Đến hạn hôm nay', count: stats.dueToday, icon: 'today-outline', hint: 'Công việc cần xử lý trong ngày' },
    { filter: 'high-priority', label: 'Ưu tiên cao', count: stats.highPriority, icon: 'warning-outline', hint: 'High · Urgent · Critical' },
    { filter: 'overdue', label: 'Quá hạn', count: stats.overdue, icon: 'time-outline', hint: 'Chưa hoàn thành và đã quá hạn' },
    { filter: 'open', label: 'Đang mở', count: stats.open, icon: 'folder-open-outline', hint: 'Work Order trạng thái OPEN' },
    { filter: 'in-progress', label: 'Đang thực hiện', count: stats.inProgress, icon: 'construct-outline', hint: 'Kỹ thuật viên đang xử lý' },
    { filter: 'pm', label: 'Bảo trì định kỳ', count: stats.pm, icon: 'repeat-outline', hint: 'Sinh từ Preventive Maintenance' },
    { filter: 'completed', label: 'Hoàn thành', count: stats.completed, icon: 'checkmark-circle-outline', hint: 'Completed · Verified · Released' },
    { filter: 'all', label: 'Tất cả Work Order', count: stats.all, icon: 'list-outline', hint: 'Mở toàn bộ danh sách' },
  ]

  function toggleCard(filter: WorkOrderDashboardFilter, enabled: boolean) {
    setVisibleFilters((current) => enabled ? (current.includes(filter) ? current : [...current, filter]) : current.filter((value) => value !== filter))
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Bảng điều khiển Work Order</Text><Text style={styles.subtitle}>{editing ? 'Chỉnh sửa dashboard' : 'Tổng quan công việc bảo trì'}</Text></View>
        <Pressable onPress={() => setEditing((value) => !value)} hitSlop={8} style={styles.iconButton}><Ionicons name={editing ? 'checkmark-outline' : 'options-outline'} size={22} color="#155EEF" /></Pressable>
      </View>
      <ScrollView refreshControl={!editing ? <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#155EEF" /> : undefined} contentContainerStyle={styles.content}>
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
        {loading && items.length === 0 ? <View style={styles.loading}><ActivityIndicator size="large" color="#155EEF" /></View> : null}

        {editing ? (
          <View style={styles.editPanel}>
            <Text style={styles.editHeading}>Edit Dashboard</Text>
            <Text style={styles.editDescription}>Chọn các card muốn hiển thị. Thay đổi được giữ trong phiên kiểm thử hiện tại.</Text>
            {cards.map((card) => {
              const enabled = visibleFilters.includes(card.filter)
              return (
                <View key={card.filter} style={styles.editRow}>
                  <View style={styles.editIcon}><Ionicons name={card.icon} size={19} color="#475467" /></View>
                  <View style={styles.editText}><Text style={styles.editLabel}>{card.label}</Text><Text style={styles.editHint}>{card.hint}</Text></View>
                  <Switch value={enabled} onValueChange={(value) => toggleCard(card.filter, value)} trackColor={{ false: '#D0D5DD', true: '#84ADFF' }} thumbColor={enabled ? '#155EEF' : '#F2F4F7'} />
                </View>
              )
            })}
          </View>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>WORK ORDER ĐANG HOẠT ĐỘNG</Text>
              <Text style={styles.heroValue}>{stats.open + stats.inProgress}</Text>
              <Text style={styles.heroHint}>OPEN + IN PROGRESS</Text>
            </View>
            <View style={styles.grid}>
              {cards.filter((card) => visibleFilters.includes(card.filter)).map((card) => (
                <Pressable key={card.filter} onPress={() => onOpenList(card.filter)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                  <View style={styles.cardIcon}><Ionicons name={card.icon} size={22} color="#155EEF" /></View>
                  <Text style={styles.cardCount}>{card.count}</Text>
                  <Text style={styles.cardLabel}>{card.label}</Text>
                  <Text style={styles.cardHint}>{card.hint}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setEditing(true)} style={({ pressed }) => [styles.editNote, pressed && styles.pressed]}>
              <Ionicons name="options-outline" size={20} color="#475467" />
              <View style={styles.editCopy}><Text style={styles.editTitle}>Edit Dashboard</Text><Text style={styles.editHintBottom}>Chọn All Work Orders hoặc custom các card cần theo dõi.</Text></View>
              <Ionicons name="chevron-forward" size={20} color="#98A2B3" />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F1FA' },
  header: { minHeight: 66, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EF', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: '900', color: '#101828' },
  subtitle: { marginTop: 2, fontSize: 11.5, color: '#667085' },
  content: { padding: 14, paddingBottom: 32 },
  errorBox: { padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: '#FEF3F2' },
  errorText: { fontSize: 12.5, color: '#B42318' },
  loading: { padding: 24, alignItems: 'center' },
  hero: { padding: 20, borderRadius: 20, backgroundColor: '#155EEF' },
  heroLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7, color: '#D6E4FF' },
  heroValue: { marginTop: 8, fontSize: 42, lineHeight: 48, fontWeight: '900', color: '#FFFFFF' },
  heroHint: { marginTop: 2, fontSize: 11, fontWeight: '800', color: '#D6E4FF' },
  grid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48.5%', minHeight: 165, padding: 15, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E1EA', backgroundColor: '#FFFFFF' },
  pressed: { opacity: 0.82 },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F0FF' },
  cardCount: { marginTop: 13, fontSize: 28, fontWeight: '900', color: '#101828' },
  cardLabel: { marginTop: 3, fontSize: 13.5, lineHeight: 18, fontWeight: '900', color: '#344054' },
  cardHint: { marginTop: 5, fontSize: 10.5, lineHeight: 14, color: '#98A2B3' },
  editNote: { marginTop: 14, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, backgroundColor: '#FFFFFF' },
  editCopy: { flex: 1 },
  editTitle: { fontSize: 13.5, fontWeight: '900', color: '#344054' },
  editHintBottom: { marginTop: 3, fontSize: 11.5, lineHeight: 16, color: '#667085' },
  editPanel: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E1EA', backgroundColor: '#FFFFFF' },
  editHeading: { paddingHorizontal: 16, paddingTop: 16, fontSize: 18, fontWeight: '900', color: '#101828' },
  editDescription: { paddingHorizontal: 16, paddingTop: 5, paddingBottom: 10, fontSize: 11.5, lineHeight: 16, color: '#667085' },
  editRow: { minHeight: 66, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  editIcon: { width: 36, height: 36, marginRight: 11, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  editText: { flex: 1, minWidth: 0, paddingRight: 8 },
  editLabel: { fontSize: 13.5, fontWeight: '800', color: '#344054' },
  editHint: { marginTop: 2, fontSize: 10.5, color: '#98A2B3' },
})
