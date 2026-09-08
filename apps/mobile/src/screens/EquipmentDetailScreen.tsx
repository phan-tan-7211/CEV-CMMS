import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  EquipmentPhoto,
  getEquipmentDetailSnapshot,
  listEquipmentStatuses,
  revalidateEquipmentDetail,
  subscribeEquipmentDetail,
  type EquipmentDetail,
  type EquipmentStatusMaster,
} from '../features/equipment'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
}

export function EquipmentDetailScreen({ equipmentId, onBack, onOpenStatus }: { equipmentId: string; onBack: () => void; onOpenStatus: (currentStatus: string) => void }) {
  const { width } = useWindowDimensions()
  const [item, setItem] = useState<EquipmentDetail | null>(null)
  const [statuses, setStatuses] = useState<EquipmentStatusMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let hasSnapshot = false
    setLoading(true)
    setError('')

    const unsubscribe = subscribeEquipmentDetail(equipmentId, (nextItem) => {
      if (!active) return
      setItem(nextItem)
      setLoading(false)
      setError('')
    })

    void getEquipmentDetailSnapshot(equipmentId)
      .then((snapshot) => {
        if (!active || !snapshot) return
        hasSnapshot = true
        setItem(snapshot)
        setLoading(false)
      })
      .finally(() => {
        void revalidateEquipmentDetail(equipmentId)
          .then((fresh) => {
            if (!active) return
            setItem(fresh)
            setLoading(false)
            setError('')
          })
          .catch((loadError) => {
            if (!active) return
            if (!hasSnapshot) setError(loadError instanceof Error ? loadError.message : 'Không tải được thiết bị.')
            setLoading(false)
          })
      })

    void listEquipmentStatuses()
      .then((nextStatuses) => { if (active) setStatuses(nextStatuses) })
      .catch(() => {
        // The detail remains usable with the raw status code if master data is temporarily unavailable.
      })

    return () => {
      active = false
      unsubscribe()
    }
  }, [equipmentId])

  const photoHeight = Math.min(340, Math.max(230, Math.round(width * 0.68)))
  const status = statuses.find((option) => option.statusCode === String(item?.status || '').toUpperCase())
  const statusLabel = status?.displayName || item?.status || 'Không xác định'
  const statusColor = status?.color || '#667085'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại danh sách thiết bị" onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="chevron-back" size={27} color="#101828" /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{item?.equipmentName || equipmentId}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tùy chọn thiết bị" hitSlop={8} style={styles.iconButton}><Ionicons name="ellipsis-vertical" size={23} color="#344054" /></Pressable>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View> : error || !item ? (
        <View style={styles.center}><Ionicons name="alert-circle-outline" size={34} color="#D92D20" /><Text style={styles.error}>{error || 'Không tìm thấy thiết bị.'}</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.photoFrame}><EquipmentPhoto uri={item.imageUrl} width={Math.round(width)} height={photoHeight} borderRadius={0} showBorder={false} accessibilityLabel={`Ảnh thiết bị ${item.equipmentId}`} /></View>
          <View style={styles.body}>
            <View style={styles.identity}><Text style={styles.name}>{item.equipmentName || 'Thiết bị chưa đặt tên'}</Text><Text style={styles.id}>{item.equipmentId}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Trạng thái ${statusLabel}. Nhấn để thay đổi`} onPress={() => onOpenStatus(item.status)} style={({ pressed }) => [styles.statusCard, pressed && styles.pressed]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              <Ionicons name="chevron-forward" size={25} color={statusColor} />
            </Pressable>
            <Text style={styles.sectionTitle}>THÔNG TIN THIẾT BỊ</Text>
            <View style={styles.card}><InfoRow label="Số seri" value={item.serialNumber} /><InfoRow label="Nhà sản xuất" value={item.manufacturer} /><InfoRow label="Model" value={item.model} /><InfoRow label="Xuất xứ" value={item.origin} /><InfoRow label="Danh mục" value={item.category} /></View>
            <Text style={styles.sectionTitle}>VỊ TRÍ & PHỤ TRÁCH</Text>
            <View style={styles.card}><InfoRow label="Khu vực" value={item.area} /><InfoRow label="Line" value={item.line} /><InfoRow label="Bộ phận quản lý" value={item.managingDepartment} /><InfoRow label="Phụ trách chính" value={item.responsiblePrimary} /><InfoRow label="Phụ trách phụ" value={item.responsibleSecondary} /></View>
            {(item.technicalSpecification || item.description) ? <><Text style={styles.sectionTitle}>THÔNG TIN BỔ SUNG</Text><View style={styles.card}><InfoRow label="Thông số" value={item.technicalSpecification} /><InfoRow label="Mô tả" value={item.description} /></View></> : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F1F1FA' },
  header: { minHeight: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EF', backgroundColor: '#FFFFFF' },
  iconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, paddingHorizontal: 6, fontSize: 20, fontWeight: '900', color: '#101828' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { marginTop: 10, textAlign: 'center', color: '#B42318' },
  photoFrame: { overflow: 'hidden', backgroundColor: '#E5E7F3' },
  body: { paddingHorizontal: 14, paddingTop: 18, paddingBottom: 32, gap: 12 },
  identity: { gap: 4 },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: '#101828' },
  id: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#667085' },
  statusCard: { minHeight: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E1EA' },
  statusDot: { width: 13, height: 13, borderRadius: 7, marginRight: 13 },
  statusText: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '800' },
  sectionTitle: { marginTop: 4, paddingHorizontal: 4, fontSize: 10.5, fontWeight: '900', letterSpacing: .7, color: '#98A2B3' },
  card: { overflow: 'hidden', borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E1E1EA', backgroundColor: '#FFFFFF' },
  infoRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  infoLabel: { width: 125, fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#667085' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 14, lineHeight: 20, fontWeight: '700', color: '#101828' },
  pressed: { opacity: 0.72 },
})
