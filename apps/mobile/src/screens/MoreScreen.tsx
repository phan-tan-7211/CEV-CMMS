import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEffect, useState } from 'react'

import { AppBottomNav } from '../components/AppBottomNav'
import { GlobalCreateSheet } from '../components/GlobalCreateSheet'
import { consumePendingCreateAction } from '../features/navigation/pendingCreateAction'
import { CoreParityScreen } from './CoreParityScreen'
import { NotificationsScreen } from './NotificationsScreen'
import { OeeScreen } from './OeeScreen'
import { PurchaseOrdersScreen } from './PurchaseOrdersScreen'
import { SchedulerScreen } from './SchedulerScreen'
import { CreateTargetPickerScreen } from './CreateTargetPickerScreen'
import { CreateWorkOrderScreen } from './CreateWorkOrderScreen'
import { CreateRequestScreen } from './CreateRequestScreen'
import { LocationFormScreen } from './LocationFormScreen'
import { PartFormScreen } from './PartFormScreen'
import { CompanyFormScreen } from './CompanyFormScreen'
import { MeterFormScreen } from './MeterFormScreen'

type IconName = keyof typeof Ionicons.glyphMap
type MoreMenuItem = { key: string; label: string; icon: IconName; iconColor: string; backgroundColor: string }
type CreateFlow = 'work-order'|'request'|'location'|'meter'|'part'|'vendor'|'customer'|null
type MoreScreenProps = {
  onHome: () => void
  onOpenWorkOrders: () => void
  onOpenWorkOrderDrafts: () => void
  onOpenRequests: () => void
  onOpenEquipment: () => void
  onCreateEquipment: () => void
  onOpenOperatorScan: () => void
  onOpenParts: () => void
  onOpenLocations: () => void
  onOpenInventory: () => void
  onOpenMeters: () => void
  onOpenVendors: () => void
  onOpenPeople: () => void
  onOpenPreventiveMaintenance: () => void
  isAdmin?: boolean
  isOperatorFlow?: boolean
}

const MENU_ITEMS: MoreMenuItem[] = [
  { key:'notifications',label:'Thông báo',icon:'notifications-outline',iconColor:'#155EEF',backgroundColor:'#E8EEFF' },
  { key:'core-parity',label:'CMMS nâng cao',icon:'construct-outline',iconColor:'#7F56D9',backgroundColor:'#F1EAFE' },
  { key:'locations',label:'Vị trí',icon:'location',iconColor:'#2E90FA',backgroundColor:'#DCE5E9' },
  { key:'assets',label:'Tài sản',icon:'cube-outline',iconColor:'#F79009',backgroundColor:'#F3EBD8' },
  { key:'requests',label:'Yêu cầu',icon:'clipboard-outline',iconColor:'#12B76A',backgroundColor:'#DDF7EA' },
  { key:'work-order-drafts',label:'Bản nháp Work Order',icon:'document-text-outline',iconColor:'#155EEF',backgroundColor:'#E8EEFF' },
  { key:'parts',label:'Phụ tùng',icon:'archive-outline',iconColor:'#7F56D9',backgroundColor:'#E7DDEB' },
  { key:'inventory',label:'Kho & Tồn kho',icon:'file-tray-stacked-outline',iconColor:'#6941C6',backgroundColor:'#EEE6FF' },
  { key:'purchasing',label:'Mua hàng & Reorder',icon:'cart-outline',iconColor:'#B54708',backgroundColor:'#FFF3E0' },
  { key:'meters',label:'Đồng hồ đo',icon:'speedometer-outline',iconColor:'#E31B54',backgroundColor:'#E8DEDC' },
  { key:'preventive-maintenance',label:'Bảo trì định kỳ',icon:'calendar-outline',iconColor:'#12B76A',backgroundColor:'#DDF7EA' },
  { key:'scheduler',label:'Lịch trình',icon:'calendar-number-outline',iconColor:'#155EEF',backgroundColor:'#E8EEFF' },
  { key:'oee',label:'Hiệu suất OEE',icon:'analytics-outline',iconColor:'#0E7090',backgroundColor:'#E0F2FE' },
  { key:'people-teams',label:'Người & Nhóm',icon:'person',iconColor:'#155EEF',backgroundColor:'#DCE5E9' },
  { key:'vendors-contractors',label:'Nhà cung cấp & Nhà thầu',icon:'people-circle-outline',iconColor:'#F79009',backgroundColor:'#E8E5D8' },
]

