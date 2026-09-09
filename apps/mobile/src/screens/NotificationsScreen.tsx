import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listNotifications, markNotificationRead, type NotificationItem } from '../features/notifications'

type Props = { onBack: () => void; onOpenEntity?: (entityType: string, entityId: string) => void }
export function NotificationsScreen({ onBack, onOpenEntity }: Props) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  async function load(refresh = false) { refresh ? setRefreshing(true) : setLoading(true); try { setItems(await listNotifications(unreadOnly)); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được thông báo.') } finally { setLoading(false); setRefreshing(false) } }
  useEffect(() => { void load() }, [unreadOnly])
  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items])
  async function open(item: NotificationItem) {
    if (!item.readAt) { try { await markNotificationRead(item.notificationId); setItems((current) => current.map((row) => row.notificationId === item.notificationId ? { ...row, readAt: new Date().toISOString() } : row)) } catch { /* keep inbox usable */ } }
    if (item.entityId && onOpenEntity) onOpenEntity(item.entityType || '', item.entityId)
  }
  return <SafeAreaView style={styles.safe} edges={['top','bottom']}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Thông báo</Text><Text style={styles.sub}>{unreadCount} chưa đọc</Text></View><Pressable onPress={() => setUnreadOnly((value) => !value)} style={styles.icon}><Ionicons name={unreadOnly?'mail-unread':'mail-outline'} size={23} color="#155EEF"/></Pressable></View>
    {loading ? <View style={styles.center}><ActivityIndicator color="#155EEF"/></View> : <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)}/>} contentContainerStyle={styles.content}>{error ? <Text style={styles.error}>{error}</Text> : null}{items.map((item) => <Pressable key={item.notificationId} onPress={() => void open(item)} style={[styles.card,!item.readAt&&styles.unread]}><View style={[styles.dot,item.priority==='CRITICAL'||item.priority==='HIGH'?styles.dotHigh:styles.dotNormal]}/><View style={styles.copy}><Text style={styles.cardTitle}>{item.title || item.type}</Text>{item.body ? <Text style={styles.body}>{item.body}</Text> : null}<Text style={styles.meta}>{item.entityType}{item.entityId?` · ${item.entityId}`:''}{item.createdAt?` · ${new Date(item.createdAt).toLocaleString()}`:''}</Text></View>{item.entityId?<Ionicons name="open-outline" size={18} color="#155EEF"/>:null}{!item.readAt?<View style={styles.badge}><Text style={styles.badgeText}>MỚI</Text></View>:null}</Pressable>)}{!items.length ? <Text style={styles.empty}>Không có thông báo.</Text> : null}</ScrollView>}
  </SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8F9FB'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},title:{fontSize:20,fontWeight:'900',color:'#101828'},sub:{fontSize:11,color:'#667085'},center:{flex:1,alignItems:'center',justifyContent:'center'},content:{padding:14,paddingBottom:32},error:{padding:12,borderRadius:10,backgroundColor:'#FEF3F2',color:'#B42318'},card:{minHeight:76,marginBottom:9,padding:12,flexDirection:'row',alignItems:'flex-start',gap:10,borderRadius:14,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},unread:{borderColor:'#84ADFF',backgroundColor:'#F5F8FF'},dot:{width:10,height:10,marginTop:5,borderRadius:5},dotHigh:{backgroundColor:'#F04438'},dotNormal:{backgroundColor:'#2E90FA'},copy:{flex:1},cardTitle:{fontSize:13.5,fontWeight:'900',color:'#344054'},body:{marginTop:4,fontSize:11.5,lineHeight:17,color:'#667085'},meta:{marginTop:6,fontSize:9.5,color:'#98A2B3'},badge:{paddingHorizontal:7,paddingVertical:4,borderRadius:8,backgroundColor:'#EFF4FF'},badgeText:{fontSize:9,fontWeight:'900',color:'#155EEF'},empty:{padding:30,textAlign:'center',color:'#667085'}})
