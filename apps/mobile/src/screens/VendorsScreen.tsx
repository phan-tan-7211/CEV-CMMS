import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listParties, type PartyPickerItem } from '../features/master-data'

export function VendorsScreen({ onBack, onAddVendor, onAddCustomer }: { onBack: () => void; onAddVendor: () => void; onAddCustomer: () => void }) {
  const [chooserVisible, setChooserVisible] = useState(false)
  const [items, setItems] = useState<PartyPickerItem[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try { setItems(await listParties('ALL', { limit: 500 })); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không tải được doanh nghiệp.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const filtered = useMemo(() => { const q=query.trim().toLowerCase(); return q ? items.filter((item) => `${item.companyName} ${item.kind} ${item.phone} ${item.email}`.toLowerCase().includes(q)) : items }, [items,query])
  const choose = (action: () => void) => { setChooserVisible(false); action() }

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Nhà cung cấp & Khách hàng</Text><Text style={styles.sub}>Dữ liệu business party thật</Text></View><Pressable onPress={() => setChooserVisible(true)} style={styles.icon}><Ionicons name="add-circle-outline" size={25} color="#155EEF"/></Pressable></View>
    <View style={styles.search}><Ionicons name="search-outline" size={19} color="#667085"/><TextInput value={query} onChangeText={setQuery} placeholder="Tìm công ty..." placeholderTextColor="#98A2B3" style={styles.searchInput}/></View>
    {loading ? <View style={styles.center}><ActivityIndicator color="#155EEF"/></View> : error ? <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : <ScrollView contentContainerStyle={styles.content}>{filtered.map((item) => <View key={item.id} style={styles.card}><View style={styles.logo}><Ionicons name={item.kind==='CUSTOMER'?'people-outline':'business-outline'} size={22} color="#155EEF"/></View><View style={styles.copy}><Text style={styles.name}>{item.companyName}</Text><Text style={styles.meta}>{item.kind==='VENDOR'?'Nhà cung cấp':item.kind==='CUSTOMER'?'Khách hàng':'Nhà cung cấp & Khách hàng'}{item.phone?` · ${item.phone}`:''}</Text><Text style={styles.detail}>{item.email || item.address || 'Chưa có thông tin liên hệ'}</Text></View></View>)}{!filtered.length ? <Text style={styles.empty}>Chưa có doanh nghiệp phù hợp.</Text> : null}</ScrollView>}
    <Modal visible={chooserVisible} transparent animationType="slide" onRequestClose={() => setChooserVisible(false)}><Pressable style={styles.overlay} onPress={() => setChooserVisible(false)}><View style={styles.sheet}><Text style={styles.sheetTitle}>Thêm mới</Text><Pressable style={styles.option} onPress={() => choose(onAddVendor)}><Text style={styles.optionTitle}>Nhà cung cấp</Text><Text style={styles.optionHint}>Dùng cho Purchase Order và phụ tùng</Text></Pressable><Pressable style={styles.option} onPress={() => choose(onAddCustomer)}><Text style={styles.optionTitle}>Khách hàng</Text><Text style={styles.optionHint}>Đơn vị nhận dịch vụ / sản phẩm</Text></Pressable><Pressable style={styles.cancel} onPress={() => setChooserVisible(false)}><Text style={styles.cancelText}>Hủy</Text></Pressable></View></Pressable></Modal>
  </SafeAreaView>
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8F9FB'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},headerCopy:{flex:1},title:{fontSize:20,fontWeight:'900',color:'#101828'},sub:{fontSize:11,color:'#667085'},search:{margin:14,minHeight:48,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,borderRadius:12,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},searchInput:{flex:1,color:'#101828'},content:{paddingHorizontal:14,paddingBottom:30},card:{minHeight:76,marginBottom:9,padding:12,flexDirection:'row',alignItems:'center',gap:10,borderRadius:14,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},logo:{width:42,height:42,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#EFF4FF'},copy:{flex:1},name:{fontSize:14,fontWeight:'900',color:'#344054'},meta:{marginTop:3,fontSize:10.5,color:'#667085'},detail:{marginTop:3,fontSize:10.5,color:'#98A2B3'},center:{flex:1,alignItems:'center',justifyContent:'center',gap:10},error:{color:'#B42318'},retry:{fontWeight:'900',color:'#155EEF'},empty:{padding:30,textAlign:'center',color:'#667085'},overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(16,24,40,0.28)'},sheet:{padding:20,paddingBottom:28,borderTopLeftRadius:24,borderTopRightRadius:24,backgroundColor:'#FFF'},sheetTitle:{fontSize:20,fontWeight:'900',color:'#101828'},option:{padding:15,marginTop:10,borderRadius:15,backgroundColor:'#F1F1FA'},optionTitle:{fontSize:15,fontWeight:'900',color:'#1D2939'},optionHint:{marginTop:4,fontSize:12.5,color:'#667085'},cancel:{alignItems:'center',padding:14,marginTop:8},cancelText:{fontSize:15,fontWeight:'800',color:'#155EEF'}})
