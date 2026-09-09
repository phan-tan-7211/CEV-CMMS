import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEffect, useMemo, useState } from 'react'

import { AppBottomNav } from '../components/AppBottomNav'
import { GlobalCreateSheet } from '../components/GlobalCreateSheet'
import { setPendingCreateAction } from '../features/navigation/pendingCreateAction'
import { getWorkOrderListSnapshot, revalidateWorkOrderList, type WorkOrderListItem } from '../features/work-orders'

type IconName = keyof typeof Ionicons.glyphMap

type HomeScreenProps = {
  onCreateEquipment: () => void
  onOpenScan: () => void
  onOpenOperatorScan: () => void
  onOpenWorkOrders: () => void
  onOpenEquipment: () => void
  onOpenRequests: () => void
  onOpenMore: () => void
  onOpenSettings: () => void
  isAdmin?: boolean
  isOperatorFlow?: boolean
}

const QUICK_ACTIONS: Array<{ key: string; label: string; icon: IconName; primary?: boolean }> = [
  { key: 'scan', label: 'Quét', icon: 'scan-outline', primary: true },
  { key: 'workload', label: 'Khối lượng', icon: 'bar-chart-outline' },
  { key: 'apps', label: 'Apps', icon: 'grid-outline' },
  { key: 'notifications', label: 'Thông báo', icon: 'notifications-outline' },
  { key: 'assets', label: 'Tài sản', icon: 'cube-outline' },
]

function isClosed(status: string) { return ['COMPLETED','VERIFIED','RELEASED','CANCELLED','CLOSED'].includes(status.toUpperCase()) }
function dueDate(item: WorkOrderListItem) { const d = item.dueDate ? new Date(item.dueDate) : null; return d && Number.isFinite(d.getTime()) ? d : null }
function sameLocalDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }

