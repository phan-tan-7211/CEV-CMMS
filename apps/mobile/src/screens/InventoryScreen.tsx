import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { loadInventorySnapshot, type InventoryPart } from '../features/inventory'

function riskLabel(value: string) {
  if (value === 'OUT_OF_STOCK') return 'Hết hàng'
  if (value === 'CRITICAL') return 'Nguy cấp'
  if (value === 'LOW_STOCK' || value === 'REORDER') return 'Sắp hết'
  return 'Đủ tồn'
}

function isRisk(part: InventoryPart) {
  return ['OUT_OF_STOCK', 'CRITICAL', 'LOW_STOCK', 'REORDER'].includes(part.riskState)
}

export function InventoryScreen({ onBack, onOpenPartInventory, onScan }: { onBack: () => void; onOpenPartInventory: (partId: string) => void; onScan: () => void }) {
  const [parts, setParts] = useState<InventoryPart[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      const snapshot = await loadInventorySnapshot({ transactionLimit: 20 })
      setParts(snapshot.parts)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được dữ liệu kho.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return parts
    return parts.filter((part) => [part.partId, part.partNumber, part.name, part.barcode, part.manufacturer].some((field) => field.toLowerCase().includes(value)))
  }, [parts, query])

  const riskCount = parts.filter(isRisk).length
  const outCount = parts.filter((part) => part.quantityOnHand <= 0).length

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Kho & Phụ tùng</Text><Text style={styles.subtitle}>Tồn kho theo location · cảnh báo mức tối thiểu</Text></View>
        <Pressable onPress={onScan} accessibilityRole="button" accessibilityLabel="Quét mã phụ tùng" style={styles.scan}><Ionicons name="scan-outline" size={23} color="#155EEF" /></Pressable>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
        <View style={styles.metrics}>
          <Metric label="Mã phụ tùng" value={String(parts.length)} />
          <Metric label="Cần bổ sung" value={String(riskCount)} warning={riskCount > 0} />
          <Metric label="Hết hàng" value={String(outCount)} warning={outCount > 0} />
        </View>

        <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color="#667085" /><TextInput value={query} onChangeText={setQuery} placeholder="Tên, mã, barcode..." placeholderTextColor="#98A2B3" style={styles.searchInput} /></View>

        {loading ? <View style={styles.center}><ActivityIndicator color="#155EEF" /><Text style={styles.centerText}>Đang tải tồn kho...</Text></View> : null}
        {!loading && error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}

        {!loading && !error ? filtered.map((part) => (
          <Pressable key={part.partId} onPress={() => onOpenPartInventory(part.partId)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardIcon}><Ionicons name="cube-outline" size={22} color="#155EEF" /></View>
            <View style={styles.cardCopy}>
              <Text style={styles.partName}>{part.name || part.partId}</Text>
              <Text style={styles.partMeta}>{part.partNumber || part.partId}{part.manufacturer ? ` · ${part.manufacturer}` : ''}</Text>
              <View style={styles.stockLine}><Text style={styles.stockValue}>Tồn {part.quantityOnHand}</Text><Text style={styles.stockMeta}>Khả dụng {part.quantityAvailable} · Min {part.minStock}</Text></View>
            </View>
            <View style={styles.right}>
              <View style={[styles.badge, isRisk(part) ? styles.badgeRisk : styles.badgeOk]}><Text style={[styles.badgeText, isRisk(part) ? styles.badgeTextRisk : styles.badgeTextOk]}>{riskLabel(part.riskState)}</Text></View>
              <Ionicons name="chevron-forward" size={20} color="#98A2B3" />
            </View>
          </Pressable>
        )) : null}

        {!loading && !error && filtered.length === 0 ? <Text style={styles.empty}>Không có phụ tùng phù hợp.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <View style={styles.metric}><Text style={[styles.metricValue, warning && styles.metricWarning]}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8F9FB'},
  header:{minHeight:66,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},
  icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1,minWidth:0},title:{fontSize:20,fontWeight:'900',color:'#101828'},subtitle:{marginTop:1,fontSize:11.5,color:'#667085'},scan:{width:46,height:46,alignItems:'center',justifyContent:'center'},
  content:{padding:16,paddingBottom:32},metrics:{flexDirection:'row',gap:8,marginBottom:14},metric:{flex:1,padding:12,borderRadius:13,backgroundColor:'#FFF',borderWidth:1,borderColor:'#EAECF0'},metricValue:{fontSize:22,fontWeight:'900',color:'#101828'},metricWarning:{color:'#B42318'},metricLabel:{marginTop:3,fontSize:10.5,color:'#667085'},
  searchBox:{minHeight:48,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,borderRadius:12,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',marginBottom:14},searchInput:{flex:1,fontSize:14,color:'#101828'},
  center:{paddingVertical:40,alignItems:'center',gap:10},centerText:{fontSize:12,color:'#667085'},errorBox:{padding:16,borderRadius:12,backgroundColor:'#FEF3F2'},errorText:{fontSize:12,color:'#B42318'},retry:{marginTop:8,fontWeight:'900',color:'#155EEF'},
  card:{minHeight:92,marginBottom:9,padding:12,flexDirection:'row',alignItems:'center',gap:10,borderRadius:15,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},cardIcon:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#EFF4FF'},cardCopy:{flex:1,minWidth:0},partName:{fontSize:14.5,fontWeight:'900',color:'#344054'},partMeta:{marginTop:3,fontSize:11,color:'#667085'},stockLine:{marginTop:7,flexDirection:'row',gap:8,alignItems:'center'},stockValue:{fontSize:12.5,fontWeight:'900',color:'#101828'},stockMeta:{fontSize:10.5,color:'#667085'},right:{alignItems:'flex-end',gap:9},badge:{paddingHorizontal:8,paddingVertical:5,borderRadius:10},badgeRisk:{backgroundColor:'#FEF3F2'},badgeOk:{backgroundColor:'#ECFDF3'},badgeText:{fontSize:10,fontWeight:'900'},badgeTextRisk:{color:'#B42318'},badgeTextOk:{color:'#027A48'},pressed:{opacity:.72},empty:{paddingVertical:30,textAlign:'center',color:'#667085'}
})
