import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

type IconName = keyof typeof Ionicons.glyphMap

type MoreMenuItem = {
  key: string
  label: string
  icon: IconName
  iconColor: string
  backgroundColor: string
}

const MENU_ITEMS: MoreMenuItem[] = [
  {
    key: 'locations',
    label: 'Vị trí',
    icon: 'location',
    iconColor: '#2E90FA',
    backgroundColor: '#DCE5E9',
  },
  {
    key: 'assets',
    label: 'Tài sản',
    icon: 'cube-outline',
    iconColor: '#F79009',
    backgroundColor: '#F3EBD8',
  },
  {
    key: 'parts',
    label: 'Phụ tùng',
    icon: 'archive-outline',
    iconColor: '#7F56D9',
    backgroundColor: '#E7DDEB',
  },
  {
    key: 'meters',
    label: 'Đồng hồ đo',
    icon: 'speedometer-outline',
    iconColor: '#E31B54',
    backgroundColor: '#E8DEDC',
  },
  {
    key: 'people-teams',
    label: 'Người & Nhóm',
    icon: 'person',
    iconColor: '#155EEF',
    backgroundColor: '#DCE5E9',
  },
  {
    key: 'vendors-contractors',
    label: 'Nhà cung cấp & Nhà thầu',
    icon: 'people-circle-outline',
    iconColor: '#F79009',
    backgroundColor: '#E8E5D8',
  },
]

function showComingSoon(label: string) {
  Alert.alert(label, 'Module này sẽ được nối dữ liệu và workflow ở batch tiếp theo.')
}

export function MoreScreen({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <View style={styles.header}>
          <Text style={styles.title}>Thêm</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => showComingSoon(item.label)}
              style={({ pressed }) => [
                styles.menuCard,
                { backgroundColor: item.backgroundColor },
                pressed && styles.menuCardPressed,
              ]}
            >
              <Text style={styles.menuLabel} numberOfLines={2}>{item.label}</Text>
              <Ionicons name={item.icon} size={34} color={item.iconColor} />
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.bottomNavWrap}>
          <View style={styles.bottomNav}>
            <Pressable
              onPress={onBack}
              style={styles.navItem}
              accessibilityRole="button"
              accessibilityLabel="Trang chủ"
            >
              <Ionicons name="home-outline" size={25} color="#667085" />
              <Text style={styles.navLabel}>Trang chủ</Text>
            </Pressable>

            <Pressable
              onPress={() => showComingSoon('Công việc')}
              style={styles.navItem}
              accessibilityRole="button"
              accessibilityLabel="Công việc"
            >
              <Ionicons name="clipboard-outline" size={25} color="#667085" />
              <Text style={styles.navLabel}>Công việc</Text>
            </Pressable>

            <View style={styles.navCenterSpace} />

            <Pressable
              onPress={() => showComingSoon('Yêu cầu')}
              style={styles.navItem}
              accessibilityRole="button"
              accessibilityLabel="Yêu cầu"
            >
              <Ionicons name="briefcase-outline" size={25} color="#667085" />
              <Text style={styles.navLabel}>Yêu cầu</Text>
            </Pressable>

            <Pressable
              style={styles.navItem}
              accessibilityRole="button"
              accessibilityLabel="Thêm"
            >
              <Ionicons name="menu" size={27} color="#155EEF" />
              <Text style={[styles.navLabel, styles.navLabelActive]}>Thêm</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tạo mới"
            onPress={() => showComingSoon('Tạo mới')}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <Ionicons name="add" size={38} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  shell: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  header: {
    minHeight: 78,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#101828',
    letterSpacing: -0.7,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 12,
  },
  menuCard: {
    minHeight: 104,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  menuCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.995 }],
  },
  menuLabel: {
    flex: 1,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    color: '#202124',
    letterSpacing: -0.45,
  },
  bottomNavWrap: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
  },
  bottomNav: {
    minHeight: 78,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 7,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EAECF0',
    backgroundColor: '#FFFFFF',
  },
  navItem: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
  },
  navCenterSpace: {
    flex: 1,
  },
  navLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#667085',
  },
  navLabelActive: {
    color: '#155EEF',
  },
  fab: {
    position: 'absolute',
    left: '50%',
    top: -26,
    width: 62,
    height: 62,
    marginLeft: -31,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#155EEF',
    borderWidth: 5,
    borderColor: '#F8F9FB',
  },
  fabPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
})
