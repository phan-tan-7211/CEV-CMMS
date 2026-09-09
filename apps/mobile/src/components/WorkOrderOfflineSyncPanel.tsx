import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import {
  discardOfflineWorkOrderAttachment,
  discardQueuedWorkOrderPartLabor,
  listOfflineWorkOrderAttachments,
  listQueuedWorkOrderPartLabor,
  listWorkOrderOfflineMutations,
  retryOfflineWorkOrderAttachment,
  retryQueuedWorkOrderPartLabor,
} from '../features/work-orders'
import { discardWorkOrderOfflineMutation, retryWorkOrderOfflineMutation } from '../features/work-orders/api/workOrderOfflineQueueControl'

type QueueSource = 'MUTATION' | 'ATTACHMENT' | 'PART_LABOR'
type QueueRow = {
  id: string
  source: QueueSource
  workOrderId: string
  kind: string
  state: 'PENDING' | 'ERROR'
  lastError: string
}

function kindLabel(kind: string) {
  if (kind === 'ADD_CHECKLIST') return 'Thêm checklist'
  if (kind === 'SET_CHECKLIST_COMPLETE') return 'Cập nhật checklist'
  if (kind === 'TRANSITION_STATUS') return 'Đổi trạng thái'
  if (kind === 'ISSUE_PART') return 'Xuất phụ tùng'
  if (kind === 'ADD_LABOR') return 'Ghi giờ công'
  if (kind === 'PHOTO') return 'Ảnh bảo trì'
  return 'Thay đổi ngoại tuyến'
}

export function WorkOrderOfflineSyncPanel() {
  const [rows, setRows] = useState<QueueRow[]>([])
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const [mutations, attachments, partLabor] = await Promise.all([
      listWorkOrderOfflineMutations(),
      listOfflineWorkOrderAttachments(),
      listQueuedWorkOrderPartLabor(),
    ])
    setRows([
      ...mutations.map((row) => ({ id: row.mutationId, source: 'MUTATION' as const, workOrderId: row.workOrderId, kind: row.kind, state: row.state, lastError: row.lastError || '' })),
      ...attachments.map((row) => ({ id: row.localId, source: 'ATTACHMENT' as const, workOrderId: row.workOrderId, kind: 'PHOTO', state: row.state, lastError: row.lastError || '' })),
      ...partLabor.map((row) => ({ id: row.mutationId, source: 'PART_LABOR' as const, workOrderId: row.workOrderId, kind: row.kind, state: row.state, lastError: row.lastError || '' })),
    ])
  }, [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => { void load() }, 5_000)
    return () => clearInterval(timer)
  }, [load])

  const pending = useMemo(() => rows.filter((row) => row.state === 'PENDING'), [rows])
  const errors = useMemo(() => rows.filter((row) => row.state === 'ERROR'), [rows])

  async function retry(row: QueueRow) {
    if (busyId) return
    setBusyId(row.id)
    try {
      if (row.source === 'MUTATION') await retryWorkOrderOfflineMutation(row.id)
      else if (row.source === 'ATTACHMENT') await retryOfflineWorkOrderAttachment(row.id)
      else await retryQueuedWorkOrderPartLabor(row.id)
    } finally {
      setBusyId('')
      await load()
    }
  }

  async function discard(row: QueueRow) {
    if (busyId) return
    setBusyId(row.id)
    try {
      if (row.source === 'MUTATION') await discardWorkOrderOfflineMutation(row.id)
      else if (row.source === 'ATTACHMENT') await discardOfflineWorkOrderAttachment(row.id)
      else await discardQueuedWorkOrderPartLabor(row.id)
    } finally {
      setBusyId('')
      await load()
    }
  }

  if (!rows.length) return null

  return (
    <View style={[styles.panel, errors.length ? styles.errorPanel : styles.pendingPanel]}>
      <View style={styles.summaryRow}>
        <Ionicons name={errors.length ? 'warning-outline' : 'cloud-upload-outline'} size={20} color={errors.length ? '#B42318' : '#175CD3'} />
        <View style={styles.summaryCopy}>
          <Text style={[styles.title, errors.length && styles.errorTitle]}>{errors.length ? 'Có thay đổi cần xử lý' : 'Đang chờ đồng bộ'}</Text>
          <Text style={styles.subtitle}>{pending.length} đang chờ · {errors.length} lỗi</Text>
        </View>
      </View>
      {!errors.length ? <Text style={styles.autoText}>Không cần bấm Sync. Ứng dụng sẽ tự gửi khi có mạng.</Text> : null}
      {errors.slice(0, 5).map((row) => (
        <View key={`${row.source}:${row.id}`} style={styles.errorRow}>
          <View style={styles.errorCopy}>
            <Text style={styles.errorName}>{row.workOrderId} · {kindLabel(row.kind)}</Text>
            <Text style={styles.errorMessage} numberOfLines={2}>{row.lastError || 'Máy chủ từ chối thay đổi này.'}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable disabled={Boolean(busyId)} onPress={() => { void retry(row) }} style={styles.retryButton} accessibilityRole="button"><Text style={styles.retryText}>{busyId === row.id ? '...' : 'Thử lại'}</Text></Pressable>
            <Pressable disabled={Boolean(busyId)} onPress={() => { void discard(row) }} style={styles.discardButton} accessibilityRole="button"><Text style={styles.discardText}>Bỏ</Text></Pressable>
          </View>
        </View>
      ))}
      {busyId ? <ActivityIndicator size="small" color="#155EEF" style={styles.spinner} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 14, marginTop: 10, padding: 13, borderRadius: 14, borderWidth: 1 },
  pendingPanel: { borderColor: '#B2DDFF', backgroundColor: '#EFF8FF' },
  errorPanel: { borderColor: '#FECDCA', backgroundColor: '#FEF3F2' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  summaryCopy: { flex: 1 },
  title: { fontSize: 13, fontWeight: '900', color: '#175CD3' },
  errorTitle: { color: '#B42318' },
  subtitle: { marginTop: 2, fontSize: 11.5, color: '#667085' },
  autoText: { marginTop: 8, fontSize: 11.5, lineHeight: 16, color: '#475467' },
  errorRow: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#FDA29B', gap: 8 },
  errorCopy: { flex: 1 },
  errorName: { fontSize: 12, fontWeight: '900', color: '#344054' },
  errorMessage: { marginTop: 3, fontSize: 11, lineHeight: 15, color: '#B42318' },
  actions: { flexDirection: 'row', gap: 8 },
  retryButton: { minHeight: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#155EEF' },
  retryText: { fontSize: 11.5, fontWeight: '900', color: '#FFFFFF' },
  discardButton: { minHeight: 36, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#FDA29B', backgroundColor: '#FFFFFF' },
  discardText: { fontSize: 11.5, fontWeight: '900', color: '#B42318' },
  spinner: { marginTop: 8 },
})
