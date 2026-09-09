import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import {
  cancelWorkOrderTimer,
  getWorkOrderTimerState,
  pauseWorkOrderTimer,
  resumeWorkOrderTimer,
  startWorkOrderTimer,
  stopWorkOrderTimer,
  type WorkOrderTimerState,
} from '../features/work-orders/api/workOrderTimerService'

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':')
}

const EMPTY: WorkOrderTimerState = {
  active: false, timerId: '', workOrderId: '', personId: '', status: '', startedAt: '', runningSince: '', pausedAt: '', elapsedSeconds: 0, hourlyRate: null, note: '',
}

export function WorkOrderTimerCard({ workOrderId, enabled, onLaborCreated }: {
  workOrderId: string
  enabled: boolean
  onLaborCreated?: () => void | Promise<void>
}) {
  const [timer, setTimer] = useState<WorkOrderTimerState>(EMPTY)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function reload() {
    try {
      const next = await getWorkOrderTimerState(workOrderId)
      setTimer(next)
      setDisplaySeconds(next.elapsedSeconds)
      if (next.note && !note) setNote(next.note)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được bộ đếm giờ công.')
    }
  }

  useEffect(() => { void reload() }, [workOrderId])

  useEffect(() => {
    setDisplaySeconds(timer.elapsedSeconds)
    if (!timer.active || timer.status !== 'RUNNING') return undefined
    const started = Date.now()
    const baseline = timer.elapsedSeconds
    const id = setInterval(() => {
      setDisplaySeconds(baseline + Math.max(0, Math.floor((Date.now() - started) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [timer.active, timer.elapsedSeconds, timer.status])

  const statusText = useMemo(() => {
    if (!timer.active) return 'Chưa chạy'
    return timer.status === 'RUNNING' ? 'Đang tính giờ' : 'Đã tạm dừng'
  }, [timer.active, timer.status])

  async function run(task: () => Promise<unknown>, after?: () => void | Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await task()
      await reload()
      await after?.()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không cập nhật được bộ đếm giờ công.')
    } finally { setBusy(false) }
  }

  function confirmStop() {
    if (!timer.timerId) return
    Alert.alert('Dừng bộ đếm?', 'Thời gian đã chạy sẽ được ghi thành giờ công của bạn cho Work Order này.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Dừng & ghi giờ công', onPress: () => void run(() => stopWorkOrderTimer(timer.timerId, note), onLaborCreated) },
    ])
  }

  function confirmCancel() {
    if (!timer.timerId) return
    Alert.alert('Hủy bộ đếm?', 'Phiên tính giờ này sẽ không tạo giờ công.', [
      { text: 'Quay lại', style: 'cancel' },
      { text: 'Hủy phiên', style: 'destructive', onPress: () => void run(() => cancelWorkOrderTimer(timer.timerId)) },
    ])
  }

  return <View style={styles.card}>
    <View style={styles.topRow}>
      <View style={styles.iconWrap}><Ionicons name="timer-outline" size={22} color="#155EEF" /></View>
      <View style={styles.flex}><Text style={styles.label}>BỘ ĐẾM GIỜ CÔNG</Text><Text style={styles.status}>{statusText}</Text></View>
      <Text style={styles.clock}>{formatElapsed(displaySeconds)}</Text>
    </View>

    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!enabled && !timer.active ? <Text style={styles.hint}>Timer khả dụng khi Work Order đang thực hiện.</Text> : null}

    {(enabled || timer.active) ? <TextInput
      value={note}
      onChangeText={setNote}
      placeholder="Ghi chú công việc (tùy chọn)"
      placeholderTextColor="#98A2B3"
      editable={!busy}
      style={styles.input}
    /> : null}

    <View style={styles.actions}>
      {!timer.active ? <Action label="Bắt đầu" icon="play" disabled={!enabled || busy} onPress={() => void run(() => startWorkOrderTimer(workOrderId, note))} /> : null}
      {timer.active && timer.status === 'RUNNING' ? <Action label="Tạm dừng" icon="pause" disabled={busy} secondary onPress={() => void run(() => pauseWorkOrderTimer(timer.timerId))} /> : null}
      {timer.active && timer.status === 'PAUSED' ? <Action label="Tiếp tục" icon="play" disabled={busy} onPress={() => void run(() => resumeWorkOrderTimer(timer.timerId))} /> : null}
      {timer.active ? <Action label="Dừng" icon="stop" disabled={busy} onPress={confirmStop} /> : null}
      {timer.active ? <Action label="Hủy phiên" icon="close" disabled={busy} danger onPress={confirmCancel} /> : null}
    </View>
  </View>
}

function Action({ label, icon, onPress, disabled, secondary, danger }: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  disabled?: boolean
  secondary?: boolean
  danger?: boolean
}) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.buttonSecondary, danger && styles.buttonDanger, disabled && styles.disabled]}>
    <Ionicons name={icon} size={16} color={secondary ? '#344054' : '#FFF'} />
    <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{label}</Text>
  </Pressable>
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: '#D6E4FF', backgroundColor: '#F8FAFF', borderRadius: 12, padding: 12, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EAF0FF', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 }, label: { fontSize: 10, fontWeight: '800', color: '#667085', letterSpacing: 0.5 }, status: { marginTop: 2, fontSize: 13, fontWeight: '700', color: '#344054' },
  clock: { fontVariant: ['tabular-nums'], fontSize: 24, fontWeight: '900', color: '#101828', letterSpacing: 0.5 },
  input: { minHeight: 42, borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 9, paddingHorizontal: 11, color: '#101828', backgroundColor: '#FFF' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 38, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#155EEF', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D0D5DD' }, buttonDanger: { backgroundColor: '#D92D20' }, disabled: { opacity: 0.45 },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 12 }, buttonTextSecondary: { color: '#344054' },
  error: { color: '#B42318', fontSize: 12 }, hint: { color: '#667085', fontSize: 12 },
})
