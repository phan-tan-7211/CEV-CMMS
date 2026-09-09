import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
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

function labelForStatus(status: string) {
  const normalized = status.trim().toUpperCase()
  if (normalized === 'OPEN') return 'Mở'
  if (normalized === 'WAITING_APPROVAL') return 'Chờ duyệt'
  if (normalized === 'APPROVED') return 'Đã duyệt'
  if (normalized === 'IN_PROGRESS') return 'Đang thực hiện'
  if (normalized === 'ON_HOLD') return 'Tạm dừng'
  if (normalized === 'COMPLETED') return 'Hoàn thành'
  if (normalized === 'VERIFIED') return 'Đã xác nhận'
  if (normalized === 'RELEASED') return 'Đã bàn giao'
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

const TERMINAL_STATUSES = ['COMPLETED', 'VERIFIED', 'RELEASED']

export function WorkOrdersScreen({ onBack, onOpenWorkOrder, equipmentId, scope }: { onBack: () => void; onOpenWorkOrder: (workOrderId: string) => void; equipmentId?: string; scope?: 'pending' | 'completed' }) {
  const [items, setItems] = useState<WorkOrderListItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [bookmarkSavingId, setBookmarkSavingId] = useState('')
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
      const status = item.status.trim().toUpperCase()
      if (scope === 'completed' && !TERMINAL_STATUSES.includes(status)) return false
      if (scope === 'pending' && TERMINAL_STATUSES.includes(status)) return false
      if (selectedStatus !== 'ALL' && item.status !== selectedStatus) return false
      if (bookmarkedOnly && !bookmarkedIds.has(item.workOrderId)) return false
      if (!keyword) return true
      return [item.workOrderId, item.equipmentId, item.equipmentName, item.reason, item.createdBy]
        .some((value) => value.toLocaleLowerCase('vi').includes(keyword))
    })
  }, [bookmarkedIds, bookmarkedOnly, equipmentId, items, query, scope, selectedStatus])

  async function refresh() {
    setRefreshing(true)
    setError('')
    try {
      const [next, bookmarks] = await Promise.all([
        revalidateWorkOrderList({ force: true }),
        listBookmarkedWorkOrderIds(),
      ])
      setItems(next)
      setBookmarkedIds(new Set(bookmarks))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được Work Order.')
    } finally {
      setRefreshing(false)
    }
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
      setError(reason instanceof Error ? reason.message : 'Không lưu được trạng thái dùng ngoại tuyến.')
    } finally {
      setBookmarkSavingId('')
    }
  }

  function resetFilters() {
    setSelectedStatus('ALL')
    setQuery('')
    setBookmarkedOnly(false)
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable><Text style={styles.title}>Công việc</Text><Pressable onPress={resetFilters} hitSlop={8} style={styles.headerAction} accessibilityRole="button" accessibilityLabel="Đặt lại bộ lọc"><Ionicons name="options-outline" size={22} color="#667085" /></Pressable></View>
    <View style={styles.searchWrap}><View style={styles.searchBox}><Ionicons name="search-outline" size={19} color="#98A2B3" /><TextInput value={query} onChangeText={setQuery} placeholder="Tìm mã WO, thiết bị, nội dung..." placeholderTextColor="#98A2B3" style={styles.searchInput} />{query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color="#98A2B3" /></Pressable> : null}</View><FlatList horizontal data={['BOOKMARKED', 'ALL', ...statuses]} keyExtractor={(item) => item} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} renderItem={({ item }) => {
      const isBookmarkFilter = item === 'BOOKMARKED'
      const active = isBookmarkFilter ? bookmarkedOnly : !bookmarkedOnly && selectedStatus === item
      return <Pressable onPress={() => {
        if (isBookmarkFilter) { setBookmarkedOnly(true); setSelectedStatus('ALL'); return }
        setBookmarkedOnly(false); setSelectedStatus(item)
      }} style={[styles.filterPill, active && styles.filterPillActive]}><Text style={[styles.filterText, active && styles.filterTextActive]}>{isBookmarkFilter ? 'Đã lưu offline' : item === 'ALL' ? 'Tất cả' : labelForStatus(item)}</Text></Pressable>
    }} /><View style={styles.counterRow}><Text style={styles.counter}>{filtered.length} lệnh công việc</Text>{selectedStatus !== 'ALL' || query || bookmarkedOnly ? <Pressable onPress={resetFilters}><Text style={styles.reset}>Đặt lại tất cả</Text></Pressable> : null}</View></View>
    {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}
    {loading && items.length === 0 ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.muted}>Đang tải Work Order...</Text></View> : <FlatList data={filtered} keyExtractor={(item) => item.workOrderId} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh() }} tintColor="#155EEF" />} contentContainerStyle={filtered.length ? styles.listContent : styles.emptyContent} renderItem={({ item }) => {
      const bookmarked = bookmarkedIds.has(item.workOrderId)
      return <View style={styles.card}><Pressable onPress={() => onOpenWorkOrder(item.workOrderId)} style={({ pressed }) => [styles.cardMain, pressed && styles.cardPressed]}><View style={styles.cardTop}><View style={styles.cardHeading}><View style={styles.statusDot} /><Text style={styles.workOrderId}>{item.workOrderId}</Text></View><Ionicons name="chevron-forward" size={20} color="#98A2B3" /></View><Text style={styles.reason} numberOfLines={2}>{item.reason || 'Không có nội dung'}</Text><View style={styles.badgeRow}><View style={styles.statusBadge}><Text style={styles.statusText}>{labelForStatus(item.status)}</Text></View><View style={styles.priorityBadge}><Text style={styles.priorityText}>{labelForPriority(item.priority || '')}</Text></View>{bookmarked ? <View style={styles.offlineBadge}><Ionicons name="cloud-offline-outline" size={12} color="#175CD3" /><Text style={styles.offlineBadgeText}>Offline</Text></View> : null}</View><View style={styles.metaRow}><Ionicons name="cube-outline" size={15} color="#667085" /><Text style={styles.meta} numberOfLines={1}>{item.equipmentName || item.equipmentId || 'Chưa gắn thiết bị'}</Text></View><View style={styles.footerRow}><Text style={styles.secondary}>{item.equipmentId || '—'}</Text><Text style={styles.secondary}>{formatDate(item.createdAt)}</Text></View></Pressable><Pressable disabled={bookmarkSavingId === item.workOrderId} onPress={() => { void toggleBookmark(item.workOrderId) }} style={styles.bookmarkButton} accessibilityRole="button" accessibilityLabel={bookmarked ? `Bỏ lưu offline ${item.workOrderId}` : `Lưu offline ${item.workOrderId}`}><Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={bookmarked ? '#155EEF' : '#667085'} /></Pressable></View>
    }} ListEmptyComponent={<View style={styles.center}><Ionicons name={bookmarkedOnly ? 'cloud-offline-outline' : 'clipboard-outline'} size={38} color="#98A2B3" /><Text style={styles.emptyTitle}>{bookmarkedOnly ? 'Chưa có Work Order lưu offline' : 'Không có Work Order phù hợp'}</Text><Text style={styles.muted}>{bookmarkedOnly ? 'Nhấn biểu tượng bookmark trên Work Order để lưu dùng khi mất mạng.' : 'Thử điều chỉnh tìm kiếm hoặc bộ lọc.'}</Text></View>} />}
  </SafeAreaView>
}

