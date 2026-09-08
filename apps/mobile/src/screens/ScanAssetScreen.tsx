import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BarcodeScannerView, resolveHomeScan, type HomeScanResult } from '../features/scan'

export function ScanAssetScreen({
  onBack,
  onOpenEquipment,
}: {
  onBack: () => void
  onOpenEquipment: (equipmentId: string) => void
}) {
  const [manualCode, setManualCode] = useState('')
  const [resolving, setResolving] = useState(false)
  const [result, setResult] = useState<HomeScanResult | null>(null)
  const [scannerEnabled, setScannerEnabled] = useState(true)

  async function resolveCode(code: string) {
    const normalized = code.trim()
    if (!normalized || resolving) return
    setScannerEnabled(false)
    setResolving(true)
    setResult(null)
    try {
      setResult(await resolveHomeScan(normalized))
    } finally {
      setResolving(false)
    }
  }

  function closeResult() {
    setResult(null)
    setScannerEnabled(true)
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} hitSlop={8} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={27} color="#101828" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Quét mã</Text>
          <Text style={styles.headerSub}>Tìm nhanh thiết bị từ mã QR / barcode</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.cameraSection}>
        <BarcodeScannerView enabled={scannerEnabled && !resolving && !result} onScanned={(code) => void resolveCode(code)} />
      </View>

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

      {(resolving || result) ? (
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={resolving ? undefined : closeResult} />
          <View style={styles.sheet}>
            <View style={styles.sheetGrabber} />
            {resolving ? (
              <View style={styles.loadingResult}>
                <ActivityIndicator size="large" color="#155EEF" />
                <Text style={styles.resultTitle}>Đang tra cứu mã...</Text>
                <Text style={styles.resultText}>CEV CMMS đang kiểm tra dữ liệu trên hệ thống.</Text>
              </View>
            ) : result?.type === 'asset' ? (
              <>
                <View style={styles.resultHeading}>
                  <View style={styles.resultIcon}><Ionicons name="cube-outline" size={24} color="#155EEF" /></View>
                  <View style={styles.resultHeadingCopy}>
                    <Text style={styles.resultEyebrow}>Thiết bị</Text>
                    <Text style={styles.resultTitle}>{result.asset.equipmentName || result.asset.equipmentId}</Text>
                  </View>
                </View>
                <View style={styles.assetCard}>
                  <Text style={styles.assetCode}>{result.asset.equipmentId}</Text>
                  <Text style={styles.assetMeta}>{[result.asset.model, result.asset.area, result.asset.line].filter(Boolean).join(' · ') || 'Không có thông tin bổ sung'}</Text>
                  <Text style={styles.assetStatus}>Trạng thái: {result.asset.status || '—'}</Text>
                </View>
                <Pressable onPress={() => onOpenEquipment(result.asset.equipmentId)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>Mở chi tiết thiết bị</Text>
                </Pressable>
                <Pressable onPress={closeResult} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Quét mã khác</Text></Pressable>
              </>
            ) : result?.type === 'not-found' ? (
              <>
                <View style={styles.loadingResult}>
                  <View style={[styles.resultIcon, styles.notFoundIcon]}><Ionicons name="search-outline" size={26} color="#B54708" /></View>
                  <Text style={styles.resultTitle}>Không tìm thấy kết quả</Text>
                  <Text style={styles.resultText}>Không có thiết bị với mã “{result.code}”. Kiểm tra lại mã hoặc thử tìm thủ công.</Text>
                </View>
                <Pressable onPress={closeResult} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Quét lại</Text></Pressable>
              </>
            ) : (
              <>
                <View style={styles.loadingResult}>
                  <Text style={styles.resultTitle}>Kết quả chưa được hỗ trợ</Text>
                  <Text style={styles.resultText}>Luồng Part / nhiều kết quả / Request Portal sẽ được nối khi backend tương ứng có contract thật.</Text>
                </View>
                <Pressable onPress={closeResult} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>Quét lại</Text></Pressable>
              </>
            )}
          </View>
        </View>
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
  manualPanel: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  manualLabel: { marginBottom: 7, fontSize: 12.5, fontWeight: '800', color: '#475467' },
  manualRow: { flexDirection: 'row', gap: 10 },
  inputWrap: { flex: 1, minHeight: 50, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  input: { flex: 1, minHeight: 48, fontSize: 15.5, color: '#101828' },
  searchButton: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  searchButtonDisabled: { opacity: 0.45 },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.48)' },
  sheet: { paddingHorizontal: 18, paddingTop: 9, paddingBottom: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF' },
  sheetGrabber: { alignSelf: 'center', width: 42, height: 5, marginBottom: 16, borderRadius: 3, backgroundColor: '#D0D5DD' },
  loadingResult: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 14 },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  resultHeadingCopy: { flex: 1 },
  resultIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FF' },
  notFoundIcon: { backgroundColor: '#FFFAEB' },
  resultEyebrow: { fontSize: 11.5, fontWeight: '900', color: '#155EEF', textTransform: 'uppercase' },
  resultTitle: { marginTop: 6, fontSize: 20, lineHeight: 25, fontWeight: '900', color: '#101828', textAlign: 'center' },
  resultText: { marginTop: 7, fontSize: 14, lineHeight: 20, color: '#667085', textAlign: 'center' },
  assetCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: '#F9FAFB' },
  assetCode: { fontSize: 15, fontWeight: '900', color: '#101828' },
  assetMeta: { marginTop: 5, fontSize: 13.5, lineHeight: 19, color: '#475467' },
  assetStatus: { marginTop: 5, fontSize: 12.5, fontWeight: '800', color: '#344054' },
  primaryButton: { minHeight: 52, marginTop: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  primaryButtonText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14.5, fontWeight: '800', color: '#475467' },
  pressed: { opacity: 0.82 },
})
