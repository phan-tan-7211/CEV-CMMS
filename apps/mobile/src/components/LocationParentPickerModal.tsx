import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import type { LocationPickerItem } from '../features/master-data'

type Crumb = { id: string | null; name: string }

export function LocationParentPickerModal({ visible, loadChildren, onClose, onSelect }: { visible: boolean; loadChildren: (parentId: string | null) => Promise<LocationPickerItem[]>; onClose: () => void; onSelect: (item: LocationPickerItem | null) => void }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{id:null,name:'Tất cả vị trí'}])
  const [items, setItems] = useState<LocationPickerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const current = crumbs[crumbs.length-1]

  useEffect(()=>{ if(!visible)return; let active=true; setLoading(true);setError(''); void loadChildren(current.id).then((next)=>{if(active)setItems(next)}).catch((reason)=>{if(active)setError(reason instanceof Error?reason.message:'Không tải được vị trí.')}).finally(()=>{if(active)setLoading(false)}); return()=>{active=false} },[visible,current.id,loadChildren])

  function drill(item: LocationPickerItem) { setCrumbs((value)=>[...value,{id:item.id,name:item.name}]) }
  function back() { if(crumbs.length>1)setCrumbs((value)=>value.slice(0,-1)); else onClose() }

  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.safe} edges={['top','bottom']}><View style={styles.header}><Pressable onPress={back} style={styles.icon}><Ionicons name="arrow-back" size={27} color="#101828"/></Pressable><Text style={styles.title}>Chọn vị trí cha</Text><Pressable onPress={()=>onSelect(null)} style={styles.none}><Text style={styles.noneText}>KHÔNG CÓ</Text></Pressable></View><View style={styles.breadcrumb}>{crumbs.map((crumb,index)=><View key={`${crumb.id}-${index}`} style={styles.crumb}><Text style={index===crumbs.length-1?styles.crumbCurrent:styles.crumbOld}>{crumb.name}</Text>{index<crumbs.length-1?<Ionicons name="chevron-forward" size={15} color="#98A2B3"/>:null}</View>)}</View>{loading?<View style={styles.center}><ActivityIndicator/><Text style={styles.helper}>Đang tải vị trí...</Text></View>:error?<View style={styles.center}><Text style={styles.error}>{error}</Text></View>:<FlatList data={items} keyExtractor={(item)=>item.id} renderItem={({item})=><View style={styles.row}><Pressable onPress={()=>onSelect(item)} style={styles.select}><Ionicons name="location-outline" size={22} color="#667085"/><View style={styles.copy}><Text style={styles.name}>{item.name}</Text>{item.address?<Text style={styles.sub}>{item.address}</Text>:null}</View></Pressable>{item.childCount>0?<Pressable onPress={()=>drill(item)} accessibilityLabel={`Mở vị trí con ${item.name}`} style={styles.drill}><Text style={styles.count}>{item.childCount}</Text><Ionicons name="chevron-forward" size={22} color="#98A2B3"/></Pressable>:null}</View>} ListEmptyComponent={<View style={styles.center}><Text style={styles.helper}>Không có vị trí con.</Text></View>}/>}</SafeAreaView></Modal>
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#FFF'},header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},title:{flex:1,fontSize:20,fontWeight:'900',color:'#101828'},none:{paddingHorizontal:8,minHeight:44,justifyContent:'center'},noneText:{fontSize:12,fontWeight:'900',color:'#155EEF'},breadcrumb:{minHeight:46,paddingHorizontal:16,flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:5,backgroundColor:'#F9FAFB'},crumb:{flexDirection:'row',alignItems:'center',gap:5},crumbCurrent:{fontSize:12.5,fontWeight:'800',color:'#344054'},crumbOld:{fontSize:12.5,color:'#667085'},row:{minHeight:70,flexDirection:'row',alignItems:'stretch',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},select:{flex:1,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:11},copy:{flex:1,minWidth:0},name:{fontSize:15.5,fontWeight:'800',color:'#101828'},sub:{marginTop:3,fontSize:12.5,color:'#667085'},drill:{minWidth:72,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:4},count:{fontSize:11.5,fontWeight:'800',color:'#667085'},center:{padding:32,alignItems:'center',gap:8},helper:{fontSize:13,color:'#667085'},error:{fontSize:13,color:'#B42318',textAlign:'center'}})
