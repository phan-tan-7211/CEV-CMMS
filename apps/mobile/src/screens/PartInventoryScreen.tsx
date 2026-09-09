import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { loadInventorySnapshot, moveInventory, type InventoryPart, type InventorySnapshot, type StockLocation } from '../features/inventory'

type Action = 'RECEIVE' | 'ISSUE' | 'ADJUST_IN' | 'ADJUST_OUT'

const ACTIONS: Array<{ value: Action; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'RECEIVE', label: 'Nhập kho', icon: 'download-outline' },
  { value: 'ISSUE', label: 'Xuất kho', icon: 'exit-outline' },
  { value: 'ADJUST_IN', label: 'Điều chỉnh +', icon: 'add-circle-outline' },
  { value: 'ADJUST_OUT', label: 'Điều chỉnh −', icon: 'remove-circle-outline' },
]

function actionName(type: string) {
  if (type === 'RECEIPT') return 'Nhập kho'
  if (type === 'ISSUE') return 'Xuất kho'
  if (type === 'RETURN') return 'Hoàn kho'
  if (type === 'TRANSFER_IN') return 'Chuyển vào'
  if (type === 'TRANSFER_OUT') return 'Chuyển ra'
  if (type === 'ADJUSTMENT_IN') return 'Điều chỉnh +'
  if (type === 'ADJUSTMENT_OUT') return 'Điều chỉnh −'
  if (type === 'RESERVE') return 'Giữ hàng'
  if (type === 'UNRESERVE') return 'Bỏ giữ hàng'
  return type || 'Giao dịch'
}

function errorMessage(message: string) {
  if (message.includes('INSUFFICIENT_OR_RESERVED_STOCK')) return 'Không đủ tồn khả dụng. Hệ thống không cho tồn âm hoặc xuất phần đang được giữ.'
  if (message.includes('INVENTORY_MOVE_ROLE_DENIED')) return 'Tài khoản hiện tại không có quyền nhập/xuất/điều chỉnh kho.'
  if (message.includes('POSITIVE_QUANTITY_REQUIRED')) return 'Số lượng phải lớn hơn 0.'
  return message
}

