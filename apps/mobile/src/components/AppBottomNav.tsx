import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type BottomTab = 'home' | 'work-orders' | 'equipment' | 'more'

type AppBottomNavProps = {
  activeTab: BottomTab
  onHome: () => void
  onWorkOrders: () => void
  onCenterPress: () => void
  onEquipment: () => void
  onMore: () => void
  centerMode?: 'create' | 'scan'
}

const ACTIVE_COLOR = '#155EEF'
const INACTIVE_COLOR = '#667085'

export function AppBottomNav({
  activeTab,
  onHome,
  onWorkOrders,
  onCenterPress,
  onEquipment,
  onMore,
  centerMode = 'create',
}: AppBottomNavProps) {
  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNav}>
        <NavItem
          label="Trang chủ"
          icon="home-outline"
          activeIcon="home"
          active={activeTab === 'home'}
          onPress={onHome}
        />
        <NavItem
          label="Công việc"
          icon="clipboard-outline"
          active={activeTab === 'work-orders'}
          onPress={onWorkOrders}
        />
        <View style={styles.navCenterSpace} />
        <NavItem
          label="Thiết bị"
          icon="cube-outline"
          active={activeTab === 'equipment'}
          onPress={onEquipment}
        />
        <NavItem
          label="Thêm"
          icon="menu-outline"
          activeIcon="menu"
          active={activeTab === 'more'}
          onPress={onMore}
          iconSize={25}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={centerMode === 'scan' ? 'Quét mã' : 'Tạo mới'}
        onPress={onCenterPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons
          name={centerMode === 'scan' ? 'scan-outline' : 'add'}
          size={centerMode === 'scan' ? 29 : 34}
          color="#FFFFFF"
        />
      </Pressable>
    </View>
  )
}

type NavItemProps = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon?: keyof typeof Ionicons.glyphMap
  active: boolean
  onPress: () => void
  iconSize?: number
}

function NavItem({ label, icon, activeIcon, active, onPress, iconSize = 23 }: NavItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.navItem}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={active && activeIcon ? activeIcon : icon}
        size={iconSize}
        color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
      />
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  bottomNavWrap: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  bottomNav: {
    minHeight: 66,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDE1E7',
    backgroundColor: '#FFFFFF',
  },
  navItem: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navCenterSpace: {
    flex: 1,
  },
  navLabel: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '600',
    color: INACTIVE_COLOR,
  },
  navLabelActive: {
    color: ACTIVE_COLOR,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    left: '50%',
    top: -20,
    width: 56,
    height: 56,
    marginLeft: -28,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#FFFFFF',
    backgroundColor: ACTIVE_COLOR,
    shadowColor: '#101828',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#004EEB',
  },
})
