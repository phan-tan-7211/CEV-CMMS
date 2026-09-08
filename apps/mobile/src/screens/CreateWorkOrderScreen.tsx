import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { createMaintenanceWorkOrder } from '../features/work-orders'

export function CreateWorkOrderScreen({ equipmentId, onBack, onCreated }: { equipmentId: string; onBack: () => void; onCreated: (workOrderId: string) => void }) {
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [saving, setSaving] = useState(false)
  async function submit() {
    if (saving) return
    setSaving(true)
    try {
      const result = await createMaintenanceWorkOrder({ equipmentId, reason, priority })
      Alert.alert('Đã tạo Work Order', result.workOrderId, [{ text: 'Mở Work Order', onPress: () => onCreated(result.workOrderId) }])
    } catch (error) {
      Alert.alert('Không thể tạo Work Order', error instanceof Error ? error.message : 'Vui lòng thử lại.')
    } finally { setSaving(false) }
  }
  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable><Text style={styles.title}>Tạo Work Order</Text><View style={styles.icon} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.assetCard}><Ionicons name="cube-outline" size={23} color="#155EEF" /><View style={styles.assetCopy}><Text style={styles.label}>Thiết bị</Text><Text style={styles.assetId}>{equipmentId}</Text></View></View>
      <Text style={styles.fieldLabel}>Nội dung công việc *</Text>
      <TextInput value={reason} onChangeText={setReason} multiline placeholder="Mô tả sự cố hoặc công việc cần thực hiện" placeholderTextColor="#98A2B3" style={styles.textarea} />
      <Text style={styles.fieldLabel}>Mức ưu tiên</Text>
      <View style={styles.priorityRow}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <Pressable key={item} onPress={() => setPriority(item)} style={[styles.priority, priority === item && styles.priorityActive]}><Text style={[styles.priorityText, priority === item && styles.priorityTextActive]}>{item}</Text></Pressable>)}</View>
    </ScrollView>
    <View style={styles.bottom}><Pressable disabled={saving || !reason.trim()} onPress={() => void submit()} style={[styles.submit, (saving || !reason.trim()) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Tạo Work Order</Text>}</Pressable></View>
  </SafeAreaView>
}
const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:'#F8F9FB'}, header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'}, icon:{width:46,height:46,alignItems:'center',justifyContent:'center'}, title:{fontSize:20,fontWeight:'900',color:'#101828'}, content:{padding:16,paddingBottom:30}, assetCard:{padding:14,flexDirection:'row',alignItems:'center',gap:10,borderRadius:14,backgroundColor:'#EFF4FF'}, assetCopy:{flex:1}, label:{fontSize:12,fontWeight:'800',color:'#667085'}, assetId:{marginTop:3,fontSize:16,fontWeight:'900',color:'#155EEF'}, fieldLabel:{marginTop:22,marginBottom:8,fontSize:14,fontWeight:'900',color:'#344054'}, textarea:{minHeight:125,padding:13,borderWidth:1,borderColor:'#D0D5DD',borderRadius:12,fontSize:15,color:'#101828',textAlignVertical:'top',backgroundColor:'#FFF'}, priorityRow:{flexDirection:'row',flexWrap:'wrap',gap:8}, priority:{paddingHorizontal:13,paddingVertical:10,borderRadius:18,backgroundColor:'#F2F4F7'}, priorityActive:{backgroundColor:'#155EEF'}, priorityText:{fontSize:12,fontWeight:'800',color:'#475467'}, priorityTextActive:{color:'#FFF'}, bottom:{padding:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0',backgroundColor:'#FFF'}, submit:{minHeight:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'}, disabled:{opacity:.45}, submitText:{fontSize:16,fontWeight:'900',color:'#FFF'} })
