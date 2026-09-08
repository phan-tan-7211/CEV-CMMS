import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  listEquipmentStatuses,
  updateEquipmentStatus,
  type EquipmentStatusMaster,
} from '../features/equipment'

export function EquipmentStatusScreen({
  equipmentId,
  currentStatus,
  onBack,
  onSaved,
}: {
  equipmentId: string
  currentStatus: string
  onBack: () => void
  onSaved: (status: string) => void
}) {
  const [statuses, setStatuses] = useState<EquipmentStatusMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void listEquipmentStatuses()
      .then((rows) => { if (active) setStatuses(rows) })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Không tải được trạng thái thiết bị.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function selectStatus(statusCode: string) {
    if (savingStatus) return
    if (statusCode === currentStatus.toUpperCase()) {
      onBack()
      return
    }

    setSavingStatus(statusCode)
    setError('')
    try {
      const result = await updateEquipmentStatus(equipmentId, statusCode)
      onSaved(result.status)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được trạng thái thiết bị.')
    } finally {
      setSavingStatus(null)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại chi tiết thiết bị" onPress={onBack} hitSlop={8} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={26} color="#101828" />
        </Pressable>
        <Text style={styles.headerTitle}>Trạng thái thiết bị</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.content}>
        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#155EEF" /></View> : null}
        {!loading ? statuses.map((option) => {
          const selected = option.statusCode === currentStatus.toUpperCase()
          const saving = savingStatus === option.statusCode
          return (
            <Pressable
              key={option.statusCode}
              accessibilityRole="button"
              accessibilityLabel={`Chọn trạng thái ${option.displayName}`}
              disabled={Boolean(savingStatus)}
              onPress={() => { void selectStatus(option.statusCode) }}
              style={({ pressed }) => [styles.row, pressed && !savingStatus && styles.rowPressed]}
            >
              <View style={[styles.dot, { backgroundColor: option.color }]} />
              <Text style={styles.label}>{option.displayName}</Text>
              {saving ? <ActivityIndicator size="small" color="#155EEF" /> : selected ? <Ionicons name="checkmark" size={30} color="#155EEF" /> : null}
            </Pressable>
          )
        }) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={19} color="#B42318" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 62, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: '#101828' },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  loading: { paddingVertical: 42, alignItems: 'center' },
  row: { minHeight: 86, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC' },
  rowPressed: { backgroundColor: '#F9FAFB' },
  dot: { width: 14, height: 14, borderRadius: 7, marginRight: 20 },
  label: { flex: 1, fontSize: 21, lineHeight: 27, fontWeight: '700', color: '#101828' },
  errorBox: { marginTop: 18, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: '#FEF3F2' },
  errorText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#B42318' },
})
