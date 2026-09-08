import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
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
  onResult: (code: string) => void
}) {
  const [manualCode, setManualCode] = useState('')
  const [locked, setLocked] = useState(false)

  function finish(rawCode: string) {
    if (locked) return
    const code = normalizeScanCode(rawCode)
    if (!code) return
    setLocked(true)
    onResult(code)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.headerIcon}><Ionicons name="arrow-back" size={27} color="#101828" /></Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.camera}><BarcodeScannerView enabled={!locked} onScanned={finish} /></View>
      <View style={styles.footer}>
        <Text style={styles.caption}>Máy quét đơn thuần: chỉ trả chuỗi mã cho màn gọi, không tra cứu dữ liệu.</Text>
        <View style={styles.manualRow}>
          <TextInput value={manualCode} onChangeText={setManualCode} onSubmitEditing={() => finish(manualCode)} placeholder="Nhập mã thủ công" placeholderTextColor="#98A2B3" autoCapitalize="characters" autoCorrect={false} style={styles.input} />
          <Pressable disabled={!manualCode.trim()} onPress={() => finish(manualCode)} style={[styles.doneButton, !manualCode.trim() && styles.disabled]}><Text style={styles.doneText}>Xong</Text></Pressable>
        </View>
      </View>
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
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  caption: { marginBottom: 10, fontSize: 12, lineHeight: 17, color: '#667085' },
  manualRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', fontSize: 15, color: '#101828' },
  doneButton: { minWidth: 82, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  disabled: { opacity: 0.45 },
  doneText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
})
