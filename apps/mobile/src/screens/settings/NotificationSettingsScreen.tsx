import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'

type Preferences = {
  assignedWorkOrder: boolean
  overdueWorkOrder: boolean
  upcomingPm: boolean
  equipmentIncident: boolean
  system: boolean
}

const DEFAULTS: Preferences = {
  assignedWorkOrder: true,
  overdueWorkOrder: true,
  upcomingPm: true,
  equipmentIncident: true,
  system: true,
}

export function NotificationSettingsScreen({ userId, onBack }: { userId: string; onBack: () => void }) {
  const storageKey = `cev:notification-preferences:${userId}`
  const [preferences, setPreferences] = useState<Preferences | null>(null)

  useEffect(() => {
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!raw) return setPreferences(DEFAULTS)
      try { setPreferences({ ...DEFAULTS, ...JSON.parse(raw) }) } catch { setPreferences(DEFAULTS) }
    })
  }, [storageKey])

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    if (!preferences) return
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    void AsyncStorage.setItem(storageKey, JSON.stringify(next))
  }

  return (
    <SettingsScaffold title="Thông báo" onBack={onBack}>
      <Text style={styles.intro}>Chọn những loại cảnh báo CEV CMMS được phép gửi cho tài khoản này.</Text>
      {!preferences ? (
        <View style={styles.loading}><ActivityIndicator size="small" color="#155EEF" /></View>
      ) : (
        <View style={styles.group}>
          <SettingsRow icon="person-add-outline" label="Work Order được giao" toggleValue={preferences.assignedWorkOrder} onToggle={(value) => update('assignedWorkOrder', value)} />
          <SettingsRow icon="alert-circle-outline" label="Work Order quá hạn" toggleValue={preferences.overdueWorkOrder} onToggle={(value) => update('overdueWorkOrder', value)} />
          <SettingsRow icon="calendar-outline" label="PM sắp đến hạn" toggleValue={preferences.upcomingPm} onToggle={(value) => update('upcomingPm', value)} />
          <SettingsRow icon="warning-outline" label="Sự cố thiết bị" toggleValue={preferences.equipmentIncident} onToggle={(value) => update('equipmentIncident', value)} />
          <SettingsRow icon="notifications-outline" label="Thông báo hệ thống" toggleValue={preferences.system} onToggle={(value) => update('system', value)} />
        </View>
      )}
      <Text style={styles.footnote}>Thiết lập hiện được lưu trên thiết bị. Batch backend notification sau sẽ đồng bộ preference này với tài khoản.</Text>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, fontSize: 12.5, lineHeight: 18, color: '#667085' },
  loading: { paddingVertical: 28, alignItems: 'center' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  footnote: { paddingHorizontal: 16, paddingTop: 12, fontSize: 10.5, lineHeight: 16, color: '#98A2B3' },
})