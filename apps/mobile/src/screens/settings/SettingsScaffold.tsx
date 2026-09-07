import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

export function SettingsScaffold({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={8} onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={25} color="#344054" />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC', backgroundColor: '#FFFFFF' },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 42 },
  title: { flex: 1, textAlign: 'center', fontSize: 17, lineHeight: 22, fontWeight: '900', color: '#101828' },
  scroll: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { paddingBottom: 28 },
})