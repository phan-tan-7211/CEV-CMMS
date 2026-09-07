import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

type IconName = keyof typeof Ionicons.glyphMap

export function ModulePlaceholderScreen({
  title,
  subtitle,
  icon,
  onBack,
  primaryLabel,
  onPrimary,
}: {
  title: string
  subtitle: string
  icon: IconName
  onBack: () => void
  primaryLabel?: string
  onPrimary?: () => void
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#101828" />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}><Ionicons name={icon} size={30} color="#155EEF" /></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {primaryLabel && onPrimary ? (
          <Pressable onPress={onPrimary} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
            <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  header: { minHeight: 62, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC', backgroundColor: '#FFFFFF' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '900', color: '#101828' },
  headerSpacer: { width: 44 },
  content: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  title: { marginTop: 18, textAlign: 'center', fontSize: 24, lineHeight: 30, fontWeight: '900', color: '#101828' },
  subtitle: { marginTop: 8, maxWidth: 340, textAlign: 'center', fontSize: 13, lineHeight: 20, color: '#667085' },
  primaryButton: { minHeight: 48, marginTop: 24, paddingHorizontal: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#155EEF' },
  primaryButtonPressed: { backgroundColor: '#004EEB' },
  primaryButtonText: { fontSize: 13.5, fontWeight: '900', color: '#FFFFFF' },
})
