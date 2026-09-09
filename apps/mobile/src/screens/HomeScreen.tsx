import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

import { AppBottomNav } from '../components/AppBottomNav'
import { GlobalCreateSheet } from '../components/GlobalCreateSheet'
import { setPendingCreateAction } from '../features/navigation/pendingCreateAction'

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

const QUICK_ACTIONS: Array<{ label: string; icon: IconName; primary?: boolean }> = [
  { label: 'Quét', icon: 'scan-outline', primary: true },
  { label: 'Tác động của tôi', icon: 'bar-chart-outline' },
  { label: 'Apps', icon: 'grid-outline' },
  { label: 'Thông báo', icon: 'notifications-outline' },
  { label: 'Tài sản', icon: 'cube-outline' },
]

const WORK_ORDER_ROWS: Array<{ label: string; accent: string }> = [
  { label: 'Tất cả đang chờ', accent: '#344054' },
  { label: 'Mở', accent: '#BFC5CE' },
  { label: 'Đang thực hiện', accent: '#7A5AF8' },
  { label: 'Tạm dừng', accent: '#F79009' },
  { label: 'Quá hạn', accent: '#E31B54' },
  { label: 'Đến hạn hôm nay', accent: '#2E90FA' },
  { label: 'Ưu tiên cao', accent: '#E31B54' },
]

export function HomeScreen({ onCreateEquipment,onOpenScan,onOpenOperatorScan,onOpenWorkOrders,onOpenEquipment,onOpenRequests,onOpenMore,onOpenSettings,isAdmin=false,isOperatorFlow=false }: HomeScreenProps) {
  const [assignedOnly,setAssignedOnly]=useState(true)
  const [createMenuOpen,setCreateMenuOpen]=useState(false)
  function openMoreAction(action:string){ setPendingCreateAction(action); onOpenMore() }
  function handleQuickAction(label:string){
    if(label==='Quét') return onOpenScan()
    if(label==='Tài sản') return onOpenEquipment()
    if(label==='Thông báo') return openMoreAction('notifications')
    if(label==='Tác động của tôi') return openMoreAction('workload')
    if(label==='Apps') return onOpenMore()
  }
  function handleCenterAction(){if(isOperatorFlow){onOpenOperatorScan();return}setCreateMenuOpen(true)}
  function handleCreateAction(key:string){
    if(key==='equipment'){onCreateEquipment();return}
    setPendingCreateAction(key)
    onOpenMore()
  }

  return <SafeAreaView style={styles.safeArea} edges={['top','bottom']}><StatusBar style="dark"/><View style={styles.shell}><View style={styles.header}><View style={styles.brandRow}><View style={styles.brandMark}><Ionicons name="construct-outline" size={21} color="#FFFFFF"/></View><View><Text style={styles.brand}>CEV CMMS</Text><Text style={styles.brandSub}>Core Electronics Vietnam</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel="Cài đặt tài khoản" hitSlop={8} onPress={onOpenSettings} style={({pressed})=>[styles.settingsButton,pressed&&styles.pressed]}><Ionicons name="settings-outline" size={24} color="#344054"/></Pressable></View><View style={styles.quickStrip}>{QUICK_ACTIONS.map((action)=><Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={()=>handleQuickAction(action.label)} style={({pressed})=>[styles.quickAction,pressed&&styles.quickActionPressed]}><View style={[styles.quickIcon,action.primary&&styles.quickIconPrimary]}><Ionicons name={action.icon} size={action.primary?25:26} color={action.primary?'#FFFFFF':'#344054'}/>{action.label==='Apps'&&<View style={styles.newBadge}><Text style={styles.newBadgeText}>New</Text></View>}{action.label==='Thông báo'&&<View style={styles.notificationDot}/>}</View><Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text></Pressable>)}</View><View style={styles.separator}/><ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}><View style={styles.assignedCard}><View style={styles.assignedCopy}><Text style={styles.assignedTitle}>Chỉ công việc giao cho tôi</Text></View><Switch value={assignedOnly} onValueChange={setAssignedOnly} trackColor={{false:'#D0D5DD',true:'#84ADFF'}} thumbColor={assignedOnly?'#155EEF':'#F2F4F7'}/></View><View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>Bảng điều khiển Work Order</Text><Pressable accessibilityRole="button" accessibilityLabel="Chỉnh sửa bảng điều khiển" hitSlop={8} onPress={onOpenWorkOrders}><Text style={styles.editText}>Chỉnh sửa</Text></Pressable></View><View style={styles.dashboardList}>{WORK_ORDER_ROWS.map((row)=><Pressable key={row.label} accessibilityRole="button" accessibilityLabel={row.label} onPress={onOpenWorkOrders} style={({pressed})=>[styles.statusRow,pressed&&styles.statusRowPressed]}><View style={[styles.statusAccent,{backgroundColor:row.accent}]}/><Text style={styles.statusLabel}>{row.label}</Text><Ionicons name="chevron-forward" size={23} color="#B0B7C3"/></Pressable>)}</View></ScrollView><AppBottomNav activeTab="home" onHome={()=>{}} onWorkOrders={onOpenWorkOrders} onCenterPress={handleCenterAction} onRequests={onOpenRequests} onMore={onOpenMore} centerMode={isOperatorFlow?'scan':'create'}/></View><GlobalCreateSheet visible={createMenuOpen&&!isOperatorFlow} isAdmin={isAdmin} onClose={()=>setCreateMenuOpen(false)} onAction={handleCreateAction}/></SafeAreaView>
}

