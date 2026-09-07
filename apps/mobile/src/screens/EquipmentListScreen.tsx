import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EquipmentPhoto } from '../components/EquipmentPhoto'
import { listEquipment, type EquipmentListItem } from '../services/equipmentService'

type SortMode = 'name-asc' | 'name-desc' | 'location-asc' | 'location-desc'

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'name-asc', label: 'Tên (A đến Z)' },
  { value: 'name-desc', label: 'Tên (Z đến A)' },
  { value: 'location-asc', label: 'Vị trí (A đến Z)' },
  { value: 'location-desc', label: 'Vị trí (Z đến A)' },
]

function statusColor(status: string) {
  const key = status.toUpperCase()
  if (key === 'RUNNING') return '#12B76A'
  if (key === 'MAINTENANCE') return '#F79009'
  if (key === 'DOWN' || key === 'STOPPED') return '#D92D20'
  return '#98A2B3'
}

function normalizeStatus(status: string) {
  return status.trim().toLocaleUpperCase('vi')
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true })
}

function locationText(item: EquipmentListItem) {
  return [item.area, item.line].filter(Boolean).join(' · ')
}

export function EquipmentListScreen({
  onBack,
  onCreateEquipment,
  onOpenEquipment,
}: {
  onBack: () => void
  onCreateEquipment: () => void
  onOpenEquipment: (equipmentId: string) => void
}) {
  const [items, setItems] = useState<EquipmentListItem[]>([])
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('name-asc')
  const [sortOpen, setSortOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [statusOpen, setStatusOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function load(mode: 'initial' | 'refresh' = 'initial') {
    if (mode === 'refresh') setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      setItems(await listEquipment())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách thiết bị.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  const statusOptions = useMemo(() => {
    const labelsByKey = new Map<string, string>()
    for (const item of items) {
      const label = item.status.trim()
      if (!label) continue
      const key = normalizeStatus(label)
      if (!labelsByKey.has(key)) labelsByKey.set(key, label)
    }
    return Array.from(labelsByKey.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => compareText(a.label, b.label))
  }, [items])

  useEffect(() => {
    if (statusFilter && !statusOptions.some((option) => option.value === statusFilter)) {
      setStatusFilter(null)
    }
  }, [statusFilter, statusOptions])

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi')
    const nextItems = items.filter((item) => {
      if (statusFilter && normalizeStatus(item.status) !== statusFilter) return false
      if (!needle) return true
      return [
        item.equipmentId,
        item.equipmentName,
        item.model,
        item.manufacturer,
        item.area,
        item.line,
        item.category,
      ].some((value) => value.toLocaleLowerCase('vi').includes(needle))
    })

    nextItems.sort((a, b) => {
      if (sortMode === 'name-asc') return compareText(a.equipmentName || a.equipmentId, b.equipmentName || b.equipmentId)
      if (sortMode === 'name-desc') return compareText(b.equipmentName || b.equipmentId, a.equipmentName || a.equipmentId)
      if (sortMode === 'location-asc') return compareText(locationText(a), locationText(b)) || compareText(a.equipmentName, b.equipmentName)
      return compareText(locationText(b), locationText(a)) || compareText(a.equipmentName, b.equipmentName)
    })

    return nextItems
  }, [items, query, sortMode, statusFilter])

  const sortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label || 'Tên (A đến Z)'
  const selectedStatusOption = statusOptions.find((option) => option.value === statusFilter)
  const statusLabel = selectedStatusOption?.label || 'Trạng thái'
  const hasActiveFilter = statusFilter !== null

  function resetFilters() {
    setStatusFilter(null)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="chevron-back" size={25} color="#101828" /></Pressable>
        <Text style={styles.headerTitle}>Thiết bị</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Thêm thiết bị" onPress={onCreateEquipment} hitSlop={8} style={styles.iconButton}><Ionicons name="add" size={27} color="#155EEF" /></Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={19} color="#98A2B3" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm kiếm tất cả thiết bị"
          placeholderTextColor="#98A2B3"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={19} color="#98A2B3" /></Pressable> : null}
      </View>

      <View style={styles.filterToolsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bộ lọc danh mục, sẽ được bổ sung sau"
          style={({ pressed }) => [styles.filterIconButton, pressed && styles.toolPressed]}
        >
          <Ionicons name="options-outline" size={20} color="#101828" />
        </Pressable>
        <View style={styles.toolDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lọc trạng thái: ${statusLabel}`}
          onPress={() => setStatusOpen(true)}
          style={({ pressed }) => [styles.statusFilterButton, hasActiveFilter && styles.statusFilterButtonActive, pressed && styles.toolPressed]}
        >
          <Text style={[styles.statusFilterText, hasActiveFilter && styles.statusFilterTextActive]} numberOfLines={1}>{statusLabel}</Text>
          <Ionicons name="chevron-down" size={17} color={hasActiveFilter ? '#FFFFFF' : '#101828'} />
        </Pressable>
        <View style={styles.toolDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đặt lại tất cả bộ lọc"
          onPress={resetFilters}
          disabled={!hasActiveFilter}
          style={({ pressed }) => [styles.resetButton, !hasActiveFilter && styles.resetButtonHidden, pressed && hasActiveFilter && styles.toolPressed]}
        >
          <Text style={styles.resetText}>Đặt lại tất cả</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sắp xếp theo ${sortLabel}`}
          onPress={() => setSortOpen(true)}
          style={({ pressed }) => [styles.sortButton, pressed && styles.sortButtonPressed]}
        >
          <Ionicons name="swap-vertical-outline" size={18} color="#101828" />
          <Text style={styles.sortText}>{sortLabel}</Text>
        </Pressable>
        <Text style={styles.summaryText}>{filteredItems.length} kết quả</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /><Text style={styles.centerText}>Đang tải thiết bị...</Text></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={32} color="#D92D20" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Thử tải lại" onPress={() => { void load() }} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.equipmentId}
          style={styles.list}
          contentContainerStyle={[styles.listContent, filteredItems.length === 0 && styles.listContentEmpty]}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void load('refresh') }} />}
          initialNumToRender={10}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.equipmentName || 'Thiết bị chưa đặt tên'}, ${item.equipmentId}`}
              onPress={() => onOpenEquipment(item.equipmentId)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <EquipmentPhoto
                uri={item.imageUrl}
                width={76}
                height={76}
                borderRadius={10}
                showBorder={false}
                accessibilityLabel={`Ảnh thiết bị ${item.equipmentId}`}
              />
              <View style={styles.rowCopy}>
                <View style={styles.titleRow}>
                  <Text style={styles.assetName} numberOfLines={1}>{item.equipmentName || 'Thiết bị chưa đặt tên'}</Text>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(item.status) }]} />
                </View>
                <Text style={styles.assetId}>{item.equipmentId}{item.model ? `  ·  ${item.model}` : ''}</Text>
                {(item.area || item.line) ? <Text style={styles.meta} numberOfLines={1}>{[item.area, item.line].filter(Boolean).join(' · ')}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={22} color="#B0B7C3" />
            </Pressable>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Không có kết quả</Text>
              <Text style={styles.emptyDescription}>Thử điều chỉnh bộ lọc của bạn.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đặt lại bộ lọc"
                onPress={resetFilters}
                style={({ pressed }) => [styles.emptyResetButton, pressed && styles.toolPressed]}
              >
                <Text style={styles.emptyResetText}>Đặt lại bộ lọc</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={statusOpen} transparent animationType="fade" onRequestClose={() => setStatusOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setStatusOpen(false)}>
          <Pressable style={styles.sortSheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Trạng thái</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tất cả trạng thái"
              onPress={() => {
                setStatusFilter(null)
                setStatusOpen(false)
              }}
              style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}
            >
              <Text style={[styles.sortOptionText, !statusFilter && styles.sortOptionTextSelected]}>Tất cả (mặc định)</Text>
              {!statusFilter ? <Ionicons name="checkmark" size={23} color="#155EEF" /> : null}
            </Pressable>
            {statusOptions.map((option) => {
              const selected = option.value === statusFilter
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  onPress={() => {
                    setStatusFilter(option.value)
                    setStatusOpen(false)
                  }}
                  style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}
                >
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextSelected]}>{option.label}</Text>
                  {selected ? <Ionicons name="checkmark" size={23} color="#155EEF" /> : null}
                </Pressable>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortOpen(false)}>
          <Pressable style={styles.sortSheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sắp xếp theo</Text>
            {SORT_OPTIONS.map((option) => {
              const selected = option.value === sortMode
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  onPress={() => {
                    setSortMode(option.value)
                    setSortOpen(false)
                  }}
                  style={({ pressed }) => [styles.sortOption, pressed && styles.sortOptionPressed]}
                >
                  <Text style={[styles.sortOptionText, selected && styles.sortOptionTextSelected]}>{option.label}</Text>
                  {selected ? <Ionicons name="checkmark" size={23} color="#155EEF" /> : null}
                </Pressable>
              )
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 58, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#101828' },
  searchWrap: { minHeight: 46, marginHorizontal: 12, marginTop: 12, marginBottom: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 23, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: '#101828' },
  filterToolsRow: { minHeight: 47, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF' },
  filterIconButton: { width: 43, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  toolDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: '#D0D5DD' },
  statusFilterButton: { maxWidth: 190, minHeight: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 18, backgroundColor: '#F2F4F7' },
  statusFilterButtonActive: { backgroundColor: '#2D2D2D' },
  statusFilterText: { flexShrink: 1, fontSize: 13.5, fontWeight: '800', color: '#101828' },
  statusFilterTextActive: { color: '#FFFFFF' },
  resetButton: { flexShrink: 1, minHeight: 36, justifyContent: 'center' },
  resetButtonHidden: { opacity: 0 },
  resetText: { fontSize: 13.5, fontWeight: '800', color: '#1570EF' },
  toolPressed: { opacity: 0.65 },
  summaryRow: { minHeight: 43, paddingHorizontal: 15, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  sortButton: { flex: 1, minWidth: 0, minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortButtonPressed: { opacity: 0.65 },
  sortText: { flexShrink: 1, fontSize: 12.5, fontWeight: '800', color: '#101828' },
  summaryText: { fontSize: 12.5, fontWeight: '700', color: '#667085' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingTop: 6, paddingBottom: 22, gap: 6 },
  listContentEmpty: { flexGrow: 1 },
  row: { minHeight: 84, paddingHorizontal: 4, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  rowPressed: { backgroundColor: '#F9FAFB' },
  rowCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  assetName: { flex: 1, fontSize: 14.5, fontWeight: '900', color: '#101828' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  assetId: { marginTop: 3, fontSize: 11.5, fontWeight: '700', color: '#667085' },
  meta: { marginTop: 2, fontSize: 10.5, color: '#98A2B3' },
  center: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  centerText: { marginTop: 10, textAlign: 'center', fontSize: 13, color: '#667085' },
  errorText: { marginTop: 10, textAlign: 'center', fontSize: 13, lineHeight: 19, color: '#B42318' },
  retryButton: { marginTop: 14, minHeight: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  retryText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  emptyState: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#101828' },
  emptyDescription: { marginTop: 12, textAlign: 'center', fontSize: 14, color: '#667085' },
  emptyResetButton: { minHeight: 44, marginTop: 18, justifyContent: 'center' },
  emptyResetText: { fontSize: 15, fontWeight: '800', color: '#1570EF' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.42)' },
  sortSheet: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 26, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#FFFFFF' },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, marginBottom: 12, borderRadius: 2, backgroundColor: '#D0D5DD' },
  sheetTitle: { paddingHorizontal: 2, paddingBottom: 6, fontSize: 16, fontWeight: '900', color: '#101828' },
  sortOption: { minHeight: 54, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  sortOptionPressed: { backgroundColor: '#F9FAFB' },
  sortOptionText: { fontSize: 14, color: '#344054' },
  sortOptionTextSelected: { fontWeight: '800', color: '#101828' },
})