export function HomeScreen({ onCreateEquipment,onOpenScan,onOpenOperatorScan,onOpenWorkOrders,onOpenEquipment,onOpenRequests,onOpenMore,onOpenSettings,isAdmin=false,isOperatorFlow=false }: HomeScreenProps) {
  const [createMenuOpen,setCreateMenuOpen]=useState(false)
  const [workOrders,setWorkOrders]=useState<WorkOrderListItem[]>([])
  const [loadingCounts,setLoadingCounts]=useState(true)

  useEffect(()=>{
    let active=true
    void getWorkOrderListSnapshot().then((snapshot)=>{if(active&&snapshot)setWorkOrders(snapshot)}).catch(()=>undefined)
    void revalidateWorkOrderList().then((rows)=>{if(active)setWorkOrders(rows)}).catch(()=>undefined).finally(()=>{if(active)setLoadingCounts(false)})
    return()=>{active=false}
  },[])

  const rows=useMemo(()=>{
    const now=new Date(); const active=workOrders.filter((item)=>!isClosed(item.status))
    const count=(fn:(item:WorkOrderListItem)=>boolean)=>active.filter(fn).length
    return [
      { label:'Tất cả đang chờ', count:count((x)=>['OPEN','WAITING_APPROVAL','APPROVED','ON_HOLD','PAUSED'].includes(x.status.toUpperCase())), accent:'#344054' },
      { label:'Mở', count:count((x)=>x.status.toUpperCase()==='OPEN'), accent:'#BFC5CE' },
      { label:'Đang thực hiện', count:count((x)=>x.status.toUpperCase()==='IN_PROGRESS'), accent:'#7A5AF8' },
      { label:'Tạm dừng', count:count((x)=>['ON_HOLD','PAUSED'].includes(x.status.toUpperCase())), accent:'#F79009' },
      { label:'Quá hạn', count:count((x)=>{const d=dueDate(x);return Boolean(d&&d.getTime()<now.getTime()&&!sameLocalDay(d,now))}), accent:'#E31B54' },
      { label:'Đến hạn hôm nay', count:count((x)=>{const d=dueDate(x);return Boolean(d&&sameLocalDay(d,now))}), accent:'#2E90FA' },
      { label:'Ưu tiên cao', count:count((x)=>['HIGH','CRITICAL','URGENT'].includes(x.priority.toUpperCase())), accent:'#E31B54' },
    ]
  },[workOrders])

  function openMoreAction(key:string){setPendingCreateAction(key);onOpenMore()}
  function handleQuickAction(key:string){
    if(key==='scan')return onOpenScan()
    if(key==='assets')return onOpenEquipment()
    if(key==='workload')return openMoreAction('workload')
    if(key==='notifications')return openMoreAction('notifications')
    onOpenMore()
  }
  function handleCenterAction(){if(isOperatorFlow){onOpenOperatorScan();return}setCreateMenuOpen(true)}
  function handleCreateAction(key:string){if(key==='equipment'){onCreateEquipment();return}openMoreAction(key)}

  return <SafeAreaView style={styles.safeArea} edges={['top','bottom']}><StatusBar style="dark"/><View style={styles.shell}><View style={styles.header}><View style={styles.brandRow}><View style={styles.brandMark}><Ionicons name="construct-outline" size={21} color="#FFFFFF"/></View><View><Text style={styles.brand}>CEV CMMS</Text><Text style={styles.brandSub}>Core Electronics Vietnam</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel="Cài đặt tài khoản" hitSlop={8} onPress={onOpenSettings} style={({pressed})=>[styles.settingsButton,pressed&&styles.pressed]}><Ionicons name="settings-outline" size={24} color="#344054"/></Pressable></View><View style={styles.quickStrip}>{QUICK_ACTIONS.map((action)=><Pressable key={action.key} accessibilityRole="button" accessibilityLabel={action.label} onPress={()=>handleQuickAction(action.key)} style={({pressed})=>[styles.quickAction,pressed&&styles.quickActionPressed]}><View style={[styles.quickIcon,action.primary&&styles.quickIconPrimary]}><Ionicons name={action.icon} size={action.primary?25:26} color={action.primary?'#FFFFFF':'#344054'}/>{action.key==='apps'&&<View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>}</View><Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text></Pressable>)}</View><View style={styles.separator}/><ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}><View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>Bảng điều khiển Work Order</Text><Text style={styles.sectionSub}>{loadingCounts?'Đang đồng bộ dữ liệu thật…':`${workOrders.length} Work Order đã tải`}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Mở khối lượng công việc" hitSlop={8} onPress={()=>openMoreAction('workload')}><Text style={styles.editText}>Khối lượng</Text></Pressable></View><View style={styles.dashboardList}>{rows.map((row)=><Pressable key={row.label} accessibilityRole="button" accessibilityLabel={`${row.label}: ${row.count}`} onPress={onOpenWorkOrders} style={({pressed})=>[styles.statusRow,pressed&&styles.statusRowPressed]}><View style={[styles.statusAccent,{backgroundColor:row.accent}]}/><Text style={styles.statusLabel}>{row.label}</Text><Text style={styles.statusCount}>{loadingCounts?'—':row.count}</Text><Ionicons name="chevron-forward" size={23} color="#B0B7C3"/></Pressable>)}</View></ScrollView><AppBottomNav activeTab="home" onHome={()=>{}} onWorkOrders={onOpenWorkOrders} onCenterPress={handleCenterAction} onRequests={onOpenRequests} onMore={onOpenMore} centerMode={isOperatorFlow?'scan':'create'}/></View><GlobalCreateSheet visible={createMenuOpen&&!isOperatorFlow} isAdmin={isAdmin} onClose={()=>setCreateMenuOpen(false)} onAction={handleCreateAction}/></SafeAreaView>
}

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#FFFFFF'},shell:{flex:1,backgroundColor:'#F2F1FB'},header:{minHeight:70,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFFFFF'},brandRow:{flexDirection:'row',alignItems:'center',gap:9},brandMark:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'},brand:{fontSize:19,lineHeight:23,fontWeight:'900',color:'#101828',letterSpacing:-.35},brandSub:{marginTop:1,fontSize:10,lineHeight:13,fontWeight:'600',color:'#98A2B3'},settingsButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},quickStrip:{minHeight:112,paddingHorizontal:5,paddingTop:10,paddingBottom:11,flexDirection:'row',alignItems:'flex-start',backgroundColor:'#FFFFFF'},quickAction:{flex:1,minWidth:0,alignItems:'center'},quickActionPressed:{opacity:.72,transform:[{scale:.98}]},quickIcon:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:'#F2F4F7'},quickIconPrimary:{backgroundColor:'#155EEF'},newBadge:{position:'absolute',top:-7,right:-13,minWidth:45,paddingHorizontal:7,paddingVertical:3,borderRadius:14,backgroundColor:'#2E90FA'},newBadgeText:{textAlign:'center',fontSize:11,lineHeight:15,fontWeight:'700',color:'#FFFFFF'},quickLabel:{marginTop:6,paddingHorizontal:2,textAlign:'center',fontSize:11.5,lineHeight:14,fontWeight:'600',color:'#344054'},separator:{height:8,backgroundColor:'#E6E5F0'},content:{flex:1},contentContainer:{paddingHorizontal:14,paddingTop:14,paddingBottom:18},sectionHeadingRow:{minHeight:46,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},sectionTitle:{fontSize:19,lineHeight:24,fontWeight:'900',color:'#1D2939',letterSpacing:-.4},sectionSub:{marginTop:2,fontSize:11,color:'#667085'},editText:{fontSize:12.5,lineHeight:17,fontWeight:'800',color:'#155EEF'},dashboardList:{gap:7},statusRow:{minHeight:68,paddingRight:12,flexDirection:'row',alignItems:'center',borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:'#DDE1E7',backgroundColor:'#FFFFFF'},statusRowPressed:{backgroundColor:'#F9FAFB'},statusAccent:{width:4,height:42,marginLeft:11,marginRight:11,borderRadius:3},statusLabel:{flex:1,fontSize:16,lineHeight:21,fontWeight:'800',color:'#20242A'},statusCount:{minWidth:26,marginHorizontal:7,textAlign:'right',fontSize:18,lineHeight:22,fontWeight:'500',color:'#667085'},pressed:{opacity:.64}})
