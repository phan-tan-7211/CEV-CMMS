import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

export function EquipmentHierarchyScreen({ equipmentId, onBack }: { equipmentId: string; onBack: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.iconButton}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable>
        <Text style={styles.title}>Phân cấp thiết bị</Text>
        <View style={styles.iconButton} />
      </View>
      <View style={styles.center}>
        <View style={styles.iconWrap}><Ionicons name="git-network-outline" size={30} color="#155EEF" /></View>
        <Text style={styles.heading}>{equipmentId}</Text>
        <Text style={styles.caption}>Chưa có quan hệ thiết bị cha–con trong dữ liệu CEV. Màn hình đã sẵn sàng để hiển thị cây phân cấp khi backend bổ sung quan hệ.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 60, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  iconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#101828' },
  center: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FF' },
  heading: { marginTop: 16, fontSize: 18, fontWeight: '900', color: '#101828' },
  caption: { marginTop: 8, textAlign: 'center', fontSize: 13, lineHeight: 19, color: '#667085' },
})
