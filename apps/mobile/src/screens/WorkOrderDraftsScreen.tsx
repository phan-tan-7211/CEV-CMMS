import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  deleteWorkOrderDraft,
  flushDeferredWorkOrderDraftDiscards,
  listLocalWorkOrderDrafts,
  syncQueuedWorkOrderDrafts,
  type LocalWorkOrderDraft,
  type WorkOrderDraftSyncState,
} from '../features/work-orders'

const STATE_COPY: Record<WorkOrderDraftSyncState, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  LOCAL: { label: 'Trên thiết bị', icon: 'phone-portrait-outline' },
  SYNCED: { label: 'Đã đồng bộ', icon: 'cloud-done-outline' },
  QUEUED: { label: 'Chờ kết nối', icon: 'cloud-offline-outline' },
  ERROR: { label: 'Cần kiểm tra', icon: 'alert-circle-outline' },
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function draftTitle(draft: LocalWorkOrderDraft) {
  return draft.payload.reason.trim() || `Work Order · ${draft.payload.equipmentId}`
}

export function WorkOrderDraftsScreen({
  onBack,
  onResume,
}: {
  onBack: () => void
  onResume: (draft: LocalWorkOrderDraft) => void
}) {
  const [drafts, setDrafts] = useState<LocalWorkOrderDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      if (refresh) {
        await Promise.allSettled([
          syncQueuedWorkOrderDrafts(),
          flushDeferredWorkOrderDraftDiscards(),
        ])
      }
      setDrafts(await listLocalWorkOrderDrafts())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được bản nháp Work Order.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function confirmDelete(draft: LocalWorkOrderDraft) {
    Alert.alert('Xóa bản nháp?', 'Bản nháp sẽ được xóa khỏi thiết bị ngay lập tức.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void deleteWorkOrderDraft(draft.localId)
            .then(({ serverDiscardQueued }) => {
              setDrafts((current) => current.filter((item) => item.localId !== draft.localId))
              if (serverDiscardQueued) {
                Alert.alert('Đã xóa trên thiết bị', 'Lệnh xóa trên máy chủ sẽ tự hoàn tất khi có kết nối trở lại.')
              }
            })
            .catch((reason) => Alert.alert('Không thể xóa bản nháp', reason instanceof Error ? reason.message : 'Vui lòng thử lại.'))
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.headerIcon}>
          <Ionicons name="chevron-back" size={26} color="#101828" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Bản nháp Work Order</Text>
          <Text style={styles.subtitle}>{drafts.length} bản nháp trên thiết bị</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Làm mới" onPress={() => void load(true)} disabled={refreshing} style={styles.headerIcon}>
          {refreshing ? <ActivityIndicator size="small" color="#155EEF" /> : <Ionicons name="refresh" size={22} color="#155EEF" />}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={42} color="#B42318" />
          <Text style={styles.emptyTitle}>Không tải được bản nháp</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}><Text style={styles.retryText}>Thử lại</Text></Pressable>
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><Ionicons name="document-text-outline" size={34} color="#667085" /></View>
          <Text style={styles.emptyTitle}>Chưa có bản nháp</Text>
          <Text style={styles.emptyText}>Work Order đang soạn dở hoặc đang chờ gửi khi ngoại tuyến sẽ xuất hiện ở đây.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        >
          {drafts.map((draft) => {
            const state = STATE_COPY[draft.syncState]
            return (
              <View key={draft.localId} style={styles.card}>
                <Pressable onPress={() => onResume(draft)} style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
                  <View style={styles.rowTop}>
                    <View style={styles.assetBadge}><Ionicons name="cube-outline" size={16} color="#155EEF" /><Text style={styles.assetText}>{draft.payload.equipmentId}</Text></View>
                    <View style={[styles.stateBadge, draft.syncState === 'ERROR' && styles.stateError, draft.syncState === 'QUEUED' && styles.stateQueued]}>
                      <Ionicons name={state.icon} size={14} color={draft.syncState === 'ERROR' ? '#B42318' : '#475467'} />
                      <Text style={[styles.stateText, draft.syncState === 'ERROR' && styles.stateErrorText]}>{state.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={2}>{draftTitle(draft)}</Text>
                  <Text style={styles.meta}>{draft.payload.priority || 'MEDIUM'} · Cập nhật {formatUpdatedAt(draft.updatedAt)}</Text>
                  {draft.lastError && draft.syncState === 'ERROR' ? <Text style={styles.errorText} numberOfLines={2}>{draft.lastError}</Text> : null}
                  <View style={styles.resumeRow}><Text style={styles.resumeText}>Tiếp tục chỉnh sửa</Text><Ionicons name="chevron-forward" size={18} color="#155EEF" /></View>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Xóa bản nháp" onPress={() => confirmDelete(draft)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                  <Ionicons name="trash-outline" size={20} color="#B42318" />
                  <Text style={styles.deleteText}>Xóa</Text>
                </Pressable>
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 64, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  headerIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900', color: '#101828' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#667085' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAECF0' },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '900', color: '#101828' },
  emptyText: { marginTop: 7, textAlign: 'center', fontSize: 13.5, lineHeight: 20, color: '#667085' },
  retryButton: { marginTop: 18, minHeight: 44, paddingHorizontal: 20, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  retryText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { padding: 14, gap: 12, paddingBottom: 30 },
  card: { overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  cardMain: { padding: 15 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  assetBadge: { minHeight: 30, maxWidth: '58%', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 15, backgroundColor: '#EEF4FF' },
  assetText: { flexShrink: 1, fontSize: 12.5, fontWeight: '900', color: '#155EEF' },
  stateBadge: { minHeight: 29, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 15, backgroundColor: '#F2F4F7' },
  stateQueued: { backgroundColor: '#FFFAEB' },
  stateError: { backgroundColor: '#FEF3F2' },
  stateText: { fontSize: 11.5, fontWeight: '800', color: '#475467' },
  stateErrorText: { color: '#B42318' },
  cardTitle: { marginTop: 13, fontSize: 16, lineHeight: 22, fontWeight: '900', color: '#101828' },
  meta: { marginTop: 7, fontSize: 12, color: '#667085' },
  errorText: { marginTop: 8, fontSize: 12, lineHeight: 17, color: '#B42318' },
  resumeRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resumeText: { fontSize: 13.5, fontWeight: '900', color: '#155EEF' },
  deleteButton: { minHeight: 46, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0', backgroundColor: '#FFFBFA' },
  deleteText: { fontSize: 13.5, fontWeight: '900', color: '#B42318' },
  pressed: { opacity: 0.72 },
})
