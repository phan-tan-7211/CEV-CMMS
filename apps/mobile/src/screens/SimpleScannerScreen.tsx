import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BarcodeScannerView, normalizeScanCode } from '../features/scan'

export function SimpleScannerScreen({
  title = 'Quét mã',
  onBack,
  onResult,
}: {
  title?: string
  onBack: () => void
  onResult: (code: string) => void | boolean | Promise<boolean | void>
}) {
  const [locked, setLocked] = useState(false)

  function finish(rawCode: string) {
    if (locked) return
    const code = normalizeScanCode(rawCode)
    if (!code) return
    setLocked(true)
    Promise.resolve(onResult(code)).then((handled) => {
      if (handled === false) setLocked(false)
    })
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.headerIcon}><Ionicons name="arrow-back" size={27} color="#101828" /></Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.camera}><BarcodeScannerView enabled={!locked} onScanned={finish} /></View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 21, fontWeight: '900', color: '#101828' },
  headerSpacer: { width: 44 },
  camera: { flex: 1, minHeight: 320 },
})
