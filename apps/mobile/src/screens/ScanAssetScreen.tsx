import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BarcodeScannerView, HomeScanResultSheet, resolveHomeScan, type HomeScanResult } from '../features/scan'

const DUPLICATE_SCAN_GUARD_MS = 1200
const UNSUPPORTED_RESULT_RESCAN_DELAY_MS = 1000

export function ScanAssetScreen({
  onBack,
  onOpenEquipment,
  onOpenHierarchy,
  onOpenPendingWorkOrders,
  onOpenPendingRequests,
  onOpenCompletedWorkOrders,
  onCreateAsset,
  onCreatePart,
  onCreateWorkOrder,
  onOpenPart,
  onOpenPartInventory,
  onCreatePartWorkOrder,
  onCreatePortalWorkOrder,
  onCreatePortalRequest,
  isOperatorFlow = false,
}: {
  onBack: () => void
  onOpenEquipment: (equipmentId: string) => void
  onOpenHierarchy: (equipmentId: string) => void
  onOpenPendingWorkOrders: (equipmentId: string) => void
  onOpenPendingRequests: (equipmentId: string) => void
  onOpenCompletedWorkOrders: (equipmentId: string) => void
  onCreateAsset: (code: string) => void
  onCreatePart: (code: string) => void
  onCreateWorkOrder: (equipmentId: string) => void
  onOpenPart: (partId: string) => void
  onOpenPartInventory: (partId: string) => void
  onCreatePartWorkOrder: (partId: string) => void
  onCreatePortalWorkOrder: (equipmentId: string) => void
  onCreatePortalRequest: (equipmentId: string, sourceId?: string) => void
  isOperatorFlow?: boolean
}) {
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
        <HomeScanResultSheet
          loading={resolving}
          result={result}
          onDismiss={closeResult}
          onRescan={rescan}
          onCreateAsset={onCreateAsset}
          onCreatePart={onCreatePart}
          onCreateWorkOrder={onCreateWorkOrder}
          onOpenPart={onOpenPart}
          onOpenPartInventory={onOpenPartInventory}
          onCreatePartWorkOrder={onCreatePartWorkOrder}
          onCreatePortalWorkOrder={onCreatePortalWorkOrder}
          onCreatePortalRequest={onCreatePortalRequest}
          onOpenAsset={onOpenEquipment}
          onOpenHierarchy={onOpenHierarchy}
          onOpenPendingWorkOrders={onOpenPendingWorkOrders}
          onOpenPendingRequests={onOpenPendingRequests}
          onOpenCompletedWorkOrders={onOpenCompletedWorkOrders}
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
})
