import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState } from 'react'

import { AppBottomNav } from '../components/AppBottomNav'
import { GlobalCreateSheet } from '../components/GlobalCreateSheet'

type IconName = keyof typeof Ionicons.glyphMap

type MoreMenuItem = {
  key: string
  label: string
  icon: IconName
  iconColor: string
  backgroundColor: string
}

type MoreScreenProps = {
  onHome: () => void
  onOpenWorkOrders: () => void
  onOpenRequests: () => void
  onOpenEquipment: () => void
  onCreateEquipment: () => void
  onOpenOperatorScan: () => void
  onOpenParts: () => void
  isAdmin?: boolean
  isOperatorFlow?: boolean
}

const MENU_ITEMS: MoreMenuItem[] = [
  { key: 'locations', label: 'Vị trí', icon: 'location', iconColor: '#2E90FA', backgroundColor: '#DCE5E9' },
  { key: 'assets', label: 'Tài sản', icon: 'cube-outline', iconColor: '#F79009', backgroundColor: '#F3EBD8' },
  { key: 'requests', label: 'Yêu cầu', icon: 'clipboard-outline', iconColor: '#12B76A', backgroundColor: '#DDF7EA' },
  { key: 'parts', label: 'Phụ tùng', icon: 'archive-outline', iconColor: '#7F56D9', backgroundColor: '#E7DDEB' },
  { key: 'meters', label: 'Đồng hồ đo', icon: 'speedometer-outline', iconColor: '#E31B54', backgroundColor: '#E8DEDC' },
  { key: 'people-teams', label: 'Người & Nhóm', icon: 'person', iconColor: '#155EEF', backgroundColor: '#DCE5E9' },
  { key: 'vendors-contractors', label: 'Nhà cung cấp & Nhà thầu', icon: 'people-circle-outline', iconColor: '#F79009', backgroundColor: '#E8E5D8' },
]

function showComingSoon(label: string) {
  Alert.alert(label, 'Module này sẽ được nối dữ liệu và workflow ở batch tiếp theo.')
}

export function MoreScreen({
  onHome,
  onOpenWorkOrders,
  onOpenRequests,
  onOpenEquipment,
  onCreateEquipment,
  onOpenOperatorScan,
  onOpenParts,
  isAdmin = false,
  isOperatorFlow = false,
}: MoreScreenProps) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

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
              onPress={() => {
                if (item.key === 'parts') return onOpenParts()
                if (item.key === 'requests') return onOpenRequests()
                if (item.key === 'assets') return onOpenEquipment()
                return showComingSoon(item.label)
              }}
              style={({ pressed }) => [
                styles.menuCard,
                { backgroundColor: item.backgroundColor },
                pressed && styles.menuCardPressed,
              ]}
            >
              <Text style={styles.menuLabel} numberOfLines={2}>{item.label}</Text>
              <Ionicons name={item.icon} size={29} color={item.iconColor} />
            </Pressable>
          ))}
        </ScrollView>

        <AppBottomNav
          activeTab="more"
          onHome={onHome}
          onWorkOrders={onOpenWorkOrders}
          onCenterPress={handleCenterAction}
          onEquipment={onOpenEquipment}
          onMore={() => {}}
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
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#101828',
    letterSpacing: -0.45,
  },
  content: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 18,
    gap: 10,
  },
  menuCard: {
    minHeight: 88,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  menuCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.995 }],
  },
  menuLabel: {
    flex: 1,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '800',
    color: '#202124',
    letterSpacing: -0.3,
  },
})
