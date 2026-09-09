import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  createProviderShare,
  loadFinalParity,
  loadProviderPortalByToken,
  providerPortalAction,
  revokeProviderShare,
  saveCustomWorkOrderStatus,
  setWorkOrderCustomStatus,
  submitWorkOrderFeedback,
  type FinalParitySnapshot,
  type ProviderPortalSnapshot,
} from '../features/final-parity/api/finalParityService'

type Tab = 'analytics' | 'statuses' | 'feedback' | 'providers'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'statuses', label: 'WO Status' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'providers', label: 'Provider Portal' },
]
const CANONICAL = ['OPEN', 'WAITING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'RELEASED', 'CANCELLED']

function Pill({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}><Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text></Pressable>
}

function Btn({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.btn, secondary && styles.btnSecondary, disabled && styles.disabled]}><Text style={[styles.btnText, secondary && styles.btnTextSecondary]}>{label}</Text></Pressable>
}

export function FinalCoreParityScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('analytics')
  const [snapshot, setSnapshot] = useState<FinalParitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try { setSnapshot(await loadFinalParity()) }
    catch (error) { Alert.alert('Final parity', error instanceof Error ? error.message : 'Không tải được dữ liệu.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  return <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable>
      <View style={styles.copy}><Text style={styles.title}>Core parity cuối</Text><Text style={styles.sub}>Analytics · Status · Feedback · Provider</Text></View>
      <Pressable onPress={() => void load()} style={styles.icon}><Ionicons name="refresh" size={21} color="#344054" /></Pressable>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{TABS.map((item) => <Pill key={item.id} active={tab === item.id} label={item.label} onPress={() => setTab(item.id)} />)}</ScrollView>
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View> : null}
    {!loading && tab === 'analytics' ? <Analytics snapshot={snapshot} /> : null}
    {!loading && tab === 'statuses' ? <Statuses snapshot={snapshot} reload={load} /> : null}
    {!loading && tab === 'feedback' ? <Feedback snapshot={snapshot} reload={load} /> : null}
    {!loading && tab === 'providers' ? <Providers snapshot={snapshot} reload={load} /> : null}
  </SafeAreaView>
}

function Analytics({ snapshot }: { snapshot: FinalParitySnapshot | null }) {
  const totals = useMemo(() => {
    const reliability = snapshot?.reliability || []
    const costs = snapshot?.workOrderCost || []
    const downtime = snapshot?.downtime || []
    return {
      failures: reliability.reduce((sum, row) => sum + Number(row.failureCount || 0), 0),
      downtimeHours: reliability.reduce((sum, row) => sum + Number(row.downtimeHours || 0), 0),
      cost: costs.reduce((sum, row) => sum + Number(row.totalCost || 0), 0),
      openDowntime: downtime.filter((row) => row.isOpen).length,
    }
  }, [snapshot])
  return <ScrollView contentContainerStyle={styles.body}>
    <View style={styles.kpiGrid}>
      <Kpi label="Sự cố" value={String(totals.failures)} />
      <Kpi label="Downtime (h)" value={totals.downtimeHours.toFixed(1)} />
      <Kpi label="Chi phí WO" value={totals.cost.toLocaleString('vi-VN')} />
      <Kpi label="Downtime mở" value={String(totals.openDowntime)} />
    </View>
    <Text style={styles.heading}>Reliability · MTBF / MTTR</Text>
    {(snapshot?.reliability || []).slice(0, 30).map((row) => <View key={row.equipmentId} style={styles.listCard}>
      <Text style={styles.listTitle}>{row.equipmentName || row.equipmentId}</Text>
      <Text style={styles.meta}>Failure {Number(row.failureCount || 0)} · Downtime {Number(row.downtimeHours || 0).toFixed(1)}h</Text>
      <Text style={styles.meta}>MTTR {Number(row.mttrHours || 0).toFixed(2)}h · MTBF {Number(row.mtbfHours || 0).toFixed(2)}h · {row.locationName || 'Không vị trí'}</Text>
    </View>)}
    <Text style={styles.heading}>Chi phí Work Order</Text>
    {(snapshot?.workOrderCost || []).slice(0, 30).map((row) => <View key={row.workOrderId} style={styles.listCard}>
      <Text style={styles.listTitle}>{row.workOrderId} · {row.equipmentName || row.equipmentId}</Text>
      <Text style={styles.meta}>Parts {Number(row.partsCost || 0).toLocaleString('vi-VN')} · Labor {Number(row.laborCost || 0).toLocaleString('vi-VN')} · Total {Number(row.totalCost || 0).toLocaleString('vi-VN')}</Text>
    </View>)}
  </ScrollView>
}