const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:'#FFFFFF'},shell:{flex:1,backgroundColor:'#F2F1FB'},header:{minHeight:70,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFFFFF'},brandRow:{flexDirection:'row',alignItems:'center',gap:9},brandMark:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#155EEF'},brand:{fontSize:19,lineHeight:23,fontWeight:'900',color:'#101828',letterSpacing:-.35},brandSub:{marginTop:1,fontSize:10,lineHeight:13,fontWeight:'600',color:'#98A2B3'},settingsButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},quickStrip:{minHeight:112,paddingHorizontal:5,paddingTop:10,paddingBottom:11,flexDirection:'row',alignItems:'flex-start',backgroundColor:'#FFFFFF'},quickAction:{flex:1,minWidth:0,alignItems:'center'},quickActionPressed:{opacity:.72,transform:[{scale:.98}]},quickIcon:{width:56,height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:'#F2F4F7'},quickIconPrimary:{backgroundColor:'#155EEF'},newBadge:{position:'absolute',top:-7,right:-13,minWidth:45,paddingHorizontal:7,paddingVertical:3,borderRadius:14,backgroundColor:'#2E90FA'},newBadgeText:{textAlign:'center',fontSize:11,lineHeight:15,fontWeight:'700',color:'#FFFFFF'},notificationDot:{position:'absolute',top:3,right:3,width:12,height:12,borderRadius:6,borderWidth:2,borderColor:'#FFFFFF',backgroundColor:'#2E90FA'},quickLabel:{marginTop:6,paddingHorizontal:2,textAlign:'center',fontSize:11.5,lineHeight:14,fontWeight:'600',color:'#344054'},separator:{height:8,backgroundColor:'#E6E5F0'},content:{flex:1},contentContainer:{paddingHorizontal:14,paddingTop:14,paddingBottom:18},assignedCard:{minHeight:62,marginBottom:12,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:'#DDE1E7',backgroundColor:'#FFFFFF'},assignedCopy:{flex:1,paddingRight:12},assignedTitle:{fontSize:13.5,lineHeight:18,fontWeight:'800',color:'#344054'},sectionHeadingRow:{minHeight:32,marginBottom:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},sectionTitle:{flex:1,fontSize:19,lineHeight:24,fontWeight:'900',color:'#1D2939',letterSpacing:-.4},editText:{fontSize:12.5,lineHeight:17,fontWeight:'800',color:'#155EEF'},dashboardList:{gap:7},statusRow:{minHeight:68,paddingRight:12,flexDirection:'row',alignItems:'center',borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:'#DDE1E7',backgroundColor:'#FFFFFF'},statusRowPressed:{backgroundColor:'#F9FAFB'},statusAccent:{width:4,height:42,marginLeft:11,marginRight:11,borderRadius:3},statusLabel:{flex:1,fontSize:16,lineHeight:21,fontWeight:'800',color:'#20242A'},pressed:{opacity:.64}})
