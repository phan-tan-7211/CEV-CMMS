import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'
import { WorkOrderSettingsScreen } from './WorkOrderSettingsScreen'
import { loadSettingsBundle, saveModuleSettings, type ModuleSettings } from '../../features/settings'

const defaults: ModuleSettings = { assetsEnabled: true, partsInventoryEnabled: true, requestsEnabled: true, workOrdersEnabled: true, purchaseOrdersEnabled: true, metersEnabled: true, tagsEnabled: true }

export function ModuleSettingsScreen({ onBack }: { onBack: () => void }) {
  const [route, setRoute] = useState<'root' | 'work-orders'>('root')
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { void loadSettingsBundle().then((bundle) => setSettings(bundle.modules)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được module settings.')).finally(() => setLoading(false)) }, [])

  async function toggle(key: keyof ModuleSettings, value: boolean) {
    if (saving) return
    const previous = settings
    const next = { ...settings, [key]: value }
    setSettings(next); setSaving(true); setError('')
    try { await saveModuleSettings({ [key]: value }) }
    catch (reason) { setSettings(previous); setError(reason instanceof Error ? reason.message : 'Không lưu được module settings.') }
    finally { setSaving(false) }
  }

  if (route === 'work-orders') return <WorkOrderSettingsScreen onBack={() => setRoute('root')} />
  return (
    <SettingsScaffold title="Cài đặt module" onBack={onBack}>
      <Text style={styles.section}>MODULE SETTINGS</Text>
      <View style={styles.group}>
        <SettingsRow icon="cube-outline" label="Assets" value="Thiết bị / tài sản" toggleValue={settings.assetsEnabled} onToggle={(v) => void toggle('assetsEnabled', v)} />
        <SettingsRow icon="layers-outline" label="Parts & Inventory" value="Phụ tùng và tồn kho" toggleValue={settings.partsInventoryEnabled} onToggle={(v) => void toggle('partsInventoryEnabled', v)} />
        <SettingsRow icon="mail-unread-outline" label="Requests" value="Yêu cầu bảo trì" toggleValue={settings.requestsEnabled} onToggle={(v) => void toggle('requestsEnabled', v)} />
        <SettingsRow icon="clipboard-outline" label="Work Orders" value="Forms, statuses, custom fields, categories" onPress={() => setRoute('work-orders')} />
        <SettingsRow icon="cart-outline" label="Purchase Orders" value="Đơn mua hàng" toggleValue={settings.purchaseOrdersEnabled} onToggle={(v) => void toggle('purchaseOrdersEnabled', v)} />
        <SettingsRow icon="speedometer-outline" label="Meters" value="Đồng hồ / chỉ số" toggleValue={settings.metersEnabled} onToggle={(v) => void toggle('metersEnabled', v)} />
        <SettingsRow icon="pricetag-outline" label="Tags" value="Nhãn phân loại" toggleValue={settings.tagsEnabled} onToggle={(v) => void toggle('tagsEnabled', v)} />
      </View>
      {loading || saving ? <View style={styles.status}><ActivityIndicator size="small" /><Text style={styles.statusText}>{loading ? 'Đang tải...' : 'Đang lưu...'}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  status: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusText: { fontSize: 11.5, color: '#667085' },
  error: { paddingHorizontal: 16, paddingTop: 12, fontSize: 12, color: '#B42318' },
})