function Kpi({ label, value }: { label: string; value: string }) {
  return <View style={styles.kpi}><Text style={styles.kpiValue}>{value}</Text><Text style={styles.kpiLabel}>{label}</Text></View>
}

function Statuses({ snapshot, reload }: { snapshot: FinalParitySnapshot | null; reload: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [canonical, setCanonical] = useState('OPEN')
  const [workOrderId, setWorkOrderId] = useState('')
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!code.trim() || !name.trim()) return Alert.alert('Nhập code và tên trạng thái')
    setBusy(true)
    try { await saveCustomWorkOrderStatus({ statusCode: code, displayName: name, canonicalStatus: canonical }); setCode(''); setName(''); await reload() }
    catch (error) { Alert.alert('Không lưu được', error instanceof Error ? error.message : 'Lỗi custom status.') }
    finally { setBusy(false) }
  }
  async function apply() {
    if (!workOrderId.trim() || !selected) return Alert.alert('Nhập Work Order và chọn status')
    setBusy(true)
    try { await setWorkOrderCustomStatus(workOrderId.trim(), selected); Alert.alert('Đã gắn custom status', `${workOrderId.trim()} → ${selected}`); setWorkOrderId('') }
    catch (error) { Alert.alert('Không cập nhật được', error instanceof Error ? error.message : 'Lỗi custom status.') }
    finally { setBusy(false) }
  }
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <View style={styles.card}><Text style={styles.heading}>Tạo custom WO status</Text><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Code * (WAIT_PARTS...)" style={styles.input} /><TextInput value={name} onChangeText={setName} placeholder="Tên hiển thị *" style={styles.input} /><Text style={styles.label}>Nhóm trạng thái chuẩn</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{CANONICAL.map((item) => <Pill key={item} active={canonical === item} label={item} onPress={() => setCanonical(item)} />)}</ScrollView><Btn label="Lưu trạng thái" disabled={busy} onPress={() => void save()} /></View>
    <Text style={styles.heading}>Trạng thái đã cấu hình</Text>
    {(snapshot?.customStatuses || []).map((item) => <Pressable key={item.statusCode} onPress={() => setSelected(item.statusCode)} style={[styles.listCard, selected === item.statusCode && styles.selected]}><Text style={styles.listTitle}>{item.displayName} · {item.statusCode}</Text><Text style={styles.meta}>Nhóm chuẩn: {item.canonicalStatus}</Text></Pressable>)}
    <View style={styles.card}><Text style={styles.heading}>Gắn status cho WO</Text><TextInput value={workOrderId} onChangeText={setWorkOrderId} placeholder="Work Order ID" style={styles.input} /><Btn label="Áp dụng custom status" disabled={busy || !selected} onPress={() => void apply()} /></View>
  </ScrollView>
}

function Feedback({ snapshot, reload }: { snapshot: FinalParitySnapshot | null; reload: () => Promise<void> }) {
  const [workOrderId, setWorkOrderId] = useState('')
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!workOrderId.trim()) return Alert.alert('Chọn hoặc nhập Work Order')
    setBusy(true)
    try { await submitWorkOrderFeedback(workOrderId.trim(), rating, comment); setComment(''); await reload(); Alert.alert('Đã gửi feedback') }
    catch (error) { Alert.alert('Không gửi được', error instanceof Error ? error.message : 'Lỗi feedback.') }
    finally { setBusy(false) }
  }
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <View style={styles.card}><Text style={styles.heading}>Đánh giá Work Order</Text><TextInput value={workOrderId} onChangeText={setWorkOrderId} placeholder="Work Order ID" style={styles.input} /><Text style={styles.label}>WO hoàn thành gần đây</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{(snapshot?.recentCompletedWorkOrders || []).slice(0, 30).map((row) => <Pill key={row.workOrderId} active={workOrderId === row.workOrderId} label={row.workOrderId} onPress={() => setWorkOrderId(row.workOrderId)} />)}</ScrollView><Text style={styles.label}>Rating</Text><View style={styles.stars}>{[1,2,3,4,5].map((value) => <Pressable key={value} onPress={() => setRating(value)}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={30} color="#F79009" /></Pressable>)}</View><TextInput value={comment} onChangeText={setComment} placeholder="Nhận xét" multiline style={[styles.input, styles.multi]} /><Btn label="Gửi feedback" disabled={busy} onPress={() => void submit()} /></View>
    <Text style={styles.heading}>Feedback gần đây</Text>{(snapshot?.feedback || []).map((row) => <View key={row.feedbackId} style={styles.listCard}><Text style={styles.listTitle}>{row.workOrderId} · {'★'.repeat(Number(row.rating || 0))}</Text><Text style={styles.meta}>{row.comment || 'Không nhận xét'} · {new Date(row.submittedAt).toLocaleString('vi-VN')}</Text></View>)}
  </ScrollView>
}