function isCreateFlow(value: string | null): value is Exclude<CreateFlow,null> {
  return value === 'work-order' || value === 'request' || value === 'location' || value === 'meter' || value === 'part' || value === 'vendor' || value === 'customer'
}

export function MoreScreen({ onHome,onOpenWorkOrders,onOpenWorkOrderDrafts,onOpenRequests,onOpenEquipment,onCreateEquipment,onOpenOperatorScan,onOpenParts,onOpenLocations,onOpenInventory,onOpenMeters,onOpenVendors,onOpenPeople,onOpenPreventiveMaintenance,isAdmin=false,isOperatorFlow=false }: MoreScreenProps) {
  const [pendingCreate] = useState(() => consumePendingCreateAction())
  const [createMenuOpen,setCreateMenuOpen]=useState(false)
  const [createFlow,setCreateFlow]=useState<CreateFlow>(()=>isCreateFlow(pendingCreate)?pendingCreate:null)
  const [targetEquipmentId,setTargetEquipmentId]=useState('')
  const [coreParityOpen,setCoreParityOpen]=useState(()=>Boolean(pendingCreate&&['checklist','custom-fields','files','floor-plan'].includes(pendingCreate)))
  const [notificationsOpen,setNotificationsOpen]=useState(false)
  const [oeeOpen,setOeeOpen]=useState(false)
  const [schedulerOpen,setSchedulerOpen]=useState(false)
  const [purchasingOpen,setPurchasingOpen]=useState(false)
  useEffect(()=>{if(pendingCreate==='pm')onOpenPreventiveMaintenance();else if(pendingCreate==='user')onOpenPeople()},[onOpenPeople,onOpenPreventiveMaintenance,pendingCreate])
  function resetCreate(){setCreateFlow(null);setTargetEquipmentId('')}
  function handleCenterAction(){ if(isOperatorFlow){onOpenOperatorScan();return} setCreateMenuOpen(true) }
  function handleCreateAction(key:string){
    if(key==='equipment'){onCreateEquipment();return}
    if(isCreateFlow(key)){setCreateFlow(key);setTargetEquipmentId('');return}
    if(key==='pm'){onOpenPreventiveMaintenance();return}
    if(key==='user'){onOpenPeople();return}
    if(key==='checklist'||key==='custom-fields'||key==='files'||key==='floor-plan'){setCoreParityOpen(true);return}
  }
  if(createFlow==='work-order'&&!targetEquipmentId) return <CreateTargetPickerScreen title="Tạo Work Order" onBack={resetCreate} onSelect={setTargetEquipmentId}/>
  if(createFlow==='request'&&!targetEquipmentId) return <CreateTargetPickerScreen title="Tạo yêu cầu sửa chữa" onBack={resetCreate} onSelect={setTargetEquipmentId}/>
  if(createFlow==='work-order'&&targetEquipmentId) return <CreateWorkOrderScreen equipmentId={targetEquipmentId} onBack={resetCreate} onCreated={()=>{resetCreate();onOpenWorkOrders()}}/>
  if(createFlow==='request'&&targetEquipmentId) return <CreateRequestScreen equipmentId={targetEquipmentId} sourceId="GLOBAL_CREATE" onBack={resetCreate} onCreated={()=>{resetCreate();onOpenRequests()}}/>
  if(createFlow==='location') return <LocationFormScreen onBack={()=>{resetCreate();onOpenLocations()}}/>
  if(createFlow==='meter') return <MeterFormScreen onBack={resetCreate} onSaved={()=>{resetCreate();onOpenMeters()}}/>
  if(createFlow==='part') return <PartFormScreen onBack={resetCreate} onSaved={()=>{resetCreate();onOpenParts()}}/>
  if(createFlow==='vendor') return <CompanyFormScreen onBack={()=>{resetCreate();onOpenVendors()}}/>
  if(createFlow==='customer') return <CompanyFormScreen customer onBack={()=>{resetCreate();onOpenVendors()}}/>
  if(coreParityOpen) return <CoreParityScreen onBack={()=>setCoreParityOpen(false)}/>
  if(notificationsOpen) return <NotificationsScreen onBack={()=>setNotificationsOpen(false)}/>
  if(purchasingOpen) return <PurchaseOrdersScreen onBack={()=>setPurchasingOpen(false)} onAddVendor={()=>{setPurchasingOpen(false);onOpenVendors()}}/>
  if(schedulerOpen) return <SchedulerScreen onBack={()=>setSchedulerOpen(false)} onOpenWorkOrder={()=>{setSchedulerOpen(false);onOpenWorkOrders()}}/>
  if(oeeOpen) return <OeeScreen onBack={()=>setOeeOpen(false)}/>
  return <SafeAreaView style={styles.safeArea} edges={['top','bottom']}><StatusBar style="dark"/><View style={styles.shell}><View style={styles.header}><Text style={styles.title}>Thêm</Text></View><ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>{MENU_ITEMS.map((item)=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>{
    if(item.key==='notifications') return setNotificationsOpen(true)
    if(item.key==='core-parity') return setCoreParityOpen(true)
    if(item.key==='work-order-drafts') return onOpenWorkOrderDrafts()
    if(item.key==='parts') return onOpenParts()
    if(item.key==='locations') return onOpenLocations()
    if(item.key==='inventory') return onOpenInventory()
    if(item.key==='purchasing') return setPurchasingOpen(true)
    if(item.key==='meters') return onOpenMeters()
    if(item.key==='people-teams') return onOpenPeople()
    if(item.key==='vendors-contractors') return onOpenVendors()
    if(item.key==='preventive-maintenance') return onOpenPreventiveMaintenance()
    if(item.key==='scheduler') return setSchedulerOpen(true)
    if(item.key==='oee') return setOeeOpen(true)
    if(item.key==='requests') return onOpenRequests()
    if(item.key==='assets') return onOpenEquipment()
  }} style={({pressed})=>[styles.menuCard,{backgroundColor:item.backgroundColor},pressed&&styles.menuCardPressed]}><Text style={styles.menuLabel} numberOfLines={2}>{item.label}</Text><Ionicons name={item.icon} size={29} color={item.iconColor}/></Pressable>)}</ScrollView><AppBottomNav activeTab="more" onHome={onHome} onWorkOrders={onOpenWorkOrders} onCenterPress={handleCenterAction} onRequests={onOpenRequests} onMore={()=>{}} centerMode={isOperatorFlow?'scan':'create'}/></View><GlobalCreateSheet visible={createMenuOpen&&!isOperatorFlow} isAdmin={isAdmin} onClose={()=>setCreateMenuOpen(false)} onAction={handleCreateAction}/></SafeAreaView>
}

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#FFFFFF'},shell:{flex:1,backgroundColor:'#F8F9FB'},header:{minHeight:64,paddingHorizontal:16,justifyContent:'center',backgroundColor:'#FFFFFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},title:{fontSize:24,lineHeight:30,fontWeight:'900',color:'#101828',letterSpacing:-.45},content:{flex:1},contentContainer:{paddingHorizontal:14,paddingTop:12,paddingBottom:18,gap:10},menuCard:{minHeight:88,borderRadius:14,paddingHorizontal:18,paddingVertical:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14},menuCardPressed:{opacity:.78,transform:[{scale:.995}]},menuLabel:{flex:1,fontSize:18,lineHeight:23,fontWeight:'800',color:'#202124',letterSpacing:-.3}})
