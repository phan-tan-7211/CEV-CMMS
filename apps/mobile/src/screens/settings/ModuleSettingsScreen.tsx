import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'
import { WorkOrderSettingsScreen } from './WorkOrderSettingsScreen'

export function ModuleSettingsScreen({ onBack }: { onBack: () => void }) {
  const [route, setRoute] = useState<'root' | 'work-orders'>('root')
  if (route === 'work-orders') return <WorkOrderSettingsScreen onBack={() => setRoute('root')} />
  return (
    <SettingsScaffold title="Cài đặt module" onBack={onBack}>
      <Text style={styles.section}>MODULE SETTINGS</Text>
      <View style={styles.group}>
        <SettingsRow icon="cube-outline" label="Assets" value="Thiết bị / tài sản" disabled />
        <SettingsRow icon="layers-outline" label="Parts & Inventory" value="Phụ tùng và tồn kho" disabled />
        <SettingsRow icon="mail-unread-outline" label="Requests" value="Yêu cầu bảo trì" disabled />
        <SettingsRow icon="clipboard-outline" label="Work Orders" value="Forms, statuses, custom fields, categories" onPress={() => setRoute('work-orders')} />
        <SettingsRow icon="cart-outline" label="Purchase Orders" value="Đơn mua hàng" disabled />
        <SettingsRow icon="speedometer-outline" label="Meters" value="Đồng hồ / chỉ số" disabled />
        <SettingsRow icon="pricetag-outline" label="Tags" value="Nhãn phân loại" disabled />
      </View>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
})
