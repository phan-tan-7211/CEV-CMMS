import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { generatePmWorkOrder, listPmSchedules, type PmDueItem } from '../features/preventive-maintenance'

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function PreventiveMaintenanceScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<PmDueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [lastGeneratedWorkOrderId, setLastGeneratedWorkOrderId] = useState('')

  async function refresh() {
    setError('')
    try { setItems(await listPmSchedules(true)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được lịch bảo trì phòng ngừa.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((item) => `${item.title} ${item.equipmentId} ${item.scheduleType}`.toLowerCase().includes(q)) : items
  }, [items, search])

  async function generate(item: PmDueItem) {
    if (!item.isDue || savingId) return
    setSavingId(item.scheduleId); setError(''); setLastGeneratedWorkOrderId('')
    try {
      const result = await generatePmWorkOrder(item.scheduleId)
      if (result.workOrderId) setLastGeneratedWorkOrderId(result.workOrderId)
      await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tạo được Work Order từ lịch PM.') }
    finally { setSavingId('') }
  }

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable><Text style={styles.title}>Bảo trì phòng ngừa</Text><Pressable onPress={() => void refresh()} style={styles.iconButton}><Ionicons name="refresh" size={21} color="#344054" /></Pressable></View>
    <View style={styles.searchBox}><Ionicons name="search" size={18} color="#667085"/><TextInput value={search} onChangeText={setSearch} placeholder="Tìm kế hoạch hoặc thiết bị" placeholderTextColor="#98A2B3" style={styles.searchInput}/></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {lastGeneratedWorkOrderId ? <View style={styles.successBox}><Text style={styles.success}>Đã tạo Work Order: {lastGeneratedWorkOrderId}</Text></View> : null}
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF"/><Text style={styles.muted}>Đang tải lịch PM...</Text></View> : <ScrollView contentContainerStyle={styles.content}>
      {filtered.length ? filtered.map((item) => <View key={item.scheduleId} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.sub}>{item.equipmentId} · {item.scheduleType}</Text></View><View style={[styles.badge, item.isDue ? styles.badgeDue : styles.badgeOk]}><Text style={[styles.badgeText, item.isDue ? styles.badgeTextDue : styles.badgeTextOk]}>{item.isDue ? 'ĐẾN HẠN' : 'SẮP TỚI'}</Text></View></View>
        <View style={styles.infoRow}><Text style={styles.label}>Lịch thời gian</Text><Text style={styles.value}>{formatDate(item.nextDueAt)}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Meter kế tiếp</Text><Text style={styles.value}>{item.nextMeterDue ?? '—'}</Text></View>
        <View style={styles.infoRow}><Text style={styles.label}>Meter hiện tại</Text><Text style={styles.value}>{item.latestMeterValue ?? '—'}</Text></View>
        <View style={styles.reasonRow}>{item.timeDue ? <Text style={styles.reasonChip}>Theo thời gian</Text> : null}{item.meterDue ? <Text style={styles.reasonChip}>Theo meter</Text> : null}</View>
        {item.isDue ? <Pressable disabled={Boolean(savingId)} onPress={() => void generate(item)} style={[styles.primaryButton, savingId === item.scheduleId && styles.disabled]}><Text style={styles.primaryText}>{savingId === item.scheduleId ? 'Đang tạo...' : 'Tạo Work Order ngay'}</Text></Pressable> : null}
      </View>) : <View style={styles.center}><Ionicons name="calendar-outline" size={34} color="#98A2B3"/><Text style={styles.muted}>Không có kế hoạch phù hợp.</Text></View>}
    </ScrollView>}
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8FAFC'},header:{height:56,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},iconButton:{width:40,height:40,alignItems:'center',justifyContent:'center'},title:{fontSize:18,fontWeight:'700',color:'#101828'},searchBox:{margin:16,marginBottom:8,height:44,borderWidth:1,borderColor:'#D0D5DD',borderRadius:10,backgroundColor:'#FFF',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},searchInput:{flex:1,color:'#101828'},content:{padding:16,paddingTop:8,paddingBottom:32,gap:12},center:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',gap:10},muted:{color:'#667085'},error:{marginHorizontal:16,marginBottom:8,color:'#B42318'},successBox:{marginHorizontal:16,marginBottom:8,padding:12,borderRadius:10,backgroundColor:'#ECFDF3'},success:{color:'#027A48',fontWeight:'600'},card:{backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:'#EAECF0',padding:14,gap:10},cardTop:{flexDirection:'row',alignItems:'flex-start',gap:10},flex:{flex:1},cardTitle:{fontSize:16,fontWeight:'700',color:'#101828'},sub:{fontSize:13,color:'#667085',marginTop:3},badge:{paddingHorizontal:8,paddingVertical:4,borderRadius:999},badgeDue:{backgroundColor:'#FEF3F2'},badgeOk:{backgroundColor:'#ECFDF3'},badgeText:{fontSize:11,fontWeight:'700'},badgeTextDue:{color:'#B42318'},badgeTextOk:{color:'#027A48'},infoRow:{flexDirection:'row',justifyContent:'space-between',gap:16},label:{color:'#667085',fontSize:13},value:{color:'#344054',fontSize:13,fontWeight:'600',textAlign:'right'},reasonRow:{flexDirection:'row',gap:6,flexWrap:'wrap'},reasonChip:{backgroundColor:'#EFF8FF',color:'#175CD3',paddingHorizontal:8,paddingVertical:4,borderRadius:999,fontSize:12},primaryButton:{height:42,borderRadius:9,backgroundColor:'#155EEF',alignItems:'center',justifyContent:'center'},primaryText:{color:'#FFF',fontWeight:'700'},disabled:{opacity:.55},
})
