import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EquipmentPhoto } from '../components/EquipmentPhoto'
import { listEquipment, type EquipmentListItem } from '../services/equipmentService'

function statusColor(status: string) {
  const key = status.toUpperCase()
  if (key === 'RUNNING') return '#12B76A'
  if (key === 'MAINTENANCE') return '#F79009'
  if (key === 'DOWN' || key === 'STOPPED') return '#D92D20'
  return '#98A2B3'
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

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('vi')
    if (!needle) return items
    return items.filter((item) => [
      item.equipmentId,
      item.equipmentName,
      item.model,
      item.manufacturer,
      item.area,
      item.line,
      item.category,
    ].some((value) => value.toLocaleLowerCase('vi').includes(needle)))
  }, [items, query])

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
          placeholder="Tìm mã, tên, model, khu vực..."
          placeholderTextColor="#98A2B3"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setQuery('')} hitSlop={8}><Ionicons name="close-circle" size={19} color="#98A2B3" /></Pressable> : null}
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>{filteredItems.length} thiết bị</Text>
        <Text style={styles.summaryHint}>Dữ liệu equipment_master</Text>
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
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={30} color="#98A2B3" />
              <Text style={styles.centerText}>Không tìm thấy thiết bị phù hợp.</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 58, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#101828' },
  searchWrap: { minHeight: 46, margin: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: '#FFFFFF' },
  searchInput: { flex: 1, minHeight: 44, fontSize: 14, color: '#101828' },
  summaryRow: { paddingHorizontal: 15, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryText: { fontSize: 12.5, fontWeight: '800', color: '#344054' },
  summaryHint: { fontSize: 10.5, color: '#98A2B3' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingBottom: 22, gap: 6 },
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
  empty: { flex: 1, paddingVertical: 52, alignItems: 'center', justifyContent: 'center' },
})
