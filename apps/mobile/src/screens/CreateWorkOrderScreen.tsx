import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LiveSelectionModal, type LiveSelectionItem } from '../components/LiveSelectionModal'
import { listPeople, listTeams } from '../features/master-data'
import {
  getLatestCreateDraftForEquipment,
  getLocalWorkOrderDraft,
  isLikelyNetworkError,
  saveWorkOrderCreateDraft,
  submitWorkOrderDraft,
  type WorkOrderDraftSyncState,
} from '../features/work-orders'

type PickerKind = 'people' | 'teams' | null

const DRAFT_LABEL: Record<WorkOrderDraftSyncState, string> = {
  LOCAL: 'Đã lưu bản nháp trên thiết bị',
  SYNCED: 'Bản nháp đã đồng bộ',
  QUEUED: 'Đang chờ kết nối để gửi',
  ERROR: 'Bản nháp cần kiểm tra lại',
}

export function CreateWorkOrderScreen({
  equipmentId,
  draftLocalId,
  onBack,
  onCreated,
}: {
  equipmentId: string
  draftLocalId?: string
  onBack: () => void
  onCreated: (workOrderId: string) => void
}) {
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [saving, setSaving] = useState(false)
  const [picker,setPicker]=useState<PickerKind>(null)
  const [pickerItems,setPickerItems]=useState<LiveSelectionItem[]>([])
  const [pickerLoading,setPickerLoading]=useState(false)
  const [pickerError,setPickerError]=useState('')
  const [person,setPerson]=useState<LiveSelectionItem|null>(null)
  const [team,setTeam]=useState<LiveSelectionItem|null>(null)
  const [hydrated,setHydrated]=useState(false)
  const [draftState,setDraftState]=useState<WorkOrderDraftSyncState|null>(null)
  const localDraftIdRef=useRef<string|undefined>(draftLocalId)

  useEffect(()=>{
    let active=true
    setHydrated(false)
    const loader = draftLocalId
      ? getLocalWorkOrderDraft(draftLocalId)
      : getLatestCreateDraftForEquipment(equipmentId)
    void loader.then((draft)=>{
      if(!active||!draft)return
      if (draft.payload.equipmentId !== equipmentId) return
      localDraftIdRef.current=draft.localId
      setReason(draft.payload.reason||'')
      setPriority(draft.payload.priority||'MEDIUM')
      setPerson(draft.payload.person||null)
      setTeam(draft.payload.team||null)
      setDraftState(draft.syncState)
    }).finally(()=>{if(active)setHydrated(true)})
    return()=>{active=false}
  },[draftLocalId,equipmentId])

  useEffect(()=>{
    if(!hydrated)return undefined
    const hasContent=Boolean(reason.trim()||person||team||priority!=='MEDIUM')
    if(!hasContent)return undefined
    const handle=setTimeout(()=>{
      void saveWorkOrderCreateDraft({
        localId:localDraftIdRef.current,
        payload:{equipmentId,reason,priority,person,team},
      }).then((draft)=>{
        localDraftIdRef.current=draft.localId
        setDraftState(draft.syncState)
      })
    },800)
    return()=>clearTimeout(handle)
  },[equipmentId,hydrated,person,priority,reason,team])

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
    if (saving || !reason.trim()) return
    setSaving(true)
    try {
      const draft=await saveWorkOrderCreateDraft({
        localId:localDraftIdRef.current,
        payload:{equipmentId,reason,priority,person,team},
        submitOnReconnect:true,
      })
      localDraftIdRef.current=draft.localId
      setDraftState('QUEUED')
      const result=await submitWorkOrderDraft(draft)
      setDraftState(null)
      Alert.alert('Đã tạo Work Order', result.workOrderId, [{ text: 'Mở Work Order', onPress: () => onCreated(result.workOrderId) }])
    } catch (error) {
      if(isLikelyNetworkError(error)) {
        setDraftState('QUEUED')
        Alert.alert('Đã lưu bản nháp', 'Thiết bị đang ngoại tuyến. Work Order sẽ tự gửi khi kết nối trở lại.')
      } else {
        setDraftState('ERROR')
        Alert.alert('Chưa thể tạo Work Order', error instanceof Error ? error.message : 'Vui lòng kiểm tra lại dữ liệu.')
      }
    } finally { setSaving(false) }
  }

  const priorities: Array<[string, string]> = [['LOW', 'Thấp'], ['MEDIUM', 'Trung bình'], ['HIGH', 'Cao'], ['CRITICAL', 'Khẩn cấp']]
  return <>
  <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} hitSlop={8} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable><Text style={styles.title}>{draftLocalId ? 'Chỉnh sửa bản nháp' : 'Tạo Work Order'}</Text><View style={styles.icon} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.assetCard}><Ionicons name="cube-outline" size={23} color="#155EEF" /><View style={styles.assetCopy}><Text style={styles.label}>Thiết bị</Text><Text style={styles.assetId}>{equipmentId}</Text></View></View>
      {draftState?<View style={[styles.draftBanner,draftState==='QUEUED'&&styles.draftQueued,draftState==='ERROR'&&styles.draftError]}><Ionicons name={draftState==='QUEUED'?'cloud-offline-outline':draftState==='ERROR'?'alert-circle-outline':'document-text-outline'} size={18} color={draftState==='ERROR'?'#B42318':'#475467'} /><Text style={[styles.draftText,draftState==='ERROR'&&styles.draftErrorText]}>{DRAFT_LABEL[draftState]}</Text></View>:null}
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
const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:'#F1F1FA'}, header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5E5EF'}, icon:{width:46,height:46,alignItems:'center',justifyContent:'center'}, title:{fontSize:20,fontWeight:'900',color:'#101828'}, content:{padding:14,paddingBottom:30}, assetCard:{padding:15,flexDirection:'row',alignItems:'center',gap:10,borderRadius:17,backgroundColor:'#E9EDFF'}, assetCopy:{flex:1}, label:{fontSize:12,fontWeight:'800',color:'#667085'}, assetId:{marginTop:3,fontSize:16,fontWeight:'900',color:'#155EEF'}, draftBanner:{marginTop:12,minHeight:42,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,borderRadius:12,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'}, draftQueued:{borderColor:'#FEDF89',backgroundColor:'#FFFAEB'}, draftError:{borderColor:'#FECDCA',backgroundColor:'#FEF3F2'}, draftText:{flex:1,fontSize:12.5,fontWeight:'800',color:'#475467'},draftErrorText:{color:'#B42318'}, fieldLabel:{marginTop:22,marginBottom:8,fontSize:13.5,fontWeight:'900',color:'#344054'}, textarea:{minHeight:125,padding:14,borderWidth:1,borderColor:'#D7D8E5',borderRadius:16,fontSize:15,color:'#101828',textAlignVertical:'top',backgroundColor:'#FFF'}, priorityRow:{flexDirection:'row',flexWrap:'wrap',gap:8}, priority:{paddingHorizontal:14,paddingVertical:11,borderRadius:18,borderWidth:1,borderColor:'#D9DAE7',backgroundColor:'#FFF'}, priorityActive:{borderColor:'#536DFE',backgroundColor:'#536DFE'}, priorityText:{fontSize:12,fontWeight:'800',color:'#475467'}, priorityTextActive:{color:'#FFF'}, selectRow:{minHeight:55,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:15,borderWidth:1,borderColor:'#D7D8E5',backgroundColor:'#FFF'}, selectPlaceholder:{flex:1,fontSize:14,color:'#98A2B3'},selectValue:{flex:1,fontSize:14,fontWeight:'800',color:'#101828'}, bottom:{padding:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0',backgroundColor:'#FFF'}, submit:{minHeight:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#536DFE'}, disabled:{opacity:.45}, submitText:{fontSize:16,fontWeight:'900',color:'#FFF'} })