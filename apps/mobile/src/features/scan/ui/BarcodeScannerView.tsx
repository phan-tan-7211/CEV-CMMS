import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'

export function BarcodeScannerView({
  enabled = true,
  onScanned,
}: {
  enabled?: boolean
  onScanned: (code: string) => void
}) {
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)

  if (!permission) {
    return <View style={styles.permissionState}><Text style={styles.permissionText}>Đang kiểm tra quyền camera...</Text></View>
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionState}>
        <Ionicons name="camera-outline" size={46} color="#667085" />
        <Text style={styles.permissionTitle}>Cần quyền truy cập camera</Text>
        <Text style={styles.permissionText}>Cho phép camera để quét mã QR hoặc mã vạch thiết bị.</Text>
        <Pressable onPress={() => void requestPermission()} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Cho phép camera</Text>
        </Pressable>
      </View>
    )
  }

  function handleBarcode(result: BarcodeScanningResult) {
    if (!enabled) return
    const value = String(result.data || '').trim()
    if (value) onScanned(value)
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e'],
        }}
        onBarcodeScanned={enabled ? handleBarcode : undefined}
      />
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.scanHint}>Đưa mã vào giữa khung hình</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Bật tắt đèn pin" onPress={() => setTorch((current) => !current)} style={styles.torchButton}>
        <Ionicons name={torch ? 'flash' : 'flash-outline'} size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  cameraWrap: { flex: 1, overflow: 'hidden', backgroundColor: '#101828' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 250, height: 250, borderRadius: 24, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'transparent' },
  scanHint: { marginTop: 22, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, overflow: 'hidden', fontSize: 14, fontWeight: '800', color: '#FFFFFF', backgroundColor: 'rgba(16,24,40,0.72)' },
  torchButton: { position: 'absolute', right: 18, bottom: 20, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,24,40,0.72)' },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, backgroundColor: '#F8F9FB' },
  permissionTitle: { marginTop: 14, fontSize: 20, fontWeight: '900', color: '#101828' },
  permissionText: { marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#667085' },
  permissionButton: { marginTop: 20, minHeight: 48, paddingHorizontal: 22, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  permissionButtonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
})