const styles = StyleSheet.create({safeArea:{flex:1,backgroundColor:'#F1F1FA'},header:{minHeight:58,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5E5EF',backgroundColor:'#FFF'},iconButton:{width:44,height:44,alignItems:'center',justifyContent:'center'},headerAction:{width:44,height:44,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'900',color:'#101828'},searchWrap:{paddingHorizontal:14,paddingTop:12,paddingBottom:9,backgroundColor:'#FFF'},searchBox:{minHeight:46,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9,borderWidth:1,borderColor:'#D7D8E5',borderRadius:23,backgroundColor:'#FFF'},searchInput:{flex:1,minHeight:44,fontSize:14,color:'#101828'},filters:{paddingTop:11,paddingBottom:5,gap:8},filterPill:{minHeight:35,paddingHorizontal:15,alignItems:'center',justifyContent:'center',borderRadius:18,borderWidth:1,borderColor:'#D9DAE7',backgroundColor:'#FFF'},filterPillActive:{borderColor:'#536DFE',backgroundColor:'#536DFE'},filterText:{fontSize:12.5,fontWeight:'700',color:'#475467'},filterTextActive:{color:'#FFF'},counterRow:{minHeight:28,paddingTop:3,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},counter:{fontSize:12,fontWeight:'800',color:'#667085'},reset:{fontSize:12,fontWeight:'800',color:'#155EEF'},errorBox:{margin:14,padding:12,borderRadius:10,backgroundColor:'#FEF3F2'},errorText:{fontSize:12.5,color:'#B42318'},listContent:{padding:14,paddingBottom:28,gap:11},emptyContent:{flexGrow:1},card:{position:'relative',borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:'#E1E1EA',backgroundColor:'#FFF',shadowColor:'#28324D',shadowOpacity:.04,shadowRadius:7,shadowOffset:{width:0,height:2},elevation:1,overflow:'hidden'},cardMain:{padding:16,paddingRight:54},cardPressed:{backgroundColor:'#F9FAFB'},bookmarkButton:{position:'absolute',top:8,right:7,width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:22},cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},cardHeading:{flex:1,flexDirection:'row',alignItems:'center',gap:8},statusDot:{width:8,height:8,borderRadius:4,backgroundColor:'#536DFE'},workOrderId:{flex:1,fontSize:13,fontWeight:'900',color:'#155EEF'},badgeRow:{marginTop:11,flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:7},statusBadge:{paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:'#E9F0FF'},statusText:{fontSize:10.5,fontWeight:'800',color:'#344054'},priorityBadge:{paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:'#FFF4E5'},priorityText:{fontSize:10.5,fontWeight:'800',color:'#9A6700'},offlineBadge:{paddingHorizontal:8,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:4,borderRadius:10,backgroundColor:'#EFF8FF'},offlineBadgeText:{fontSize:10.5,fontWeight:'800',color:'#175CD3'},reason:{marginTop:10,fontSize:16,lineHeight:21,fontWeight:'900',color:'#1D2939'},metaRow:{marginTop:9,flexDirection:'row',alignItems:'center',gap:6},meta:{flex:1,fontSize:12.5,color:'#475467'},footerRow:{marginTop:10,paddingTop:9,flexDirection:'row',alignItems:'center',gap:9,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0'},secondary:{flex:1,fontSize:11.5,color:'#98A2B3'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:28},emptyTitle:{marginTop:10,marginBottom:4,fontSize:15,fontWeight:'900',color:'#344054'},muted:{marginTop:8,textAlign:'center',fontSize:12.5,color:'#667085'}})
