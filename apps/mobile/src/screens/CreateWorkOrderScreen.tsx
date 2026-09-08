import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiveSelectionModal, type LiveSelectionItem } from '../components/LiveSelectionModal'
import { listPeople, listTeams } from '../features/master-data'
import { createMaintenanceWorkOrder } from '../features/work-orders'

type PickerKind = 'people' | 'teams' | null

export function CreateWorkOrderScreen({ equipmentId, onBack, onCreated }: { equipmentId: string; onBack: () => void; onCreated: (workOrderId: string) => void }) {
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [saving, setSaving] = useState(false)
  const [picker,setPicker]=useState<PickerKind>(null)
  const [pickerItems,setPickerItems]=useState<LiveSelectionItem[]>([])
  const [pickerLoading,setPickerLoading]=useState(false)
  const [pickerError,setPickerError]=useState('')
  const [person,setPerson]=useState<LiveSelectionItem|null>(null)
  const [team,setTeam]=useState<LiveSelectionItem|null>(null)

  async function openPicker(kind: Exclude<PickerKind,null>) {
    setPicker(kind);setPickerLoading(true);setPickerError('');setPickerItems([])
    try {
      if(kind==='people') {
        const rows=await listPeople()
        setPickerItems(rows.map((item)=>({id:item.id,title:item.name,subtitle:item.jobTitle||item.email,meta:[item.roleCode,item.teamCount?`${item.teamCount} nhóm`:null].filter(Boolean).join(' • ')})))
      } else {
        const rows=await listTeams()
        setPickerItems(rows.map((item)=>({id:item.id,title:item.name,subtitle:item.description,meta:`${item.memberCount} thành viên • ${item.leadCount} trưởng nhóm`})))
      }
    } catch(error) { setPickerError(error instanceof Error?error.message:'Không tải được danh sách.') }
    finally { setPickerLoading(false) }
  }

  async function submit() {
    if (saving) return
    setSaving(true)
    try {
      const result = await createMaintenanceWorkOrder({ equipmentId, reason, priority, personIds:person?[person.id]:[], teamIds:team?[team.id]:[] })
      Alert.alert('Đã tạo Work Order', result.workOrderId, [{ text: 'Mở Work Order', onPress: () => onCreated(result.workOrderId) }])
    } catch (error) {
      Alert.alert('Không thể tạo Work Order', error instanceof Error ? error.message : 'Vui lòng thử lại.')
    } finally { setSaving(false) }
  }
  const priorities: Array<[string, string]> = [['LOW', 'Thấp'], ['MEDIUM', 'Trung bình'], ['HIGH', 'Cao'], ['CRITICAL', 'Khẩn cấp']]
  return <>
  <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable><Text style={styles.title}>Tạo Work Order</Text><View style={styles.icon} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.assetCard}><Ionicons name="cube-outline" size={23} color="#155EEF" /><View style={styles.assetCopy}><Text style={styles.label}>Thiết bị</Text><Text style={styles.assetId}>{equipmentId}</Text></View></View>
      <Text style={styles.fieldLabel}>Nội dung công việc *</Text>
      <TextInput value={reason} onChangeText={setReason} multiline placeholder="Mô tả sự cố hoặc công việc cần thực hiện" placeholderTextColor="#98A2B3" style={styles.textarea} />
      <Text style={styles.fieldLabel}>Mức ưu tiên</Text>
      <View style={styles.priorityRow}>{priorities.map(([value, label]) => <Pressable key={value} onPress={() => setPriority(value)} style={[styles.priority, priority === value && styles.priorityActive]}><Text style={[styles.priorityText, priority === value && styles.priorityTextActive]}>{label}</Text></Pressable>)}</View>
      <Text style={styles.fieldLabel}>Người dùng được giao</Text>
      <Pressable onPress={()=>void openPicker('people')} style={styles.selectRow}><Text style={person?styles.selectValue:styles.selectPlaceholder}>{person?.title||'Chọn người thực hiện'}</Text><Ionicons name="chevron-forward" size={21} color="#98A2B3" /></Pressable>
      <Text style={styles.fieldLabel}>Nhóm được giao</Text>
      <Pressable onPress={()=>void openPicker('teams')} style={styles.selectRow}><Text style={team?styles.selectValue:styles.selectPlaceholder}>{team?.title||'Chọn nhóm thực hiện'}</Text><Ionicons name="chevron-forward" size={21} color="#98A2B3" /></Pressable>
    </ScrollView>
    <View style={styles.bottom}><Pressable disabled={saving || !reason.trim()} onPress={() => void submit()} style={[styles.submit, (saving || !reason.trim()) && styles.disabled]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Tạo Work Order</Text>}</Pressable></View>
  </SafeAreaView>
  <LiveSelectionModal visible={picker!==null} title={picker==='people'?'Chọn người':'Chọn nhóm'} items={pickerItems} selectedId={picker==='people'?person?.id:team?.id} loading={pickerLoading} error={pickerError} onClose={()=>setPicker(null)} onSelect={(item)=>{if(picker==='people')setPerson(item);else setTeam(item);setPicker(null)}}/>
  </>
}
const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:'#F1F1FA'}, header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5E5EF'}, icon:{width:46,height:46,alignItems:'center',justifyContent:'center'}, title:{fontSize:20,fontWeight:'900',color:'#101828'}, content:{padding:14,paddingBottom:30}, assetCard:{padding:15,flexDirection:'row',alignItems:'center',gap:10,borderRadius:17,backgroundColor:'#E9EDFF'}, assetCopy:{flex:1}, label:{fontSize:12,fontWeight:'800',color:'#667085'}, assetId:{marginTop:3,fontSize:16,fontWeight:'900',color:'#155EEF'}, fieldLabel:{marginTop:22,marginBottom:8,fontSize:13.5,fontWeight:'900',color:'#344054'}, textarea:{minHeight:125,padding:14,borderWidth:1,borderColor:'#D7D8E5',borderRadius:16,fontSize:15,color:'#101828',textAlignVertical:'top',backgroundColor:'#FFF'}, priorityRow:{flexDirection:'row',flexWrap:'wrap',gap:8}, priority:{paddingHorizontal:14,paddingVertical:11,borderRadius:18,borderWidth:1,borderColor:'#D9DAE7',backgroundColor:'#FFF'}, priorityActive:{borderColor:'#536DFE',backgroundColor:'#536DFE'}, priorityText:{fontSize:12,fontWeight:'800',color:'#475467'}, priorityTextActive:{color:'#FFF'}, selectRow:{minHeight:55,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:15,borderWidth:1,borderColor:'#D7D8E5',backgroundColor:'#FFF'}, selectPlaceholder:{flex:1,fontSize:14,color:'#98A2B3'},selectValue:{flex:1,fontSize:14,fontWeight:'800',color:'#101828'}, bottom:{padding:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0',backgroundColor:'#FFF'}, submit:{minHeight:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#536DFE'}, disabled:{opacity:.45}, submitText:{fontSize:16,fontWeight:'900',color:'#FFF'} })
