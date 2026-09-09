import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listSchedulerEvents, listSchedulerOptions, type SchedulerEvent, type SchedulerOption } from '../features/scheduler'

function addDays(date: Date, days: number) { const next = new Date(date); next.setDate(next.getDate()+days); return next }
function cardName(event: SchedulerEvent) { return event.title || event.workOrderId || event.equipmentName || 'Work Order' }

export function WorkloadPlanningScreen({ onBack, onOpenScheduler, onOpenWorkOrder }: { onBack: () => void; onOpenScheduler: () => void; onOpenWorkOrder: (workOrderId: string) => void }) {
  const [events,setEvents]=useState<SchedulerEvent[]>([])
  const [people,setPeople]=useState<SchedulerOption[]>([])
  const [teams,setTeams]=useState<SchedulerOption[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [mode,setMode]=useState<'PEOPLE'|'TEAMS'>('PEOPLE')

  async function load(){
    setLoading(true);setError('')
    try{
      const now=new Date(); const end=addDays(now,30)
      const [rows,options]=await Promise.all([listSchedulerEvents({startAt:addDays(now,-1).toISOString(),endAt:end.toISOString()}),listSchedulerOptions()])
      setEvents(rows.filter((row)=>row.eventType==='WORK_ORDER'));setPeople(options.people);setTeams(options.teams)
    }catch(e){setError(e instanceof Error?e.message:'Không tải được workload.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const unscheduled=useMemo(()=>events.filter((event)=>event.unscheduled),[events])
  const resources=mode==='PEOPLE'?people:teams
  const cards=useMemo(()=>resources.map((resource)=>{
    const assigned=events.filter((event)=>mode==='PEOPLE'?event.primaryPersonId===resource.id:event.primaryTeamId===resource.id)
    const scheduled=assigned.filter((event)=>!event.unscheduled)
    return {resource,assigned,scheduled,high:assigned.filter((event)=>['HIGH','CRITICAL'].includes(event.priority.toUpperCase())).length}
  }).filter((item)=>item.assigned.length).sort((a,b)=>b.assigned.length-a.assigned.length),[events,mode,resources])

  return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.copy}><Text style={styles.title}>Khối lượng công việc</Text><Text style={styles.sub}>30 ngày tới · {events.length} Work Order</Text></View><Pressable onPress={()=>void load()} style={styles.icon}><Ionicons name="refresh" size={21} color="#344054"/></Pressable></View>
    <View style={styles.summary}><View style={styles.summaryCard}><Text style={styles.summaryNumber}>{unscheduled.length}</Text><Text style={styles.summaryLabel}>Chưa xếp lịch</Text></View><View style={styles.summaryCard}><Text style={styles.summaryNumber}>{events.length-unscheduled.length}</Text><Text style={styles.summaryLabel}>Đã xếp lịch</Text></View><Pressable onPress={onOpenScheduler} style={[styles.summaryCard,styles.schedulerCard]}><Ionicons name="calendar-outline" size={21} color="#155EEF"/><Text style={styles.schedulerText}>Mở Scheduler</Text></Pressable></View>
    <View style={styles.tabs}>{(['PEOPLE','TEAMS'] as const).map((item)=><Pressable key={item} onPress={()=>setMode(item)} style={[styles.tab,item===mode&&styles.tabActive]}><Text style={[styles.tabText,item===mode&&styles.tabTextActive]}>{item==='PEOPLE'?'Theo người':'Theo nhóm'}</Text></Pressable>)}</View>
    {error?<Text style={styles.error}>{error}</Text>:null}
    {loading?<View style={styles.center}><ActivityIndicator size="large" color="#155EEF"/></View>:<ScrollView contentContainerStyle={styles.content}>
      {unscheduled.length?<View style={styles.section}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Hàng chờ chưa xếp lịch</Text><Text style={styles.badge}>{unscheduled.length}</Text></View>{unscheduled.slice(0,20).map((event)=><Pressable key={event.eventId} onPress={()=>event.workOrderId&&onOpenWorkOrder(event.workOrderId)} style={styles.woRow}><View style={styles.flex}><Text style={styles.woTitle}>{cardName(event)}</Text><Text style={styles.meta}>{event.equipmentName||event.equipmentId} · {event.priority||'NORMAL'}</Text></View><Ionicons name="chevron-forward" size={19} color="#98A2B3"/></Pressable>)}<Pressable onPress={onOpenScheduler} style={styles.link}><Text style={styles.linkText}>Xếp lịch trong Scheduler →</Text></Pressable></View>:null}
      <Text style={styles.heading}>{mode==='PEOPLE'?'Tải theo người':'Tải theo nhóm'}</Text>
      {cards.map(({resource,assigned,scheduled,high})=><View key={resource.id} style={styles.resourceCard}><View style={styles.resourceTop}><View style={styles.avatar}><Ionicons name={mode==='PEOPLE'?'person-outline':'people-outline'} size={20} color="#6941C6"/></View><View style={styles.flex}><Text style={styles.resourceName}>{resource.label}</Text><Text style={styles.meta}>{scheduled.length} đã xếp · {assigned.length-scheduled.length} chưa xếp</Text></View><Text style={styles.count}>{assigned.length}</Text></View>{high?<Text style={styles.warning}>{high} công việc ưu tiên cao/khẩn</Text>:null}{assigned.slice(0,3).map((event)=><Pressable key={event.eventId} onPress={()=>event.workOrderId&&onOpenWorkOrder(event.workOrderId)} style={styles.mini}><Text style={styles.miniText} numberOfLines={1}>{cardName(event)}</Text><Text style={styles.miniMeta}>{event.unscheduled?'Chưa lịch':new Date(event.startAt).toLocaleDateString('vi-VN')}</Text></Pressable>)}</View>)}
      {!cards.length?<View style={styles.empty}><Ionicons name="people-outline" size={34} color="#98A2B3"/><Text style={styles.meta}>Chưa có workload được giao trong 30 ngày tới.</Text></View>:null}
    </ScrollView>}
  </SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8FAFC'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},copy:{flex:1,alignItems:'center'},title:{fontSize:19,fontWeight:'900',color:'#101828'},sub:{fontSize:11,color:'#667085',marginTop:2},summary:{padding:12,flexDirection:'row',gap:8},summaryCard:{flex:1,minHeight:72,padding:10,borderRadius:13,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF',alignItems:'center',justifyContent:'center'},summaryNumber:{fontSize:22,fontWeight:'900',color:'#101828'},summaryLabel:{fontSize:10.5,color:'#667085'},schedulerCard:{backgroundColor:'#EEF4FF',borderColor:'#B2CCFF'},schedulerText:{marginTop:4,fontSize:10.5,fontWeight:'800',color:'#155EEF'},tabs:{marginHorizontal:12,marginBottom:8,padding:4,flexDirection:'row',borderRadius:12,backgroundColor:'#EAECF0'},tab:{flex:1,paddingVertical:9,alignItems:'center',borderRadius:9},tabActive:{backgroundColor:'#FFF'},tabText:{fontSize:12,fontWeight:'800',color:'#667085'},tabTextActive:{color:'#101828'},content:{padding:12,paddingBottom:32,gap:12},section:{padding:13,borderRadius:14,borderWidth:1,borderColor:'#FEDF89',backgroundColor:'#FFFAEB'},sectionHeader:{flexDirection:'row',alignItems:'center',marginBottom:8},sectionTitle:{flex:1,fontSize:14,fontWeight:'900',color:'#7A2E0E'},badge:{paddingHorizontal:8,paddingVertical:3,borderRadius:10,backgroundColor:'#FEF0C7',fontSize:11,fontWeight:'900',color:'#B54708'},woRow:{minHeight:52,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderTopColor:'#FDE68A'},flex:{flex:1,minWidth:0},woTitle:{fontSize:12.5,fontWeight:'800',color:'#344054'},meta:{fontSize:11,color:'#667085',marginTop:2},link:{paddingTop:10},linkText:{fontSize:12,fontWeight:'900',color:'#155EEF'},heading:{fontSize:16,fontWeight:'900',color:'#101828'},resourceCard:{padding:14,borderRadius:14,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},resourceTop:{flexDirection:'row',alignItems:'center',gap:10},avatar:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#F4EBFF'},resourceName:{fontSize:14,fontWeight:'900',color:'#344054'},count:{fontSize:20,fontWeight:'900',color:'#6941C6'},warning:{marginTop:9,fontSize:11,fontWeight:'800',color:'#B42318'},mini:{marginTop:8,paddingTop:8,borderTopWidth:1,borderTopColor:'#F2F4F7',flexDirection:'row',gap:8},miniText:{flex:1,fontSize:11.5,fontWeight:'700',color:'#475467'},miniMeta:{fontSize:10.5,color:'#667085'},error:{margin:12,color:'#B42318'},center:{flex:1,alignItems:'center',justifyContent:'center'},empty:{minHeight:160,alignItems:'center',justifyContent:'center',gap:8}})