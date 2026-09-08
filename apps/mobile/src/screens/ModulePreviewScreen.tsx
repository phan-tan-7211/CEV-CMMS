import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

export type ModulePreviewItem = { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string }

export function ModulePreviewScreen({ title, hint, items, onBack, onAdd, actionLabel = 'Thêm' }: { title: string; hint: string; items: ModulePreviewItem[]; onBack: () => void; onAdd?: () => void; actionLabel?: string }) {
  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable><Text style={styles.title}>{title}</Text><Pressable accessibilityLabel={actionLabel} onPress={onAdd} style={styles.icon}><Ionicons name="add" size={25} color="#155EEF" /></Pressable></View>
    <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.search}><Ionicons name="search-outline" size={19} color="#98A2B3" /><TextInput placeholder={hint} placeholderTextColor="#98A2B3" style={styles.input} /></View>
      <View style={styles.toolbar}><Text style={styles.count}>{items.length} mục</Text><Pressable style={styles.sort}><Ionicons name="swap-vertical-outline" size={16} color="#667085" /><Text style={styles.sortText}>Mới nhất</Text></Pressable></View>
      {items.map((item) => <Pressable key={item.title} style={styles.card}><View style={[styles.itemIcon,{backgroundColor:item.color+'22'}]}><Ionicons name={item.icon} size={24} color={item.color} /></View><View style={styles.itemCopy}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.subtitle}</Text></View><Ionicons name="chevron-forward" size={20} color="#98A2B3" /></Pressable>)}
      <View style={styles.note}><Ionicons name="information-circle-outline" size={19} color="#536DFE" /><Text style={styles.noteText}>Đây là giao diện mẫu theo UpKeep/Atlas. Dữ liệu thật sẽ được nối ở bước sau.</Text></View>
    </ScrollView>
  </SafeAreaView>
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F1F1FA'},header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5E5EF'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'900',color:'#101828'},body:{flex:1},content:{padding:14,paddingBottom:28},search:{minHeight:46,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,borderWidth:1,borderColor:'#D7D8E5',borderRadius:23,backgroundColor:'#FFF'},input:{flex:1,minHeight:44,fontSize:14,color:'#101828'},toolbar:{minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},count:{fontSize:13,fontWeight:'800',color:'#667085'},sort:{flexDirection:'row',alignItems:'center',gap:5},sortText:{fontSize:12,fontWeight:'700',color:'#667085'},card:{minHeight:78,marginBottom:10,padding:13,flexDirection:'row',alignItems:'center',gap:12,borderRadius:17,backgroundColor:'#FFF',borderWidth:StyleSheet.hairlineWidth,borderColor:'#E1E1EA'},itemIcon:{width:46,height:46,borderRadius:14,alignItems:'center',justifyContent:'center'},itemCopy:{flex:1},itemTitle:{fontSize:15,fontWeight:'900',color:'#1D2939'},itemSubtitle:{marginTop:4,fontSize:12.5,color:'#667085'},note:{marginTop:8,padding:13,flexDirection:'row',gap:8,borderRadius:13,backgroundColor:'#E9EDFF'},noteText:{flex:1,fontSize:12.5,lineHeight:18,color:'#344054'}})
