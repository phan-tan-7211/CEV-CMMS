import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type IconName = keyof typeof Ionicons.glyphMap
type CreateItem = { key: string; label: string; icon: IconName; adminOnly?: boolean }

const ITEMS: CreateItem[] = [
  { key: 'work-order', label: 'Lệnh công việc', icon: 'clipboard-outline' },
  { key: 'request', label: 'Yêu cầu sửa chữa', icon: 'mail-unread-outline' },
  { key: 'equipment', label: 'Thiết bị', icon: 'cube-outline' },
  { key: 'location', label: 'Vị trí', icon: 'location-outline' },
  { key: 'meter', label: 'Đồng hồ đo', icon: 'speedometer-outline' },
  { key: 'part', label: 'Phụ tùng', icon: 'archive-outline' },
  { key: 'pm', label: 'Kế hoạch PM', icon: 'calendar-outline' },
  { key: 'vendor', label: 'Nhà cung cấp', icon: 'business-outline' },
  { key: 'customer', label: 'Khách hàng', icon: 'people-outline' },
  { key: 'checklist', label: 'Checklist template', icon: 'checkbox-outline' },
  { key: 'custom-fields', label: 'Custom Field', icon: 'options-outline' },
  { key: 'files', label: 'Tệp / tài liệu', icon: 'document-attach-outline' },
  { key: 'floor-plan', label: 'Floor Plan', icon: 'map-outline' },
  { key: 'user', label: 'Người dùng', icon: 'person-add-outline', adminOnly: true },
]

export function GlobalCreateSheet({ visible, isAdmin, onClose, onAction }: { visible: boolean; isAdmin: boolean; onClose: () => void; onAction: (key: string) => void }) {
  const insets = useSafeAreaInsets()
  const rows = ITEMS.filter((item) => !item.adminOnly || isAdmin)
  function handlePress(item: CreateItem) { onClose(); onAction(item.key) }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent><View style={styles.modalRoot}><Pressable accessibilityRole="button" accessibilityLabel="Đóng menu tạo mới" onPress={onClose} style={styles.backdrop}/><View style={[styles.sheet,{paddingBottom:Math.max(insets.bottom,12)}]}><View style={styles.handle}/><View style={styles.header}><Text style={styles.title}>Tạo mới</Text><Text style={styles.subtitle}>Tạo nhanh dữ liệu CMMS từ một nơi</Text></View><ScrollView style={styles.scroll} contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>{rows.map((item)=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>handlePress(item)} style={({pressed})=>[styles.row,pressed&&styles.rowPressed]}><View style={styles.iconBox}><Ionicons name={item.icon} size={23} color="#344054"/></View><Text style={styles.label}>{item.label}</Text><Ionicons name="chevron-forward" size={19} color="#D0D5DD"/></Pressable>)}</ScrollView><View style={styles.footer}><Text style={styles.footerText}>Chỉ hiển thị các thao tác phù hợp với quyền tài khoản.</Text></View></View></View></Modal>
}

const styles=StyleSheet.create({modalRoot:{flex:1,justifyContent:'flex-end'},backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(16,24,40,0.38)'},sheet:{width:'100%',maxWidth:Platform.OS==='web'?560:undefined,maxHeight:'88%',alignSelf:'center',borderTopLeftRadius:18,borderTopRightRadius:18,backgroundColor:'#FFFFFF',overflow:'hidden'},handle:{width:42,height:4,marginTop:8,marginBottom:3,borderRadius:2,alignSelf:'center',backgroundColor:'#D0D5DD'},header:{minHeight:62,paddingHorizontal:18,justifyContent:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},title:{fontSize:20,lineHeight:25,fontWeight:'900',color:'#1D2939',letterSpacing:-.35},subtitle:{fontSize:11.5,color:'#667085',marginTop:2},scroll:{flexGrow:0},rows:{paddingVertical:4},row:{minHeight:56,paddingHorizontal:18,flexDirection:'row',alignItems:'center'},rowPressed:{backgroundColor:'#F9FAFB'},iconBox:{width:38,alignItems:'flex-start',justifyContent:'center'},label:{flex:1,fontSize:15.5,lineHeight:21,fontWeight:'600',color:'#344054'},footer:{marginHorizontal:18,paddingTop:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0'},footerText:{fontSize:11.5,lineHeight:17,color:'#98A2B3'}})
