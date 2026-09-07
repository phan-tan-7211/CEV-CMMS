import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import { EquipmentPhoto } from '../components/EquipmentPhoto'
import {
  equipmentStatusVisual,
  getEquipmentDetail,
  type EquipmentDetail,
} from '../services/equipmentService'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export function EquipmentDetailScreen({
  equipmentId,
  onBack,
  onOpenStatus,
}: {
  equipmentId: string
  onBack: () => void
  onOpenStatus: (currentStatus: string) => void
}) {
  const { width } = useWindowDimensions()
  const [item, setItem] = useState<EquipmentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void getEquipmentDetail(equipmentId)
      .then((data) => { if (active) setItem(data) })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Không tải được thiết bị.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [equipmentId])

  const photoHeight = Math.min(340, Math.max(230, Math.round(width * 0.68)))
  const statusVisual = equipmentStatusVisual(item?.status || '')

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại danh sách thiết bị" onPress={onBack} hitSlop={8} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={27} color="#101828" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{item?.equipmentName || equipmentId}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Tùy chọn thiết bị" hitSlop={8} style={styles.iconButton}>
          <Ionicons name="ellipsis-vertical" size={23} color="#344054" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View>
      ) : error || !item ? (
        <View style={styles.center}><Ionicons name="alert-circle-outline" size={34} color="#D92D20" /><Text style={styles.error}>{error || 'Không tìm thấy thiết bị.'}</Text></View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <EquipmentPhoto
            uri={item.imageUrl}
            width={Math.round(width)}
            height={photoHeight}
            borderRadius={0}
            showBorder={false}
            accessibilityLabel={`Ảnh thiết bị ${item.equipmentId}`}
          />

          <View style={styles.body}>
            <View style={styles.identity}>
              <Text style={styles.name}>{item.equipmentName || 'Thiết bị chưa đặt tên'}</Text>
              <Text style={styles.id}>{item.equipmentId}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Trạng thái ${statusVisual.label}. Nhấn để thay đổi`}
              onPress={() => onOpenStatus(item.status)}
              style={({ pressed }) => [styles.statusCard, { backgroundColor: statusVisual.backgroundColor }, pressed && styles.pressed]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusVisual.color }]} />
              <Text style={[styles.statusText, { color: statusVisual.color }]}>{statusVisual.label}</Text>
              <Ionicons name="chevron-forward" size={25} color={statusVisual.color} />
            </Pressable>

            <View style={styles.card}>
              <InfoRow label="Số seri" value={item.serialNumber} />
              <InfoRow label="Nhà sản xuất" value={item.manufacturer} />
              <InfoRow label="Model" value={item.model} />
              <InfoRow label="Xuất xứ" value={item.origin} />
              <InfoRow label="Danh mục" value={item.category} />
            </View>

            <View style={styles.card}>
              <InfoRow label="Khu vực" value={item.area} />
              <InfoRow label="Line" value={item.line} />
              <InfoRow label="Bộ phận quản lý" value={item.managingDepartment} />
              <InfoRow label="Phụ trách chính" value={item.responsiblePrimary} />
              <InfoRow label="Phụ trách phụ" value={item.responsibleSecondary} />
            </View>

            {(item.technicalSpecification || item.description) ? (
              <View style={styles.card}>
                <InfoRow label="Thông số" value={item.technicalSpecification} />
                <InfoRow label="Mô tả" value={item.description} />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    minHeight: 60,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
    backgroundColor: '#FFFFFF',
  },
  iconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, paddingHorizontal: 6, fontSize: 20, fontWeight: '900', color: '#101828' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { marginTop: 10, textAlign: 'center', color: '#B42318' },
  body: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 32, gap: 14 },
  identity: { gap: 4 },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '900', color: '#101828' },
  id: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#667085' },
  statusCard: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
  },
  statusDot: { width: 13, height: 13, borderRadius: 7, marginRight: 13 },
  statusText: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '800' },
  card: {
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
  },
  infoRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
  },
  infoLabel: { width: 132, fontSize: 16, lineHeight: 21, fontWeight: '500', color: '#667085' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#101828' },
  pressed: { opacity: 0.72 },
})