function Providers({ snapshot, reload }: { snapshot: FinalParitySnapshot | null; reload: () => Promise<void> }) {
  const [workOrderId, setWorkOrderId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [token, setToken] = useState('')
  const [portal, setPortal] = useState<ProviderPortalSnapshot | null>(null)
  const [actor, setActor] = useState('Nhà thầu')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  async function create() {
    if (!workOrderId.trim() || !providerId) return Alert.alert('Nhập WO và chọn Provider')
    setBusy(true)
    try { const result = await createProviderShare(workOrderId.trim(), providerId); setToken(result.token); await reload(); Alert.alert('Đã tạo Provider share', 'Token đã hiển thị để gửi cho nhà thầu.') }
    catch (error) { Alert.alert('Không tạo được share', error instanceof Error ? error.message : 'Lỗi Provider Portal.') }
    finally { setBusy(false) }
  }
  async function openPortal(useToken = token) {
    if (!useToken.trim()) return Alert.alert('Nhập token Provider')
    setBusy(true)
    try { setPortal(await loadProviderPortalByToken(useToken.trim())) }
    catch (error) { Alert.alert('Provider Portal', error instanceof Error ? error.message : 'Token không hợp lệ.') }
    finally { setBusy(false) }
  }
  async function action(value: 'ACKNOWLEDGE' | 'START' | 'COMPLETE' | 'COMMENT') {
    if (!token.trim()) return
    setBusy(true)
    try { await providerPortalAction(token.trim(), value, note, actor); setNote(''); await openPortal(token) }
    catch (error) { Alert.alert('Provider Portal', error instanceof Error ? error.message : 'Không cập nhật được.') }
    finally { setBusy(false) }
  }
  return <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <View style={styles.card}><Text style={styles.heading}>Chia sẻ WO cho Provider / Contractor</Text><TextInput value={workOrderId} onChangeText={setWorkOrderId} placeholder="Work Order ID" style={styles.input} /><Text style={styles.label}>Provider</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{(snapshot?.providers || []).map((row) => <Pill key={row.partyId} active={providerId === row.partyId} label={row.companyName} onPress={() => setProviderId(row.partyId)} />)}</ScrollView>{!(snapshot?.providers || []).length ? <Text style={styles.warning}>Chưa có Vendor/Contractor. Tạo nhà cung cấp trước trong module Nhà cung cấp & Nhà thầu.</Text> : null}<Btn label="Tạo Provider share" disabled={busy || !providerId} onPress={() => void create()} />{token ? <View style={styles.tokenBox}><Text style={styles.tokenLabel}>TOKEN NHÀ THẦU</Text><Text selectable style={styles.token}>{token}</Text></View> : null}</View>
    <Text style={styles.heading}>Share đang quản lý</Text>{(snapshot?.providerShares || []).map((row) => <View key={row.shareId} style={styles.listCard}><Text style={styles.listTitle}>{row.workOrderId} · {row.providerName}</Text><Text style={styles.meta}>{row.status} · {row.token}</Text><View style={styles.inlineButtons}><Btn label="Mở thử" secondary onPress={() => { setToken(row.token); void openPortal(row.token) }} />{!row.revokedAt ? <Btn label="Thu hồi" secondary onPress={() => void (async () => { try { await revokeProviderShare(row.shareId); await reload() } catch (error) { Alert.alert('Thu hồi share', error instanceof Error ? error.message : 'Lỗi') } })()} /> : null}</View></View>)}
    <View style={styles.card}><Text style={styles.heading}>Kiểm tra Provider Portal bằng token</Text><TextInput value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Provider token" style={styles.input} /><TextInput value={actor} onChangeText={setActor} placeholder="Tên người nhà thầu" style={styles.input} /><TextInput value={note} onChangeText={setNote} placeholder="Ghi chú / tiến độ" style={styles.input} /><Btn label="Mở portal" secondary disabled={busy} onPress={() => void openPortal()} />{portal ? <View style={styles.portalBox}><Text style={styles.listTitle}>{portal.workOrderId} · {portal.equipmentName || portal.equipmentId}</Text><Text style={styles.meta}>{portal.providerName} · {portal.shareStatus} · WO {portal.workOrderStatus}</Text><Text style={styles.meta}>{portal.reason} · {portal.priority}</Text><View style={styles.actionGrid}><Btn label="Xác nhận" onPress={() => void action('ACKNOWLEDGE')} /><Btn label="Bắt đầu" onPress={() => void action('START')} /><Btn label="Gửi note" onPress={() => void action('COMMENT')} /><Btn label="Hoàn tất" onPress={() => void action('COMPLETE')} /></View>{portal.activity.map((item, index) => <Text key={`${item.createdAt}-${index}`} style={styles.activity}>• {item.action} · {item.actorLabel || 'Provider'} · {item.note || ''}</Text>)}</View> : null}</View>
  </ScrollView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' }, header: { minHeight: 64, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EAECF0' }, icon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, alignItems: 'center' }, title: { fontSize: 19, fontWeight: '900', color: '#101828' }, sub: { fontSize: 11, color: '#667085', marginTop: 2 }, tabs: { padding: 10, gap: 7, backgroundColor: '#FFF' }, pill: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFF' }, pillActive: { borderColor: '#155EEF', backgroundColor: '#EEF4FF' }, pillText: { fontSize: 11.5, fontWeight: '800', color: '#475467' }, pillTextActive: { color: '#155EEF' }, body: { padding: 14, paddingBottom: 40 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFF', gap: 10, marginBottom: 14 }, heading: { fontSize: 16, fontWeight: '900', color: '#101828', marginTop: 4, marginBottom: 8 }, label: { fontSize: 12.5, fontWeight: '800', color: '#475467', marginTop: 6 }, input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFF', color: '#101828' }, multi: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, row: { gap: 7, paddingBottom: 4 }, btn: { minHeight: 46, borderRadius: 12, backgroundColor: '#155EEF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, flex: 1 }, btnSecondary: { backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#B2CCFF' }, btnText: { fontSize: 13, fontWeight: '900', color: '#FFF' }, btnTextSecondary: { color: '#155EEF' }, disabled: { opacity: 0.5 }, listCard: { padding: 12, marginBottom: 8, borderRadius: 12, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFF' }, selected: { borderColor: '#155EEF', backgroundColor: '#EEF4FF' }, listTitle: { fontSize: 13.5, fontWeight: '900', color: '#344054' }, meta: { marginTop: 4, fontSize: 10.5, lineHeight: 15, color: '#667085' }, kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }, kpi: { width: '48.5%', minHeight: 92, padding: 14, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EAECF0' }, kpiValue: { fontSize: 24, fontWeight: '900', color: '#101828' }, kpiLabel: { marginTop: 6, fontSize: 11.5, fontWeight: '800', color: '#667085' }, stars: { flexDirection: 'row', gap: 8, paddingVertical: 6 }, warning: { fontSize: 11.5, lineHeight: 17, color: '#B54708' }, tokenBox: { padding: 10, borderRadius: 10, backgroundColor: '#F4EBFF' }, tokenLabel: { fontSize: 10, fontWeight: '900', color: '#6941C6' }, token: { marginTop: 4, fontSize: 12, color: '#344054' }, portalBox: { padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', gap: 7 }, actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 6 }, activity: { fontSize: 10.5, lineHeight: 15, color: '#475467' }, inlineButtons: { flexDirection: 'row', gap: 8, marginTop: 9 },
})
