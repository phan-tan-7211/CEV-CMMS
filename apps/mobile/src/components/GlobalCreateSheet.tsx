import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type IconName = keyof typeof Ionicons.glyphMap

type CreateItem = {
  key: string
  label: string
  icon: IconName
  enabled?: boolean
  adminOnly?: boolean
}

const ITEMS: CreateItem[] = [
  { key: 'work-order', label: 'Lệnh công việc', icon: 'clipboard-outline' },
  { key: 'request', label: 'Yêu cầu sửa chữa', icon: 'mail-unread-outline' },
  { key: 'equipment', label: 'Thiết bị', icon: 'cube-outline', enabled: true },
  { key: 'location', label: 'Vị trí', icon: 'location-outline' },
  { key: 'meter', label: 'Đồng hồ đo', icon: 'speedometer-outline' },
  { key: 'user', label: 'Người dùng', icon: 'person-add-outline', adminOnly: true },
]

export function GlobalCreateSheet({
  visible,
  isAdmin,
  onClose,
  onCreateEquipment,
  onComingSoon,
}: {
  visible: boolean
  isAdmin: boolean
  onClose: () => void
  onCreateEquipment: () => void
  onComingSoon: (label: string) => void
}) {
  const insets = useSafeAreaInsets()
  const rows = ITEMS.filter((item) => !item.adminOnly || isAdmin)

  function handlePress(item: CreateItem) {
    onClose()
    if (item.key === 'equipment') {
      onCreateEquipment()
      return
    }
    onComingSoon(item.label)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalRoot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng menu tạo mới" onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Tạo mới</Text>
          </View>

          <View style={styles.rows}>
            {rows.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handlePress(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.iconBox}>
                  <Ionicons name={item.icon} size={24} color="#344054" />
                </View>
                <Text style={styles.label}>{item.label}</Text>
                {!item.enabled && item.key !== 'equipment' ? <Text style={styles.comingSoon}>Sắp có</Text> : null}
                <Ionicons name="chevron-forward" size={19} color="#D0D5DD" />
              </Pressable>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Chỉ hiển thị các thao tác phù hợp với quyền tài khoản.</Text>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,24,40,0.38)' },
  sheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 560 : undefined,
    alignSelf: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  handle: { width: 42, height: 4, marginTop: 8, marginBottom: 3, borderRadius: 2, alignSelf: 'center', backgroundColor: '#D0D5DD' },
  header: { minHeight: 52, paddingHorizontal: 18, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: '#1D2939', letterSpacing: -0.35 },
  rows: { paddingVertical: 4 },
  row: { minHeight: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  rowPressed: { backgroundColor: '#F9FAFB' },
  iconBox: { width: 38, alignItems: 'flex-start', justifyContent: 'center' },
  label: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '600', color: '#344054' },
  comingSoon: { marginRight: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, fontSize: 10.5, fontWeight: '700', color: '#667085', backgroundColor: '#F2F4F7' },
  footer: { marginHorizontal: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  footerText: { fontSize: 11.5, lineHeight: 17, color: '#98A2B3' },
})
