import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

import { AppBottomNav } from '../components/AppBottomNav'
import { GlobalCreateSheet } from '../components/GlobalCreateSheet'

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

const WORK_ORDER_ROWS: Array<{ label: string; count: number; accent: string }> = [
  { label: 'Tất cả đang chờ', count: 0, accent: '#344054' },
  { label: 'Mở', count: 0, accent: '#BFC5CE' },
  { label: 'Đang thực hiện', count: 0, accent: '#7A5AF8' },
  { label: 'Tạm dừng', count: 0, accent: '#F79009' },
  { label: 'Quá hạn', count: 0, accent: '#E31B54' },
  { label: 'Đến hạn hôm nay', count: 0, accent: '#2E90FA' },
  { label: 'Ưu tiên cao', count: 0, accent: '#E31B54' },
]

function showComingSoon(label: string) {
  Alert.alert(label, 'Module này sẽ được nối dữ liệu và workflow ở batch tiếp theo.')
}

export function HomeScreen({
  onCreateEquipment,
  onOpenScan,
  onOpenOperatorScan,
  onOpenWorkOrders,
  onOpenEquipment,
  onOpenRequests,
  onOpenMore,
  onOpenSettings,
  isAdmin = false,
  isOperatorFlow = false,
}: HomeScreenProps) {
  const [assignedOnly, setAssignedOnly] = useState(true)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  function handleQuickAction(label: string) {
    if (label === 'Quét') return onOpenScan()
    if (label === 'Tài sản') return onOpenEquipment()
    showComingSoon(label)
  }

  function handleCenterAction() {
    if (isOperatorFlow) {
      onOpenOperatorScan()
      return
    }
    setCreateMenuOpen(true)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="construct-outline" size={21} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.brand}>CEV CMMS</Text>
              <Text style={styles.brandSub}>Core Electronics Vietnam</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cài đặt tài khoản"
            hitSlop={8}
            onPress={onOpenSettings}
            style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
          >
            <Ionicons name="settings-outline" size={24} color="#344054" />
          </Pressable>
        </View>

        <View style={styles.quickStrip}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => handleQuickAction(action.label)}
              style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
            >
              <View style={[styles.quickIcon, action.primary && styles.quickIconPrimary]}>
                <Ionicons name={action.icon} size={23} color={action.primary ? '#FFFFFF' : '#344054'} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.separator} />

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.assignedCard}>
            <View style={styles.assignedCopy}>
              <Text style={styles.assignedTitle}>Chỉ công việc giao cho tôi</Text>
              <Text style={styles.assignedCaption}>Bộ lọc mặc định của dashboard</Text>
            </View>
            <Switch
              value={assignedOnly}
              onValueChange={setAssignedOnly}
              trackColor={{ false: '#D0D5DD', true: '#84ADFF' }}
              thumbColor={assignedOnly ? '#155EEF' : '#F2F4F7'}
            />
          </View>

          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Bảng điều khiển Work Order</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chỉnh sửa bảng điều khiển"
              hitSlop={8}
              onPress={() => showComingSoon('Chỉnh sửa bảng điều khiển')}
            >
              <Text style={styles.editText}>Chỉnh sửa</Text>
            </Pressable>
          </View>

          <View style={styles.dashboardList}>
            {WORK_ORDER_ROWS.map((row) => (
              <Pressable
                key={row.label}
                accessibilityRole="button"
                accessibilityLabel={`${row.label}: ${row.count}`}
                onPress={onOpenWorkOrders}
                style={({ pressed }) => [styles.statusRow, pressed && styles.statusRowPressed]}
              >
                <View style={[styles.statusAccent, { backgroundColor: row.accent }]} />
                <Text style={styles.statusLabel}>{row.label}</Text>
                <Text style={styles.statusCount}>{row.count}</Text>
                <Ionicons name="chevron-forward" size={23} color="#B0B7C3" />
              </Pressable>
            ))}
          </View>

        </ScrollView>

        <AppBottomNav
          activeTab="home"
          onHome={() => {}}
          onWorkOrders={onOpenWorkOrders}
          onCenterPress={handleCenterAction}
          onRequests={onOpenRequests}
          onMore={onOpenMore}
          centerMode={isOperatorFlow ? 'scan' : 'create'}
        />
      </View>

      <GlobalCreateSheet
        visible={createMenuOpen && !isOperatorFlow}
        isAdmin={isAdmin}
        onClose={() => setCreateMenuOpen(false)}
        onCreateEquipment={onCreateEquipment}
        onComingSoon={showComingSoon}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  shell: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#155EEF',
  },
  brand: { fontSize: 19, lineHeight: 23, fontWeight: '900', color: '#101828', letterSpacing: -0.35 },
  brandSub: { marginTop: 1, fontSize: 10, lineHeight: 13, fontWeight: '600', color: '#98A2B3' },
  settingsButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickStrip: {
    minHeight: 98,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  quickAction: { flex: 1, minWidth: 0, alignItems: 'center' },
  quickActionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4F7',
  },
  quickIconPrimary: { backgroundColor: '#155EEF' },
  quickLabel: { marginTop: 5, paddingHorizontal: 2, textAlign: 'center', fontSize: 11, lineHeight: 13, fontWeight: '600', color: '#344054' },
  separator: { height: 7, backgroundColor: '#F2F4F7' },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18 },
  assignedCard: {
    minHeight: 58,
    marginBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE1E7',
    backgroundColor: '#FFFFFF',
  },
  assignedCopy: { flex: 1, paddingRight: 12 },
  assignedTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '800', color: '#344054' },
  assignedCaption: { marginTop: 1, fontSize: 10.5, lineHeight: 14, color: '#98A2B3' },
  sectionHeadingRow: { minHeight: 32, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { flex: 1, fontSize: 19, lineHeight: 24, fontWeight: '900', color: '#1D2939', letterSpacing: -0.4 },
  editText: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', color: '#155EEF' },
  dashboardList: { gap: 7 },
  statusRow: {
    minHeight: 58,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDE1E7',
    backgroundColor: '#FFFFFF',
  },
  statusRowPressed: { backgroundColor: '#F9FAFB' },
  statusAccent: { width: 4, height: 34, marginLeft: 11, marginRight: 11, borderRadius: 3 },
  statusLabel: { flex: 1, fontSize: 15.5, lineHeight: 20, fontWeight: '800', color: '#20242A' },
  statusCount: { minWidth: 26, marginHorizontal: 7, textAlign: 'right', fontSize: 16.5, lineHeight: 21, fontWeight: '500', color: '#667085' },
  pressed: { opacity: 0.64 },
})
