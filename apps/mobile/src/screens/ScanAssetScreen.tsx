import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BarcodeScannerView, HomeScanResultSheet, resolveHomeScan, type HomeScanResult } from '../features/scan'

const DUPLICATE_SCAN_GUARD_MS = 1200
const UNSUPPORTED_RESULT_RESCAN_DELAY_MS = 1000

export function ScanAssetScreen({
  onBack,
  onOpenEquipment,
  isOperatorFlow = false,
}: {
  onBack: () => void
  onOpenEquipment: (equipmentId: string) => void
  isOperatorFlow?: boolean
}) {
  const [manualCode, setManualCode] = useState('')
  const [resolving, setResolving] = useState(false)
  const [result, setResult] = useState<HomeScanResult | null>(null)
  const [scannerEnabled, setScannerEnabled] = useState(true)
  const [operatorMessage, setOperatorMessage] = useState('')
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const rescanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (rescanTimerRef.current) clearTimeout(rescanTimerRef.current)
  }, [])

  function enableRescan(delayMs = 0) {
    if (rescanTimerRef.current) clearTimeout(rescanTimerRef.current)
    rescanTimerRef.current = setTimeout(() => {
      setOperatorMessage('')
      setResult(null)
      setScannerEnabled(true)
    }, delayMs)
  }

  async function resolveCode(code: string) {
    const normalized = code.trim()
    if (!normalized || resolving) return

    const now = Date.now()
    if (lastScanRef.current.code === normalized && now - lastScanRef.current.at < DUPLICATE_SCAN_GUARD_MS) return
    lastScanRef.current = { code: normalized, at: now }

    setScannerEnabled(false)
    setResolving(true)
    setResult(null)
    setOperatorMessage('')

    try {
      const next = await resolveHomeScan(normalized)

      if (isOperatorFlow) {
        if (next.type === 'asset') {
          onOpenEquipment(next.asset.equipmentId)
          return
        }

        setOperatorMessage(next.type === 'not-found'
          ? 'Không tìm thấy thiết bị phù hợp. Đang quét lại...'
          : 'Kết quả này không hỗ trợ trong chế độ Operator. Đang quét lại...')
        enableRescan(UNSUPPORTED_RESULT_RESCAN_DELAY_MS)
        return
      }

      setResult(next)
    } finally {
      setResolving(false)
    }
  }

  function closeResult() {
    setResult(null)
    setScannerEnabled(true)
  }

  function rescan() {
    lastScanRef.current = { code: '', at: 0 }
    closeResult()
  }

  function selectMultiple(type: 'asset' | 'part', id: string) {
    if (type === 'asset') {
      void resolveCode(id)
      return
    }
    setResult({ type: 'part', code: id, partId: id, label: id })
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} hitSlop={8} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={27} color="#101828" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Quét mã</Text>
          <Text style={styles.headerSub}>{isOperatorFlow ? 'Operator · quét thiết bị để mở trực tiếp' : 'Tra cứu nhanh thiết bị / phụ tùng từ QR hoặc barcode'}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.cameraSection}>
        <BarcodeScannerView enabled={scannerEnabled && !resolving && !result} onScanned={(code) => void resolveCode(code)} />
        {operatorMessage ? (
          <View style={styles.operatorToast}>
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.operatorToastText}>{operatorMessage}</Text>
          </View>
        ) : null}
      </View>

      {!isOperatorFlow ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.manualPanel}>
          <Text style={styles.manualLabel}>Hoặc nhập mã thủ công</Text>
          <View style={styles.manualRow}>
            <View style={styles.inputWrap}>
              <Ionicons name="barcode-outline" size={22} color="#667085" />
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                onSubmitEditing={() => void resolveCode(manualCode)}
                placeholder="Ví dụ: CEV-PR-118"
                placeholderTextColor="#98A2B3"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                style={styles.input}
              />
              {manualCode ? <Pressable onPress={() => setManualCode('')} hitSlop={8}><Ionicons name="close-circle" size={21} color="#98A2B3" /></Pressable> : null}
            </View>
            <Pressable disabled={!manualCode.trim() || resolving} onPress={() => void resolveCode(manualCode)} style={({ pressed }) => [styles.searchButton, (!manualCode.trim() || resolving) && styles.searchButtonDisabled, pressed && styles.pressed]}>
              <Ionicons name="search" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      ) : null}

      {!isOperatorFlow ? (
        <HomeScanResultSheet
          loading={resolving}
          result={result}
          onDismiss={closeResult}
          onRescan={rescan}
          onOpenAsset={onOpenEquipment}
          onSelectMultiple={selectMultiple}
        />
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 66, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 21, lineHeight: 26, fontWeight: '900', color: '#101828' },
  headerSub: { marginTop: 1, fontSize: 11.5, lineHeight: 15, color: '#667085' },
  headerSpacer: { width: 44 },
  cameraSection: { flex: 1, minHeight: 320, backgroundColor: '#101828' },
  operatorToast: { position: 'absolute', left: 16, right: 16, bottom: 18, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: 'rgba(16,24,40,0.90)' },
  operatorToastText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '700', color: '#FFFFFF' },
  manualPanel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  manualLabel: { marginBottom: 7, fontSize: 12.5, fontWeight: '800', color: '#475467' },
  manualRow: { flexDirection: 'row', gap: 10 },
  inputWrap: { flex: 1, minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 48, fontSize: 15.5, color: '#101828' },
  searchButton: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  searchButtonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
})
