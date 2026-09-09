import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  getSchedulerRole,
  listSchedulerConflicts,
  listSchedulerEvents,
  listSchedulerOptions,
  rescheduleWorkOrder,
  setWorkOrderScheduleLock,
  type SchedulerEvent,
  type SchedulerOption,
  type SchedulerRole,
  type SchedulerViewMode,
} from '../features/scheduler'

const DAY_MS = 24 * 60 * 60 * 1000
const HOURS = Array.from({ length: 16 }, (_, index) => index + 6)
const DURATIONS = [30, 60, 90, 120, 180, 240]

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }
function addDays(date: Date, count: number) { return new Date(startOfDay(date).getTime() + count * DAY_MS) }
function startOfWeek(date: Date) {
  const day = startOfDay(date)
  const weekday = day.getDay() || 7
  return addDays(day, 1 - weekday)
}
function startOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth(), 1) }
function endOfMonth(date: Date) { return new Date(date.getFullYear(), date.getMonth() + 1, 1) }
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
function sameDay(value: string, date: Date) {
  if (!value) return false
  const parsed = new Date(value)
  return parsed.getFullYear() === date.getFullYear() && parsed.getMonth() === date.getMonth() && parsed.getDate() === date.getDate()
}
function timeText(value: string) {
  if (!value) return 'Chưa xếp lịch'
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
function dateText(value: string) {
  if (!value) return 'Chưa xếp lịch'
  return new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function durationMinutes(event: SchedulerEvent) {
  if (!event.startAt || !event.endAt) return 60
  const minutes = Math.round((new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60
}
function viewRange(view: SchedulerViewMode, anchor: Date) {
  if (view === 'DAY') return { start: startOfDay(anchor), end: addDays(anchor, 1) }
  if (view === 'WEEK') {
    const start = startOfWeek(anchor)
    return { start, end: addDays(start, 7) }
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
}
function viewDays(view: SchedulerViewMode, anchor: Date) {
  if (view === 'DAY') return [startOfDay(anchor)]
  if (view === 'WEEK') {
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }
  const first = startOfMonth(anchor)
  const count = Math.round((endOfMonth(anchor).getTime() - first.getTime()) / DAY_MS)
  return Array.from({ length: count }, (_, index) => addDays(first, index))
}
function viewTitle(view: SchedulerViewMode, anchor: Date) {
  if (view === 'DAY') return anchor.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
  if (view === 'WEEK') {
    const start = startOfWeek(anchor)
    return `${start.toLocaleDateString('vi-VN')} – ${addDays(start, 6).toLocaleDateString('vi-VN')}`
  }
  return anchor.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
}
function roleCanManage(role: SchedulerRole) { return ['SUPERVISOR', 'MANAGER', 'ADMIN'].includes(role) }
function roleCanLock(role: SchedulerRole) { return ['MANAGER', 'ADMIN'].includes(role) }

export function SchedulerScreen({ onBack, onOpenWorkOrder }: { onBack: () => void; onOpenWorkOrder: (workOrderId: string) => void }) {
  const [view, setView] = useState<SchedulerViewMode>('WEEK')
  const [anchor, setAnchor] = useState(() => new Date())
  const [events, setEvents] = useState<SchedulerEvent[]>([])
  const [locations, setLocations] = useState<SchedulerOption[]>([])
  const [people, setPeople] = useState<SchedulerOption[]>([])
  const [teams, setTeams] = useState<SchedulerOption[]>([])
  const [locationId, setLocationId] = useState('')
  const [personId, setPersonId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [role, setRole] = useState<SchedulerRole>('UNKNOWN')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SchedulerEvent | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<SchedulerEvent | null>(null)
  const [choice, setChoice] = useState<'location' | 'person-filter' | 'team-filter' | 'person-schedule' | 'team-schedule' | null>(null)
  const [scheduleDate, setScheduleDate] = useState(() => startOfDay(new Date()))
  const [scheduleHour, setScheduleHour] = useState(8)
  const [scheduleDuration, setScheduleDuration] = useState(60)
  const [schedulePersonId, setSchedulePersonId] = useState('')
  const [scheduleTeamId, setScheduleTeamId] = useState('')
  const [saving, setSaving] = useState(false)

  const range = useMemo(() => viewRange(view, anchor), [anchor, view])
  const days = useMemo(() => viewDays(view, anchor), [anchor, view])
  const canManage = roleCanManage(role)
  const canLock = roleCanLock(role)

  const load = useCallback(async (pull = false) => {
    pull ? setRefreshing(true) : setLoading(true)
    try {
      const rows = await listSchedulerEvents({
        startAt: range.start.toISOString(),
        endAt: range.end.toISOString(),
        locationId,
        personId,
        teamId,
      })
      setEvents(rows)
      setSelected((current) => current ? rows.find((item) => item.eventId === current.eventId) || current : null)
      setError('')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không tải được lịch công việc.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [locationId, personId, range.end, range.start, teamId])

  useEffect(() => {
    Promise.all([listSchedulerOptions(), getSchedulerRole()])
      .then(([options, currentRole]) => {
        setLocations(options.locations)
        setPeople(options.people)
        setTeams(options.teams)
        setRole(currentRole)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không tải được cấu hình Scheduler.'))
  }, [])

  useEffect(() => { void load() }, [load])

  const unscheduled = useMemo(() => events.filter((item) => item.unscheduled && item.eventType === 'WORK_ORDER'), [events])
  const scheduled = useMemo(() => events.filter((item) => !item.unscheduled), [events])

  function shift(direction: -1 | 1) {
    const next = new Date(anchor)
    if (view === 'DAY') next.setDate(next.getDate() + direction)
    else if (view === 'WEEK') next.setDate(next.getDate() + direction * 7)
    else next.setMonth(next.getMonth() + direction)
    setAnchor(next)
  }

  function openSchedule(event: SchedulerEvent, date?: Date) {
    if (!canManage || event.eventType !== 'WORK_ORDER' || event.scheduleLocked) return
    const currentStart = event.startAt ? new Date(event.startAt) : null
    setScheduleTarget(event)
    setScheduleDate(startOfDay(date || currentStart || anchor))
    setScheduleHour(currentStart?.getHours() ?? 8)
    setScheduleDuration(durationMinutes(event))
    setSchedulePersonId(event.primaryPersonId)
    setScheduleTeamId(event.primaryTeamId)
  }

  async function saveSchedule(allowConflict = false) {
    if (!scheduleTarget?.workOrderId) return
    const start = new Date(scheduleDate.getFullYear(), scheduleDate.getMonth(), scheduleDate.getDate(), scheduleHour, 0, 0)
    const end = new Date(start.getTime() + scheduleDuration * 60000)
    setSaving(true)
    try {
      if (!allowConflict) {
        const conflicts = await listSchedulerConflicts({
          workOrderId: scheduleTarget.workOrderId,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          personId: schedulePersonId,
          teamId: scheduleTeamId,
        })
        if (conflicts.length) {
          setSaving(false)
          Alert.alert(
            'Xung đột lịch trình',
            conflicts.slice(0, 4).map((item) => `${item.conflictType}: ${item.resourceName} · ${item.conflictingWorkOrderId}`).join('\n'),
            [
              { text: 'Hủy', style: 'cancel' },
              { text: 'Vẫn xếp lịch', style: 'destructive', onPress: () => void saveSchedule(true) },
            ],
          )
          return
        }
      }
      await rescheduleWorkOrder({
        workOrderId: scheduleTarget.workOrderId,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        personId: schedulePersonId,
        teamId: scheduleTeamId,
        allowConflict,
      })
      setScheduleTarget(null)
      setSelected(null)
      await load(true)
    } catch (cause: unknown) {
      Alert.alert('Không lưu được lịch', cause instanceof Error ? cause.message : 'Có lỗi khi cập nhật Work Order.')
    } finally { setSaving(false) }
  }

  async function unschedule(event: SchedulerEvent) {
    if (!event.workOrderId || !canManage || event.scheduleLocked) return
    try {
      setSaving(true)
      await rescheduleWorkOrder({ workOrderId: event.workOrderId, startAt: null, endAt: null })
      setSelected(null)
      await load(true)
    } catch (cause: unknown) {
      Alert.alert('Không bỏ được lịch', cause instanceof Error ? cause.message : 'Có lỗi khi cập nhật Work Order.')
    } finally { setSaving(false) }
  }

  async function toggleLock(event: SchedulerEvent) {
    if (!event.workOrderId || !canLock) return
    try {
      setSaving(true)
      await setWorkOrderScheduleLock(event.workOrderId, !event.scheduleLocked)
      await load(true)
    } catch (cause: unknown) {
      Alert.alert('Không đổi được khóa lịch', cause instanceof Error ? cause.message : 'Có lỗi khi cập nhật Work Order.')
    } finally { setSaving(false) }
  }

  const selectedLocation = locations.find((item) => item.id === locationId)?.label || 'Tất cả vị trí'
  const selectedPerson = people.find((item) => item.id === personId)?.label || 'Tất cả kỹ thuật viên'
  const selectedTeam = teams.find((item) => item.id === teamId)?.label || 'Tất cả nhóm'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.headerButton}><Ionicons name="chevron-back" size={24} color="#101828" /></Pressable>
          <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>Lịch trình</Text><Text style={styles.headerSubtitle}>Work Order & PM</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Làm mới" onPress={() => void load(true)} style={styles.headerButton}><Ionicons name="refresh" size={20} color="#155EEF" /></Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.viewSwitch}>{(['MONTH', 'WEEK', 'DAY'] as SchedulerViewMode[]).map((item) => <Pressable key={item} onPress={() => setView(item)} style={[styles.switchButton, view === item && styles.switchButtonActive]}><Text style={[styles.switchText, view === item && styles.switchTextActive]}>{item === 'MONTH' ? 'Tháng' : item === 'WEEK' ? 'Tuần' : 'Ngày'}</Text></Pressable>)}</View>

          <View style={styles.dateNav}>
            <Pressable onPress={() => shift(-1)} style={styles.navButton}><Ionicons name="chevron-back" size={20} color="#344054" /></Pressable>
            <Pressable onPress={() => setAnchor(new Date())} style={styles.dateTitleWrap}><Text style={styles.dateTitle}>{viewTitle(view, anchor)}</Text><Text style={styles.todayHint}>Chạm để về hôm nay</Text></Pressable>
            <Pressable onPress={() => shift(1)} style={styles.navButton}><Ionicons name="chevron-forward" size={20} color="#344054" /></Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <FilterChip icon="location-outline" label={selectedLocation} active={Boolean(locationId)} onPress={() => setChoice('location')} />
            <FilterChip icon="person-outline" label={selectedPerson} active={Boolean(personId)} onPress={() => setChoice('person-filter')} />
            <FilterChip icon="people-outline" label={selectedTeam} active={Boolean(teamId)} onPress={() => setChoice('team-filter')} />
          </ScrollView>

          {!canManage ? <View style={styles.readonlyBanner}><Ionicons name="eye-outline" size={17} color="#B54708" /><Text>Vai trò {role}: chỉ xem. Supervisor/Manager/Admin mới được xếp lại lịch.</Text></View> : null}
          {error ? <View style={styles.errorBanner}><Text>{error}</Text></View> : null}

          <SectionTitle title="Chưa xếp lịch" count={unscheduled.length} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.backlogRow}>
            {unscheduled.map((event) => <EventCard key={event.eventId} event={event} onPress={() => setSelected(event)} onSchedule={canManage ? () => openSchedule(event) : undefined} compact />)}
            {!unscheduled.length && !loading ? <View style={styles.emptyBacklog}><Text style={styles.emptyText}>Không có Work Order chưa xếp lịch.</Text></View> : null}
          </ScrollView>

          <SectionTitle title={view === 'MONTH' ? 'Lịch tháng' : view === 'WEEK' ? 'Lịch tuần' : 'Lịch ngày'} count={scheduled.length} />
          {loading ? <View style={styles.loading}><ActivityIndicator color="#155EEF" /><Text>Đang tải lịch…</Text></View> : null}
          {!loading ? days.map((day) => {
            const items = scheduled.filter((event) => sameDay(event.startAt, day)).sort((a, b) => a.startAt.localeCompare(b.startAt))
            if (view === 'MONTH' && !items.length) return null
            return <View key={dayKey(day)} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <View><Text style={styles.dayName}>{day.toLocaleDateString('vi-VN', { weekday: 'long' })}</Text><Text style={styles.dayDate}>{day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: view === 'DAY' ? 'numeric' : undefined })}</Text></View>
                {canManage && unscheduled.length ? <Pressable onPress={() => openSchedule(unscheduled[0]!, day)} style={styles.quickSchedule}><Ionicons name="add" size={16} color="#155EEF" /><Text>Xếp việc</Text></Pressable> : null}
              </View>
              {items.length ? items.map((event) => <EventCard key={event.eventId} event={event} onPress={() => setSelected(event)} />) : <Text style={styles.noEvents}>Không có công việc trong ngày.</Text>}
            </View>
          }) : null}
        </ScrollView>
      </View>

      <ChoiceSheet
        visible={Boolean(choice)}
        title={choice?.startsWith('person') ? 'Chọn kỹ thuật viên' : choice?.startsWith('team') ? 'Chọn nhóm' : 'Chọn vị trí'}
        options={choice?.startsWith('person') ? people : choice?.startsWith('team') ? teams : locations}
        selectedId={choice === 'person-schedule' ? schedulePersonId : choice === 'team-schedule' ? scheduleTeamId : choice === 'person-filter' ? personId : choice === 'team-filter' ? teamId : locationId}
        allowAll={!choice?.endsWith('schedule')}
        onClose={() => setChoice(null)}
        onSelect={(id) => {
          if (choice === 'person-schedule') setSchedulePersonId(id)
          else if (choice === 'team-schedule') setScheduleTeamId(id)
          else if (choice === 'person-filter') setPersonId(id)
          else if (choice === 'team-filter') setTeamId(id)
          else setLocationId(id)
          setChoice(null)
        }}
      />

      <ScheduleSheet
        event={scheduleTarget}
        date={scheduleDate}
        hour={scheduleHour}
        duration={scheduleDuration}
        personLabel={people.find((item) => item.id === schedulePersonId)?.label || 'Chưa giao người'}
        teamLabel={teams.find((item) => item.id === scheduleTeamId)?.label || 'Chưa giao nhóm'}
        saving={saving}
        onClose={() => setScheduleTarget(null)}
        onDate={setScheduleDate}
        onHour={setScheduleHour}
        onDuration={setScheduleDuration}
        onPerson={() => setChoice('person-schedule')}
        onTeam={() => setChoice('team-schedule')}
        onSave={() => void saveSchedule(false)}
      />

      <EventDetailSheet
        event={selected}
        canManage={canManage}
        canLock={canLock}
        saving={saving}
        onClose={() => setSelected(null)}
        onOpen={() => selected?.workOrderId && onOpenWorkOrder(selected.workOrderId)}
        onSchedule={() => selected && openSchedule(selected)}
        onUnschedule={() => selected && void unschedule(selected)}
        onToggleLock={() => selected && void toggleLock(selected)}
      />
    </SafeAreaView>
  )
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <View style={styles.sectionTitle}><Text style={styles.sectionTitleText}>{title}</Text><View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View></View>
}

function FilterChip({ icon, label, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Ionicons name={icon} size={16} color={active ? '#155EEF' : '#475467'} /><Text numberOfLines={1} style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text><Ionicons name="chevron-down" size={14} color="#667085" /></Pressable>
}

function EventCard({ event, onPress, onSchedule, compact = false }: { event: SchedulerEvent; onPress: () => void; onSchedule?: () => void; compact?: boolean }) {
  const pm = event.eventType === 'PM_DUE'
  const accent = pm ? '#7F56D9' : event.priority === 'CRITICAL' ? '#D92D20' : event.priority === 'HIGH' ? '#F79009' : '#155EEF'
  return <Pressable onPress={onPress} style={[styles.eventCard, compact && styles.eventCardCompact, { borderLeftColor: accent }]}>
    <View style={styles.eventTop}><Text style={[styles.eventType, { color: accent }]}>{pm ? 'PM ĐẾN HẠN' : event.unscheduled ? 'CHƯA XẾP' : `${timeText(event.startAt)}–${timeText(event.endAt)}`}</Text>{event.scheduleLocked || pm ? <Ionicons name="lock-closed" size={13} color="#667085" /> : null}</View>
    <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
    <Text style={styles.eventMeta} numberOfLines={1}>{event.equipmentId} · {event.equipmentName || 'Thiết bị'}</Text>
    {event.primaryPersonName ? <Text style={styles.eventMeta} numberOfLines={1}>👤 {event.primaryPersonName}</Text> : null}
    {onSchedule ? <Pressable onPress={(pressEvent) => { pressEvent.stopPropagation(); onSchedule() }} style={styles.scheduleButton}><Text style={styles.scheduleButtonText}>Xếp lịch</Text></Pressable> : null}
  </Pressable>
}

function ChoiceSheet({ visible, title, options, selectedId, allowAll, onClose, onSelect }: { visible: boolean; title: string; options: SchedulerOption[]; selectedId: string; allowAll: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.choiceSheet} onPress={() => {}}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{title}</Text><Pressable onPress={onClose}><Ionicons name="close" size={24} color="#344054" /></Pressable></View>
        <ScrollView style={styles.choiceList}>
          {allowAll ? <ChoiceRow label="Tất cả" selected={!selectedId} onPress={() => onSelect('')} /> : <ChoiceRow label="Không phân công" selected={!selectedId} onPress={() => onSelect('')} />}
          {options.map((item) => <ChoiceRow key={item.id} label={item.label} selected={item.id === selectedId} onPress={() => onSelect(item.id)} />)}
        </ScrollView>
      </Pressable>
    </Pressable>
  </Modal>
}

function ChoiceRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.choiceRow}><Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>{selected ? <Ionicons name="checkmark-circle" size={22} color="#155EEF" /> : null}</Pressable>
}

function ScheduleSheet({ event, date, hour, duration, personLabel, teamLabel, saving, onClose, onDate, onHour, onDuration, onPerson, onTeam, onSave }: {
  event: SchedulerEvent | null; date: Date; hour: number; duration: number; personLabel: string; teamLabel: string; saving: boolean
  onClose: () => void; onDate: (date: Date) => void; onHour: (hour: number) => void; onDuration: (minutes: number) => void; onPerson: () => void; onTeam: () => void; onSave: () => void
}) {
  const dateChoices = Array.from({ length: 14 }, (_, index) => addDays(new Date(), index))
  return <Modal visible={Boolean(event)} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.scheduleSheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>Xếp lịch Work Order</Text><Text style={styles.sheetSubtitle}>{event?.workOrderId} · {event?.equipmentId}</Text></View><Pressable onPress={onClose}><Ionicons name="close" size={24} color="#344054" /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.fieldLabel}>Ngày thực hiện</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>{dateChoices.map((item) => <Pressable key={dayKey(item)} onPress={() => onDate(item)} style={[styles.dateChip, sameDay(dayKey(item), date) && styles.dateChipActive]}><Text style={[styles.dateChipWeekday, sameDay(dayKey(item), date) && styles.dateChipTextActive]}>{item.toLocaleDateString('vi-VN', { weekday: 'short' })}</Text><Text style={[styles.dateChipDay, sameDay(dayKey(item), date) && styles.dateChipTextActive]}>{item.getDate()}</Text></Pressable>)}</ScrollView>
          <Text style={styles.fieldLabel}>Giờ bắt đầu</Text>
          <View style={styles.wrapOptions}>{HOURS.map((item) => <Pressable key={item} onPress={() => onHour(item)} style={[styles.optionChip, hour === item && styles.optionChipActive]}><Text style={[styles.optionChipText, hour === item && styles.optionChipTextActive]}>{String(item).padStart(2, '0')}:00</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Thời lượng</Text>
          <View style={styles.wrapOptions}>{DURATIONS.map((item) => <Pressable key={item} onPress={() => onDuration(item)} style={[styles.optionChip, duration === item && styles.optionChipActive]}><Text style={[styles.optionChipText, duration === item && styles.optionChipTextActive]}>{item < 60 ? `${item}p` : `${item / 60}h`}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>Nguồn lực</Text>
          <Pressable onPress={onPerson} style={styles.resourceRow}><Ionicons name="person-outline" size={20} color="#475467" /><Text>{personLabel}</Text><Ionicons name="chevron-forward" size={18} color="#98A2B3" /></Pressable>
          <Pressable onPress={onTeam} style={styles.resourceRow}><Ionicons name="people-outline" size={20} color="#475467" /><Text>{teamLabel}</Text><Ionicons name="chevron-forward" size={18} color="#98A2B3" /></Pressable>
        </ScrollView>
        <Pressable disabled={saving} onPress={onSave} style={[styles.primaryButton, saving && styles.disabledButton]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Lưu lịch trình</Text>}</Pressable>
      </View>
    </View>
  </Modal>
}

function EventDetailSheet({ event, canManage, canLock, saving, onClose, onOpen, onSchedule, onUnschedule, onToggleLock }: {
  event: SchedulerEvent | null; canManage: boolean; canLock: boolean; saving: boolean
  onClose: () => void; onOpen: () => void; onSchedule: () => void; onUnschedule: () => void; onToggleLock: () => void
}) {
  if (!event) return null
  return <Modal visible animationType="slide" transparent onRequestClose={onClose}>
    <Pressable style={styles.modalBackdrop} onPress={onClose}>
      <Pressable style={styles.detailSheet} onPress={() => {}}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}><View style={styles.detailTitleWrap}><Text style={styles.sheetSubtitle}>{event.eventType === 'PM_DUE' ? 'PM ĐẾN HẠN' : event.workOrderId}</Text><Text style={styles.sheetTitle}>{event.title}</Text></View><Pressable onPress={onClose}><Ionicons name="close" size={24} color="#344054" /></Pressable></View>
        <View style={styles.detailGrid}>
          <DetailCell label="Thiết bị" value={event.equipmentId} sub={event.equipmentName} />
          <DetailCell label="Thời gian" value={dateText(event.startAt)} sub={event.endAt ? `Đến ${dateText(event.endAt)}` : ''} />
          <DetailCell label="Người phụ trách" value={event.primaryPersonName || 'Chưa giao'} sub={event.primaryTeamName || 'Chưa có nhóm'} />
          <DetailCell label="Trạng thái" value={event.status} sub={event.priority || 'Không đặt ưu tiên'} />
        </View>
        {event.eventType === 'WORK_ORDER' ? <View style={styles.detailActions}>
          <Pressable onPress={onOpen} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Mở Work Order</Text></Pressable>
          {canManage && !event.scheduleLocked ? <Pressable onPress={onSchedule} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{event.unscheduled ? 'Xếp lịch' : 'Đổi lịch'}</Text></Pressable> : null}
          {canManage && !event.unscheduled && !event.scheduleLocked ? <Pressable disabled={saving} onPress={onUnschedule} style={styles.dangerButton}><Text style={styles.dangerButtonText}>Bỏ lịch</Text></Pressable> : null}
          {canLock ? <Pressable disabled={saving} onPress={onToggleLock} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{event.scheduleLocked ? 'Mở khóa' : 'Khóa lịch'}</Text></Pressable> : null}
        </View> : <Text style={styles.pmReadOnly}>PM đến hạn được điều khiển từ kế hoạch bảo trì định kỳ.</Text>}
      </Pressable>
    </Pressable>
  </Modal>
}

function DetailCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <View style={styles.detailCell}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text>{sub ? <Text style={styles.detailSub}>{sub}</Text> : null}</View>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' }, shell: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, headerTitleWrap: { flex: 1, alignItems: 'center' }, headerTitle: { fontSize: 19, fontWeight: '900', color: '#101828' }, headerSubtitle: { fontSize: 11, color: '#667085' },
  content: { flex: 1 }, contentContainer: { padding: 14, paddingBottom: 32, gap: 12 },
  viewSwitch: { flexDirection: 'row', padding: 4, backgroundColor: '#EAECF0', borderRadius: 12 }, switchButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, switchButtonActive: { backgroundColor: '#FFFFFF' }, switchText: { color: '#667085', fontWeight: '700' }, switchTextActive: { color: '#101828' },
  dateNav: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', padding: 8 }, navButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, dateTitleWrap: { flex: 1, alignItems: 'center' }, dateTitle: { fontSize: 16, fontWeight: '900', color: '#101828', textTransform: 'capitalize' }, todayHint: { fontSize: 10, color: '#98A2B3', marginTop: 2 },
  filterRow: { gap: 8, paddingRight: 8 }, filterChip: { maxWidth: 220, height: 38, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 19, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' }, filterChipActive: { borderColor: '#84ADFF', backgroundColor: '#EFF4FF' }, filterChipText: { maxWidth: 160, fontSize: 12, fontWeight: '700', color: '#475467' }, filterChipTextActive: { color: '#155EEF' },
  readonlyBanner: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: '#FFFAEB' }, errorBanner: { padding: 10, borderRadius: 10, backgroundColor: '#FEF3F2' },
  sectionTitle: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }, sectionTitleText: { fontSize: 17, fontWeight: '900', color: '#101828' }, countBadge: { minWidth: 26, height: 26, paddingHorizontal: 7, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAECF0' }, countText: { fontSize: 12, fontWeight: '900', color: '#475467' },
  backlogRow: { gap: 9, minHeight: 120 }, emptyBacklog: { width: 260, minHeight: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D0D5DD' }, emptyText: { color: '#98A2B3', textAlign: 'center' },
  loading: { padding: 24, alignItems: 'center', gap: 8 },
  daySection: { padding: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAECF0', gap: 8 }, dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, dayName: { fontSize: 14, fontWeight: '900', color: '#101828', textTransform: 'capitalize' }, dayDate: { fontSize: 11, color: '#667085', marginTop: 2 }, quickSchedule: { flexDirection: 'row', gap: 3, alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: '#EFF4FF' }, noEvents: { color: '#98A2B3', fontSize: 12, paddingVertical: 8 },
  eventCard: { borderLeftWidth: 4, borderWidth: 1, borderColor: '#EAECF0', borderRadius: 11, backgroundColor: '#FFFFFF', padding: 10, gap: 4 }, eventCardCompact: { width: 240, minHeight: 115 }, eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eventType: { fontSize: 10, fontWeight: '900' }, eventTitle: { fontSize: 14, fontWeight: '800', color: '#101828' }, eventMeta: { fontSize: 11, color: '#667085' }, scheduleButton: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#155EEF', borderRadius: 8 }, scheduleButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' }, choiceSheet: { maxHeight: '70%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 24 }, scheduleSheet: { maxHeight: '88%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 20 }, detailSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingBottom: 24 }, sheetHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D0D5DD', alignSelf: 'center', marginTop: 8, marginBottom: 10 }, sheetHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sheetTitle: { fontSize: 18, fontWeight: '900', color: '#101828' }, sheetSubtitle: { fontSize: 11, color: '#667085', marginTop: 2 }, choiceList: { maxHeight: 440 }, choiceRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, choiceLabel: { flex: 1, fontSize: 15, color: '#344054' }, choiceLabelSelected: { color: '#155EEF', fontWeight: '800' },
  fieldLabel: { marginTop: 13, marginBottom: 7, fontSize: 12, fontWeight: '900', color: '#475467' }, optionRow: { gap: 7, paddingRight: 12 }, dateChip: { width: 52, height: 62, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, dateChipActive: { backgroundColor: '#155EEF', borderColor: '#155EEF' }, dateChipWeekday: { fontSize: 10, color: '#667085', textTransform: 'uppercase' }, dateChipDay: { fontSize: 18, fontWeight: '900', color: '#101828' }, dateChipTextActive: { color: '#FFFFFF' }, wrapOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, optionChip: { minWidth: 64, paddingHorizontal: 10, height: 38, borderRadius: 9, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center' }, optionChipActive: { backgroundColor: '#EFF4FF', borderColor: '#84ADFF' }, optionChipText: { fontSize: 12, fontWeight: '700', color: '#475467' }, optionChipTextActive: { color: '#155EEF' }, resourceRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, resourceRowText: { flex: 1 },
  primaryButton: { minHeight: 50, marginTop: 16, borderRadius: 11, backgroundColor: '#155EEF', alignItems: 'center', justifyContent: 'center' }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' }, disabledButton: { opacity: 0.55 },
  detailTitleWrap: { flex: 1 }, detailGrid: { display: 'flex', gap: 8 }, detailCell: { padding: 10, backgroundColor: '#F9FAFB', borderRadius: 10 }, detailLabel: { fontSize: 10, color: '#667085', fontWeight: '700' }, detailValue: { marginTop: 2, fontSize: 14, color: '#101828', fontWeight: '800' }, detailSub: { marginTop: 2, fontSize: 11, color: '#667085' }, detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }, secondaryButton: { paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: '#D0D5DD' }, secondaryButtonText: { color: '#344054', fontWeight: '800' }, dangerButton: { paddingHorizontal: 12, minHeight: 40, justifyContent: 'center', borderRadius: 9, backgroundColor: '#FEF3F2' }, dangerButtonText: { color: '#B42318', fontWeight: '800' }, pmReadOnly: { marginTop: 10, color: '#667085', fontSize: 12 },
})
