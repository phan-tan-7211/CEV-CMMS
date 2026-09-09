import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { listMeters, recordMeterReading, type MeterItem } from '../features/preventive-maintenance'

function formatDate(value: string) {
  if (!value) return 'Chưa có dữ liệu'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function MetersScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<MeterItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState('')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')

  async function refresh() {
    setError('')
    try { setItems(await listMeters()) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được meter.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? items.filter((item) => `${item.name} ${item.equipmentId} ${item.meterType} ${item.unit}`.toLowerCase().includes(q)) : items
  }, [items, search])

  async function save(item: MeterItem) {
    const reading = Number(value)
    if (!Number.isFinite(reading)) { setError('Nhập giá trị meter hợp lệ.'); return }
    setSavingId(item.meterId); setError('')
    try {
      await recordMeterReading({ meterId: item.meterId, value: reading, note })
      setEditingId(''); setValue(''); setNote('')
      await refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không ghi được meter.') }
    finally { setSavingId('') }
  }

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.iconButton}><Ionicons name="arrow-back" size={23} color="#344054" /></Pressable><Text style={styles.title}>Đồng hồ đo</Text><Pressable onPress={() => void refresh()} style={styles.iconButton}><Ionicons name="refresh" size={21} color="#344054" /></Pressable></View>
    <View style={styles.searchBox}><Ionicons name="search" size={18} color="#667085"/><TextInput value={search} onChangeText={setSearch} placeholder="Tìm meter hoặc thiết bị" placeholderTextColor="#98A2B3" style={styles.searchInput}/></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF"/><Text style={styles.muted}>Đang tải meter...</Text></View> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {filtered.length ? filtered.map((item) => {
        const editing = editingId === item.meterId
        return <View key={item.meterId} style={styles.card}>
          <View style={styles.cardTop}><View style={styles.flex}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.sub}>{item.equipmentId} · {item.meterType}</Text></View><View style={styles.valueBox}><Text style={styles.valueMain}>{item.latestValue ?? '—'}</Text><Text style={styles.valueUnit}>{item.unit}</Text></View></View>
          <Text style={styles.recorded}>Cập nhật: {formatDate(item.latestRecordedAt)}</Text>
          {item.rolloverValue !== null ? <Text style={styles.recorded}>Rollover: {item.rolloverValue} {item.unit}</Text> : null}
          {editing ? <View style={styles.form}><TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder={`Giá trị ${item.unit}`} placeholderTextColor="#98A2B3" style={styles.input}/><TextInput value={note} onChangeText={setNote} placeholder="Ghi chú" placeholderTextColor="#98A2B3" style={styles.input}/><View style={styles.actions}><Pressable onPress={() => { setEditingId(''); setValue(''); setNote('') }} style={styles.secondary}><Text style={styles.secondaryText}>Hủy</Text></Pressable><Pressable disabled={savingId === item.meterId} onPress={() => void save(item)} style={[styles.primary, savingId === item.meterId && styles.disabled]}><Text style={styles.primaryText}>{savingId === item.meterId ? 'Đang lưu...' : 'Lưu chỉ số'}</Text></Pressable></View></View> : <Pressable onPress={() => { setEditingId(item.meterId); setValue(item.latestValue === null ? '' : String(item.latestValue)); setNote('') }} style={styles.primary}><Text style={styles.primaryText}>Ghi chỉ số mới</Text></Pressable>}
        </View>
      }) : <View style={styles.center}><Ionicons name="speedometer-outline" size={34} color="#98A2B3"/><Text style={styles.muted}>Không có meter phù hợp.</Text></View>}
    </ScrollView>}
  </SafeAreaView>
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F8FAFC'},header:{height:56,backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:12},iconButton:{width:40,height:40,alignItems:'center',justifyContent:'center'},title:{fontSize:18,fontWeight:'700',color:'#101828'},searchBox:{margin:16,marginBottom:8,height:44,borderWidth:1,borderColor:'#D0D5DD',borderRadius:10,backgroundColor:'#FFF',flexDirection:'row',alignItems:'center',paddingHorizontal:12,gap:8},searchInput:{flex:1,color:'#101828'},content:{padding:16,paddingTop:8,paddingBottom:32,gap:12},center:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',gap:10},muted:{color:'#667085'},error:{marginHorizontal:16,marginBottom:8,color:'#B42318'},card:{backgroundColor:'#FFF',borderRadius:14,borderWidth:1,borderColor:'#EAECF0',padding:14,gap:10},cardTop:{flexDirection:'row',alignItems:'flex-start',gap:12},flex:{flex:1},cardTitle:{fontSize:16,fontWeight:'700',color:'#101828'},sub:{fontSize:13,color:'#667085',marginTop:3},valueBox:{alignItems:'flex-end'},valueMain:{fontSize:20,fontWeight:'800',color:'#101828'},valueUnit:{fontSize:12,color:'#667085'},recorded:{fontSize:12,color:'#667085'},form:{gap:8},input:{minHeight:42,borderWidth:1,borderColor:'#D0D5DD',borderRadius:9,paddingHorizontal:12,color:'#101828',backgroundColor:'#FFF'},actions:{flexDirection:'row',gap:8},primary:{flex:1,minHeight:42,borderRadius:9,backgroundColor:'#155EEF',alignItems:'center',justifyContent:'center',paddingHorizontal:12},primaryText:{color:'#FFF',fontWeight:'700'},secondary:{flex:1,minHeight:42,borderRadius:9,borderWidth:1,borderColor:'#D0D5DD',alignItems:'center',justifyContent:'center',paddingHorizontal:12},secondaryText:{color:'#344054',fontWeight:'700'},disabled:{opacity:.55},
})
