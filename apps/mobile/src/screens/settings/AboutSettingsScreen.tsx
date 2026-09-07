import Constants from 'expo-constants'
import { StyleSheet, Text, View } from 'react-native'

import { SettingsScaffold } from './SettingsScaffold'

function InfoRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>
}

export function AboutSettingsScreen({ onBack }: { onBack: () => void }) {
  const version = Constants.expoConfig?.version || '0.1.0'
  return (
    <SettingsScaffold title="Thông tin ứng dụng" onBack={onBack}>
      <View style={styles.hero}>
        <View style={styles.logo}><Text style={styles.logoText}>CEV</Text></View>
        <Text style={styles.name}>CEV CMMS</Text>
        <Text style={styles.company}>Core Electronics Vietnam</Text>
      </View>
      <View style={styles.group}>
        <InfoRow label="Công ty" value="Core Electronics Vietnam" />
        <InfoRow label="Ứng dụng" value="CEV CMMS" />
        <InfoRow label="Phiên bản" value={version} />
        <InfoRow label="Nền tảng" value="Expo / React Native" />
      </View>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#FFFFFF' },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  logoText: { fontSize: 19, fontWeight: '900', color: '#FFFFFF' },
  name: { marginTop: 12, fontSize: 20, fontWeight: '900', color: '#101828' },
  company: { marginTop: 4, fontSize: 12, color: '#667085' },
  group: { marginTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  row: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  label: { fontSize: 14, fontWeight: '700', color: '#344054' },
  value: { flex: 1, textAlign: 'right', fontSize: 12.5, color: '#667085' },
})