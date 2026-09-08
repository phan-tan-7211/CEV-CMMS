import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getSparePart } from '../features/scan/api/partSearchService'
import { createMaintenanceWorkOrder } from '../features/work-orders'
import type { SparePart } from '../features/scan/api/partSearchService'

export function PartWorkOrderScreen({ partId, onBack, onCreated }: { partId: string; onBack: () => void; onCreated: (workOrderId: string) => void }) {
  const [part, setPart] = useState<SparePart | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [equipmentId, setEquipmentId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    void getSparePart(partId).then((value) => {
      if (!active) return
      setPart(value)
      setEquipmentId(value.equipment[0]?.equipmentId || '')
    }).catch((error) => {
      if (active) Alert.alert('Không tải được phụ tùng', error instanceof Error ? error.message : 'Vui lòng thử lại.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [partId])

  async function submit() {
    if (saving || !equipmentId || !reason.trim()) return
    setSaving(true)
    try {
      const result = await createMaintenanceWorkOrder({ equipmentId, reason, priority, sourceType: 'PART_SCAN', sourceId: partId })
      Alert.alert('Đã tạo Work Order', result.workOrderId, [{ text: 'Mở Work Order', onPress: () => onCreated(result.workOrderId) }])
    } catch (error) {
      Alert.alert('Không thể tạo Work Order', error instanceof Error ? error.message : 'Vui lòng thử lại.')
    } finally { setSaving(false) }
  }

  if (loading) return <SafeAreaView style={styles.safeArea}><View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View></SafeAreaView>

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable><Text style={styles.title}>Tạo Work Order</Text><View style={styles.icon} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.partCard}><Ionicons name="construct-outline" size={23} color="#155EEF" /><View style={styles.partCopy}><Text style={styles.label}>Phụ tùng</Text><Text style={styles.partName}>{part?.partName || partId}</Text><Text style={styles.partMeta}>{part?.partId}{part?.barcode ? ` · ${part.barcode}` : ''}</Text></View></View>
      {!part?.equipment.length ? <View style={styles.empty}><Ionicons name="information-circle-outline" size={24} color="#B54708" /><Text style={styles.emptyText}>Phụ tùng chưa được gắn với thiết bị nên chưa thể tạo Work Order.</Text></View> : <>
        <Text style={styles.fieldLabel}>Thiết bị liên quan *</Text>
        {part.equipment.map((item) => <Pressable key={item.equipmentId} onPress={() => setEquipmentId(item.equipmentId)} style={[styles.equipmentRow, equipmentId === item.equipmentId && styles.equipmentActive]}><Ionicons name={equipmentId === item.equipmentId ? 'radio-button-on' : 'radio-button-off'} size={21} color={equipmentId === item.equipmentId ? '#155EEF' : '#98A2B3'} /><View><Text style={styles.equipmentName}>{item.equipmentName}</Text><Text style={styles.equipmentId}>{item.equipmentId}</Text></View></Pressable>)}
        <Text style={styles.fieldLabel}>Nội dung công việc *</Text>
        <TextInput value={reason} onChangeText={setReason} multiline placeholder="Mô tả sự cố hoặc công việc cần thực hiện" placeholderTextColor="#98A2B3" style={styles.textarea} />
        <Text style={styles.fieldLabel}>Mức ưu tiên</Text>
        <View style={styles.priorityRow}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <Pressable key={item} onPress={() => setPriority(item)} style={[styles.priority, priority === item && styles.priorityActive]}><Text style={[styles.priorityText, priority === item && styles.priorityTextActive]}>{item}</Text></Pressable>)}</View>
      </>}
    </ScrollView>
    {Boolean(part?.equipment.length) && <View style={styles.bottom}><Pressable disabled={saving || !reason.trim() || !equipmentId} onPress={() => void submit()} style={[styles.submit, (saving || !reason.trim() || !equipmentId) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Tạo Work Order</Text>}</Pressable></View>}
  </SafeAreaView>
}

const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:'#F8F9FB'}, center:{flex:1,alignItems:'center',justifyContent:'center'}, header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'}, icon:{width:46,height:46,alignItems:'center',justifyContent:'center'}, title:{fontSize:20,fontWeight:'900',color:'#101828'}, content:{padding:16,paddingBottom:30}, partCard:{padding:14,flexDirection:'row',alignItems:'center',gap:10,borderRadius:14,backgroundColor:'#EFF4FF'}, partCopy:{flex:1}, label:{fontSize:12,fontWeight:'800',color:'#667085'}, partName:{marginTop:3,fontSize:16,fontWeight:'900',color:'#155EEF'}, partMeta:{marginTop:3,fontSize:12,color:'#667085'}, fieldLabel:{marginTop:22,marginBottom:8,fontSize:14,fontWeight:'900',color:'#344054'}, equipmentRow:{padding:13,marginBottom:8,flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#EAECF0',borderRadius:12,backgroundColor:'#FFF'}, equipmentActive:{borderColor:'#84ADFF',backgroundColor:'#F5F8FF'}, equipmentName:{fontSize:14,fontWeight:'800',color:'#101828'}, equipmentId:{marginTop:2,fontSize:12,color:'#667085'}, textarea:{minHeight:125,padding:13,borderWidth:1,borderColor:'#D0D5DD',borderRadius:12,fontSize:15,color:'#101828',textAlignVertical:'top',backgroundColor:'#FFF'}, priorityRow:{flexDirection:'row',flexWrap:'wrap',gap:8}, priority:{paddingHorizontal:13,paddingVertical:10,borderRadius:18,backgroundColor:'#F2F4F7'}, priorityActive:{backgroundColor:'#155EEF'}, priorityText:{fontSize:12,fontWeight:'800',color:'#475467'}, priorityTextActive:{color:'#FFF'}, empty:{marginTop:18,padding:14,flexDirection:'row',gap:10,borderRadius:12,backgroundColor:'#FFFAEB'}, emptyText:{flex:1,fontSize:14,lineHeight:21,color:'#93370D'}, bottom:{padding:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0',backgroundColor:'#FFF'}, submit:{minHeight:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'}, disabled:{opacity:.45}, submitText:{fontSize:16,fontWeight:'900',color:'#FFF'} })