export function PartInventoryScreen({ partId, onBack }: { partId: string; onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [action, setAction] = useState<Action>('RECEIVE')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const next = await loadInventorySnapshot({ partId, transactionLimit: 150 })
      setSnapshot(next)
      setLocationId((current) => current || next.stock[0]?.stockLocationId || next.locations[0]?.stockLocationId || '')
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được tồn kho.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [partId])

  const part: InventoryPart | undefined = snapshot?.parts[0]
  const stock = useMemo(() => (snapshot?.stock || []).filter((row) => row.partId === partId), [partId, snapshot?.stock])
  const transactions = snapshot?.transactions || []
  const selectedLocation: StockLocation | undefined = snapshot?.locations.find((item) => item.stockLocationId === locationId)
  const lowStock = Boolean(part && part.quantityOnHand <= part.minStock)

  async function submit() {
    const qty = Number(quantity)
    if (!locationId) { Alert.alert('Chọn vị trí kho', 'Cần chọn location trước khi ghi giao dịch.'); return }
    if (!Number.isFinite(qty) || qty <= 0) { Alert.alert('Kiểm tra số lượng', 'Số lượng phải lớn hơn 0.'); return }
    if (saving) return
    setSaving(true)
    try {
      await moveInventory({ partId, stockLocationId: locationId, action, quantity: qty, note })
      setQuantity('')
      setNote('')
      await load(true)
      Alert.alert('Đã ghi giao dịch kho', `${ACTIONS.find((item) => item.value === action)?.label || action} · ${qty}`)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Không thể ghi giao dịch kho.'
      Alert.alert('Không thể cập nhật kho', errorMessage(message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Tồn kho phụ tùng</Text><Text style={styles.subtitle}>{partId}</Text></View>
        <Pressable onPress={() => void load(true)} style={styles.icon}><Ionicons name="refresh-outline" size={22} color="#155EEF" /></Pressable>
      </View>

      {loading ? <View style={styles.center}><ActivityIndicator color="#155EEF" /><Text style={styles.centerText}>Đang tải tồn kho...</Text></View> : error ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.stockHero, lowStock && styles.stockHeroRisk]}>
            <Text style={styles.partName}>{part?.name || partId}</Text>
            <Text style={styles.qty}>{part?.quantityOnHand ?? 0}</Text>
            <Text style={styles.caption}>Tồn hiện tại · Khả dụng {part?.quantityAvailable ?? 0} · Đang giữ {part?.quantityReserved ?? 0}</Text>
            <View style={styles.heroBottom}><Text style={styles.minText}>Min {part?.minStock ?? 0}</Text>{lowStock ? <Text style={styles.riskText}>CẦN BỔ SUNG</Text> : <Text style={styles.okText}>ĐỦ TỒN</Text>}</View>
          </View>

          <Text style={styles.heading}>Ghi giao dịch kho</Text>
          <View style={styles.actionGrid}>{ACTIONS.map((item) => <Pressable key={item.value} onPress={() => setAction(item.value)} style={[styles.action, action === item.value && styles.actionActive]}><Ionicons name={item.icon} size={20} color={action === item.value ? '#155EEF' : '#667085'} /><Text style={[styles.actionText, action === item.value && styles.actionTextActive]}>{item.label}</Text></Pressable>)}</View>

          <Text style={styles.label}>Vị trí kho *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationChips}>{(snapshot?.locations || []).map((item) => <Pressable key={item.stockLocationId} onPress={() => setLocationId(item.stockLocationId)} style={[styles.locationChip, locationId === item.stockLocationId && styles.locationChipActive]}><Text style={[styles.locationText, locationId === item.stockLocationId && styles.locationTextActive]}>{item.name || item.code}</Text></Pressable>)}</ScrollView>
          {selectedLocation ? <Text style={styles.locationHint}>{selectedLocation.code}{selectedLocation.locationType ? ` · ${selectedLocation.locationType}` : ''}</Text> : null}

          <Text style={styles.label}>Số lượng *</Text>
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="0" placeholderTextColor="#98A2B3" style={styles.input} />
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput value={note} onChangeText={setNote} placeholder="Lý do / phiếu tham chiếu..." placeholderTextColor="#98A2B3" style={[styles.input, styles.note]} multiline />
          <Pressable onPress={() => void submit()} disabled={saving} style={[styles.submit, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitText}>Xác nhận {ACTIONS.find((item) => item.value === action)?.label}</Text>}</Pressable>

          <Text style={styles.heading}>Tồn theo location</Text>
          {stock.length ? stock.map((row) => <View key={row.stockLocationId} style={styles.row}><View style={styles.rowIcon}><Ionicons name="location-outline" size={20} color="#155EEF" /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.locationName || row.locationCode}</Text><Text style={styles.rowMeta}>{row.locationCode} · Giữ {row.quantityReserved}</Text></View><View style={styles.rowRight}><Text style={styles.rowQty}>{row.quantityOnHand}</Text><Text style={styles.rowAvailable}>Khả dụng {row.quantityAvailable}</Text></View></View>) : <Text style={styles.empty}>Chưa có tồn tại location nào.</Text>}

          <Text style={styles.heading}>Lịch sử giao dịch</Text>
          {transactions.length ? transactions.map((item) => <View key={item.transactionId} style={styles.tx}><View style={[styles.txDot, item.quantity < 0 && styles.txDotOut]} /><View style={styles.txCopy}><Text style={styles.txTitle}>{actionName(item.transactionType)} · {item.locationName || item.locationCode}</Text><Text style={styles.txMeta}>{item.occurredAt ? new Date(item.occurredAt).toLocaleString() : ''}{item.workOrderId ? ` · WO ${item.workOrderId}` : ''}</Text>{item.note ? <Text style={styles.txNote}>{item.note}</Text> : null}</View><Text style={[styles.txQty, item.quantity < 0 && styles.txQtyOut]}>{item.quantity > 0 ? '+' : ''}{item.quantity}</Text></View>) : <Text style={styles.empty}>Chưa có giao dịch kho.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8F9FB'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,minWidth:0},title:{fontSize:20,fontWeight:'900',color:'#101828'},subtitle:{marginTop:1,fontSize:11,color:'#667085'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:24,gap:10},centerText:{fontSize:12,color:'#667085'},error:{color:'#B42318',textAlign:'center'},retry:{fontWeight:'900',color:'#155EEF'},content:{padding:16,paddingBottom:36},
  stockHero:{padding:18,borderRadius:18,backgroundColor:'#EFF4FF',borderWidth:1,borderColor:'#D1E0FF'},stockHeroRisk:{backgroundColor:'#FEF3F2',borderColor:'#FECDCA'},partName:{fontSize:15,fontWeight:'900',color:'#344054'},qty:{marginTop:8,fontSize:38,fontWeight:'900',color:'#101828'},caption:{marginTop:2,fontSize:11.5,color:'#667085'},heroBottom:{marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},minText:{fontSize:12,fontWeight:'800',color:'#475467'},riskText:{fontSize:10.5,fontWeight:'900',color:'#B42318'},okText:{fontSize:10.5,fontWeight:'900',color:'#027A48'},
  heading:{marginTop:22,marginBottom:10,fontSize:15,fontWeight:'900',color:'#344054'},actionGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},action:{width:'48%',minHeight:48,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:7,borderRadius:12,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},actionActive:{borderColor:'#84ADFF',backgroundColor:'#EFF4FF'},actionText:{fontSize:12,fontWeight:'800',color:'#667085'},actionTextActive:{color:'#155EEF'},label:{marginTop:14,marginBottom:7,fontSize:12.5,fontWeight:'900',color:'#344054'},locationChips:{gap:7},locationChip:{paddingHorizontal:12,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},locationChipActive:{borderColor:'#84ADFF',backgroundColor:'#EFF4FF'},locationText:{fontSize:12,fontWeight:'800',color:'#475467'},locationTextActive:{color:'#155EEF'},locationHint:{marginTop:6,fontSize:10.5,color:'#667085'},input:{minHeight:48,paddingHorizontal:13,borderRadius:12,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',fontSize:14,color:'#101828'},note:{minHeight:72,paddingTop:12,textAlignVertical:'top'},submit:{minHeight:52,marginTop:16,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'},disabled:{opacity:.5},submitText:{fontSize:15,fontWeight:'900',color:'#FFF'},
  row:{minHeight:66,marginBottom:8,padding:11,flexDirection:'row',alignItems:'center',gap:10,borderRadius:13,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},rowIcon:{width:38,height:38,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#EFF4FF'},rowCopy:{flex:1,minWidth:0},rowTitle:{fontSize:13,fontWeight:'900',color:'#344054'},rowMeta:{marginTop:3,fontSize:10.5,color:'#667085'},rowRight:{alignItems:'flex-end'},rowQty:{fontSize:17,fontWeight:'900',color:'#101828'},rowAvailable:{marginTop:2,fontSize:9.5,color:'#667085'},
  tx:{minHeight:60,paddingVertical:10,flexDirection:'row',alignItems:'flex-start',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},txDot:{width:9,height:9,marginTop:5,borderRadius:5,backgroundColor:'#12B76A'},txDotOut:{backgroundColor:'#F04438'},txCopy:{flex:1,minWidth:0},txTitle:{fontSize:12.5,fontWeight:'800',color:'#344054'},txMeta:{marginTop:3,fontSize:10,color:'#98A2B3'},txNote:{marginTop:3,fontSize:10.5,color:'#667085'},txQty:{fontSize:13,fontWeight:'900',color:'#027A48'},txQtyOut:{color:'#B42318'},empty:{paddingVertical:16,textAlign:'center',fontSize:11.5,color:'#667085'}
})
