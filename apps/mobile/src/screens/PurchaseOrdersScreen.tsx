import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  createPurchaseOrder,
  generateReorders,
  loadPurchaseOrderDetail,
  loadPurchasingSnapshot,
  receivePurchaseOrderLine,
  transitionPurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderDetail,
  type PurchasingSnapshot,
} from '../features/purchasing'

function poAction(status: string): { action: 'SUBMIT'|'APPROVE'|'ORDER'|'CLOSE'; label: string } | null {
  if (status === 'DRAFT') return { action:'SUBMIT', label:'Gửi duyệt' }
  if (status === 'PENDING_APPROVAL') return { action:'APPROVE', label:'Duyệt PO' }
  if (status === 'APPROVED') return { action:'ORDER', label:'Đặt hàng' }
  if (status === 'RECEIVED' || status === 'PARTIALLY_RECEIVED') return { action:'CLOSE', label:'Đóng PO' }
  return null
}

export function PurchaseOrdersScreen({ onBack, onAddVendor }: { onBack: () => void; onAddVendor: () => void }) {
  const [snapshot, setSnapshot] = useState<PurchasingSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [vendorId, setVendorId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null)
  const [receiveLineId, setReceiveLineId] = useState('')
  const [receiveQty, setReceiveQty] = useState('')
  const [receiveLocationId, setReceiveLocationId] = useState('')

  async function refresh(pull = false) {
    pull ? setRefreshing(true) : setLoading(true)
    try { setSnapshot(await loadPurchasingSnapshot()); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được mua hàng.') }
    finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { void refresh() }, [])

  const openReorders = useMemo(() => (snapshot?.reorders || []).filter((item) => item.status === 'OPEN'), [snapshot])
  const selected = openReorders.filter((item) => selectedIds.includes(item.reorderRequestId))

  async function runGenerate() {
    if (busy) return
    setBusy(true)
    try {
      const count = await generateReorders()
      await refresh(true)
      Alert.alert('Đã kiểm tra tồn kho', count ? `Đã tạo ${count} đề nghị mua mới.` : 'Không có đề nghị mua mới cần tạo.')
    } catch (reason) { Alert.alert('Không thể tạo đề nghị mua', reason instanceof Error ? reason.message : 'Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  async function createPo() {
    if (!selectedIds.length) { Alert.alert('Chọn đề nghị mua', 'Chọn ít nhất một dòng cần mua.'); return }
    if (!vendorId) { Alert.alert('Chọn nhà cung cấp', 'Cần có nhà cung cấp trước khi tạo PO.'); return }
    setBusy(true)
    try {
      const result = await createPurchaseOrder(selectedIds, vendorId, expectedDate || undefined)
      setSelectedIds([]); setExpectedDate('')
      await refresh(true)
      Alert.alert('Đã tạo Purchase Order', String(result.poNumber || result.purchaseOrderId || ''))
    } catch (reason) { Alert.alert('Không thể tạo PO', reason instanceof Error ? reason.message : 'Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  async function changePo(order: PurchaseOrder) {
    const next = poAction(order.status)
    if (!next || busy) return
    setBusy(true)
    try { await transitionPurchaseOrder(order.purchaseOrderId, next.action); await refresh(true) }
    catch (reason) { Alert.alert('Không thể cập nhật PO', reason instanceof Error ? reason.message : 'Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  async function openPo(order: PurchaseOrder) {
    try { setDetail(await loadPurchaseOrderDetail(order.purchaseOrderId)) }
    catch (reason) { Alert.alert('Không tải được PO', reason instanceof Error ? reason.message : 'Vui lòng thử lại.') }
  }

  async function receiveLine() {
    const qty = Number(receiveQty)
    if (!(qty > 0) || !receiveLineId) return
    setBusy(true)
    try {
      await receivePurchaseOrderLine(receiveLineId, qty, receiveLocationId || undefined)
      const poId = detail?.order.purchaseOrderId || ''
      if (poId) setDetail(await loadPurchaseOrderDetail(poId))
      setReceiveLineId(''); setReceiveQty(''); setReceiveLocationId('')
      await refresh(true)
    } catch (reason) { Alert.alert('Không thể nhận hàng', reason instanceof Error ? reason.message : 'Vui lòng thử lại.') }
    finally { setBusy(false) }
  }

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Mua hàng & Reorder</Text><Text style={styles.sub}>Low stock → PO → Receiving → Inventory</Text></View><Pressable onPress={() => void runGenerate()} style={styles.icon}><Ionicons name="refresh-circle-outline" size={25} color="#155EEF"/></Pressable></View>
    {loading ? <View style={styles.center}><ActivityIndicator color="#155EEF"/><Text style={styles.muted}>Đang tải mua hàng...</Text></View> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)}/>} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.metrics}><Metric label="Đề nghị mở" value={String(openReorders.length)}/><Metric label="PO đang mở" value={String(snapshot?.orders.length || 0)}/><Metric label="Nhà cung cấp" value={String(snapshot?.vendors.length || 0)}/></View>

      <View style={styles.sectionTop}><Text style={styles.heading}>Đề nghị mua</Text><Pressable onPress={() => void runGenerate()}><Text style={styles.link}>Quét low stock</Text></Pressable></View>
      {openReorders.length ? openReorders.map((item) => {
        const active = selectedIds.includes(item.reorderRequestId)
        return <Pressable key={item.reorderRequestId} onPress={() => setSelectedIds((current) => active ? current.filter((id) => id !== item.reorderRequestId) : [...current,item.reorderRequestId])} style={[styles.row,active&&styles.rowActive]}><Ionicons name={active?'checkbox':'square-outline'} size={22} color={active?'#155EEF':'#98A2B3'}/><View style={styles.rowCopy}><Text style={styles.rowTitle}>{item.partName || item.partId}</Text><Text style={styles.rowMeta}>{item.partNumber || item.partId} · {item.locationName || item.locationCode || 'Kho'}</Text></View><Text style={styles.qty}>{item.requestedQuantity}</Text></Pressable>
      }) : <Text style={styles.empty}>Không có đề nghị mua đang mở.</Text>}

      {selected.length ? <View style={styles.createCard}><Text style={styles.cardTitle}>Tạo Purchase Order · {selected.length} dòng</Text>{snapshot?.vendors.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{snapshot.vendors.map((vendor) => <Pressable key={vendor.partyId} onPress={() => setVendorId(vendor.partyId)} style={[styles.chip,vendorId===vendor.partyId&&styles.chipActive]}><Text style={[styles.chipText,vendorId===vendor.partyId&&styles.chipTextActive]}>{vendor.companyName}</Text></Pressable>)}</ScrollView> : <Pressable onPress={onAddVendor} style={styles.vendorCta}><Text style={styles.vendorCtaText}>+ Tạo nhà cung cấp trước</Text></Pressable>}<TextInput value={expectedDate} onChangeText={setExpectedDate} placeholder="Ngày dự kiến YYYY-MM-DD (tuỳ chọn)" placeholderTextColor="#98A2B3" style={styles.input}/><Pressable disabled={busy || !vendorId} onPress={() => void createPo()} style={[styles.primary,(busy||!vendorId)&&styles.disabled]}><Text style={styles.primaryText}>Tạo PO</Text></Pressable></View> : null}

      <Text style={styles.heading}>Purchase Orders</Text>
      {(snapshot?.orders || []).length ? snapshot?.orders.map((order) => { const next=poAction(order.status); return <View key={order.purchaseOrderId} style={styles.poCard}><Pressable onPress={() => void openPo(order)}><View style={styles.poTop}><View><Text style={styles.cardTitle}>{order.poNumber || order.purchaseOrderId}</Text><Text style={styles.rowMeta}>{order.vendorName || 'Chưa có NCC'} · {order.lineCount} dòng</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{order.status}</Text></View></View><Text style={styles.poMeta}>Còn nhận: {order.remainingQuantity} · Tổng: {order.totalAmount || order.subtotal} {order.currencyCode || ''}</Text></Pressable>{next ? <Pressable onPress={() => void changePo(order)} disabled={busy} style={styles.secondary}><Text style={styles.secondaryText}>{next.label}</Text></Pressable> : null}</View> }) : <Text style={styles.empty}>Chưa có Purchase Order đang mở.</Text>}
    </ScrollView>}

    <Modal visible={Boolean(detail)} animationType="slide" onRequestClose={() => setDetail(null)}>
      <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={() => setDetail(null)} style={styles.icon}><Ionicons name="close" size={25} color="#101828"/></Pressable><View style={styles.headerCopy}><Text style={styles.title}>{detail?.order.poNumber || 'PO'}</Text><Text style={styles.sub}>{detail?.order.status}</Text></View><View style={styles.icon}/></View><ScrollView contentContainerStyle={styles.content}>{detail?.lines.map((line) => { const remaining=line.quantityOrdered-line.quantityReceived; return <View key={line.purchaseOrderLineId} style={styles.poCard}><Text style={styles.cardTitle}>{line.description || line.partId}</Text><Text style={styles.poMeta}>Đặt {line.quantityOrdered} · Đã nhận {line.quantityReceived} · Còn {remaining}</Text>{remaining>0 && ['ORDERED','PARTIALLY_RECEIVED'].includes(detail.order.status) ? <Pressable onPress={() => { setReceiveLineId(line.purchaseOrderLineId); setReceiveQty(String(remaining)); setReceiveLocationId(line.stockLocationId || '') }} style={styles.secondary}><Text style={styles.secondaryText}>Nhận hàng</Text></Pressable> : null}</View> })}
        {receiveLineId ? <View style={styles.createCard}><Text style={styles.cardTitle}>Nhận hàng vào kho</Text><TextInput value={receiveQty} onChangeText={setReceiveQty} keyboardType="decimal-pad" style={styles.input} placeholder="Số lượng"/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{snapshot?.locations.map((loc) => <Pressable key={loc.stockLocationId} onPress={() => setReceiveLocationId(loc.stockLocationId)} style={[styles.chip,receiveLocationId===loc.stockLocationId&&styles.chipActive]}><Text style={[styles.chipText,receiveLocationId===loc.stockLocationId&&styles.chipTextActive]}>{loc.name || loc.code}</Text></Pressable>)}</ScrollView><Pressable onPress={() => void receiveLine()} disabled={busy} style={styles.primary}><Text style={styles.primaryText}>Xác nhận nhận hàng</Text></Pressable></View> : null}
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>
}

function Metric({label,value}:{label:string;value:string}) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8F9FB'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},title:{fontSize:20,fontWeight:'900',color:'#101828'},sub:{fontSize:11.5,color:'#667085'},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10},muted:{color:'#667085'},content:{padding:16,paddingBottom:36},error:{padding:12,borderRadius:10,backgroundColor:'#FEF3F2',color:'#B42318'},metrics:{flexDirection:'row',gap:8,marginBottom:18},metric:{flex:1,padding:12,borderRadius:12,backgroundColor:'#FFF',borderWidth:1,borderColor:'#EAECF0'},metricValue:{fontSize:22,fontWeight:'900',color:'#101828'},metricLabel:{marginTop:3,fontSize:10,color:'#667085'},sectionTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heading:{marginTop:12,marginBottom:9,fontSize:16,fontWeight:'900',color:'#344054'},link:{fontSize:12,fontWeight:'900',color:'#155EEF'},row:{minHeight:66,marginBottom:8,padding:11,flexDirection:'row',alignItems:'center',gap:9,borderRadius:13,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},rowActive:{borderColor:'#84ADFF',backgroundColor:'#EFF4FF'},rowCopy:{flex:1},rowTitle:{fontSize:13.5,fontWeight:'900',color:'#344054'},rowMeta:{marginTop:3,fontSize:10.5,color:'#667085'},qty:{fontSize:17,fontWeight:'900',color:'#101828'},empty:{paddingVertical:15,textAlign:'center',fontSize:11.5,color:'#667085'},createCard:{marginTop:12,padding:14,borderRadius:15,borderWidth:1,borderColor:'#D1E0FF',backgroundColor:'#F5F8FF'},cardTitle:{fontSize:14,fontWeight:'900',color:'#344054'},chips:{gap:7,paddingVertical:10},chip:{paddingHorizontal:11,paddingVertical:8,borderRadius:11,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},chipActive:{borderColor:'#84ADFF',backgroundColor:'#EFF4FF'},chipText:{fontSize:11.5,fontWeight:'800',color:'#475467'},chipTextActive:{color:'#155EEF'},input:{minHeight:46,paddingHorizontal:12,marginTop:8,borderRadius:11,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',color:'#101828'},primary:{minHeight:48,marginTop:10,borderRadius:24,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'},primaryText:{fontWeight:'900',color:'#FFF'},disabled:{opacity:.45},vendorCta:{marginTop:10,padding:12,borderRadius:11,backgroundColor:'#FFF'},vendorCtaText:{fontWeight:'900',color:'#155EEF'},poCard:{marginBottom:9,padding:13,borderRadius:14,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},poTop:{flexDirection:'row',justifyContent:'space-between',gap:10},badge:{paddingHorizontal:8,paddingVertical:5,borderRadius:9,backgroundColor:'#F2F4F7'},badgeText:{fontSize:9.5,fontWeight:'900',color:'#475467'},poMeta:{marginTop:8,fontSize:11.5,color:'#667085'},secondary:{minHeight:42,marginTop:10,borderRadius:21,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#B2CCFF'},secondaryText:{fontSize:12.5,fontWeight:'900',color:'#155EEF'}})
