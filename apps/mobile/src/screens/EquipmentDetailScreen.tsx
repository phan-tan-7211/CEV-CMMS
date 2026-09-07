import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getEquipmentDetail, type EquipmentDetail } from '../services/equipmentService'

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export function EquipmentDetailScreen({ equipmentId, onBack }: { equipmentId: string; onBack: () => void }) {
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="chevron-back" size={25} color="#101828" /></Pressable>
        <Text style={styles.headerTitle}>Chi tiết thiết bị</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View>
      ) : error || !item ? (
        <View style={styles.center}><Ionicons name="alert-circle-outline" size={34} color="#D92D20" /><Text style={styles.error}>{error || 'Không tìm thấy thiết bị.'}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="cube-outline" size={30} color="#155EEF" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{item.equipmentName || 'Thiết bị chưa đặt tên'}</Text>
              <Text style={styles.id}>{item.equipmentId}</Text>
              <Text style={styles.status}>{item.status || 'UNKNOWN'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Nhận diện</Text>
            <InfoRow label="Model" value={item.model} />
            <InfoRow label="Serial" value={item.serialNumber} />
            <InfoRow label="Hãng sản xuất" value={item.manufacturer} />
            <InfoRow label="Xuất xứ" value={item.origin} />
            <InfoRow label="Phân loại" value={item.category} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vị trí & quản lý</Text>
            <InfoRow label="Khu vực" value={item.area} />
            <InfoRow label="Line" value={item.line} />
            <InfoRow label="Bộ phận quản lý" value={item.managingDepartment} />
            <InfoRow label="Phụ trách chính" value={item.responsiblePrimary} />
            <InfoRow label="Phụ trách phụ" value={item.responsibleSecondary} />
          </View>

          {(item.technicalSpecification || item.description) ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Thông tin kỹ thuật</Text>
              <InfoRow label="Thông số" value={item.technicalSpecification} />
              <InfoRow label="Mô tả" value={item.description} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 58, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#101828' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { marginTop: 10, textAlign: 'center', color: '#B42318' },
  content: { padding: 12, paddingBottom: 28, gap: 10 },
  hero: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE1E7' },
  heroIcon: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FF' },
  heroCopy: { flex: 1 },
  name: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#101828' },
  id: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#667085' },
  status: { marginTop: 7, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F2F4F7', fontSize: 10.5, fontWeight: '800', color: '#344054' },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#DDE1E7' },
  sectionTitle: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8, fontSize: 13.5, fontWeight: '900', color: '#101828' },
  infoRow: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  infoLabel: { width: 118, fontSize: 12, fontWeight: '700', color: '#667085' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 12.5, lineHeight: 18, color: '#101828' },
})
