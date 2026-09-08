import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'
import { loadSettingsBundle, saveWorkOrderSettings, type WorkOrderSettings } from '../../features/settings'

const defaults: WorkOrderSettings = { feedbackEnabled: true, completionNoteRequired: false, numberStartCount: 1, formsEnabled: true, customStatusesEnabled: true, customFieldsEnabled: true, categoriesEnabled: true }

export function WorkOrderSettingsScreen({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState(defaults)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { void loadSettingsBundle().then((bundle) => setSettings(bundle.workOrders)).catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được Work Order settings.')).finally(() => setLoading(false)) }, [])

  async function toggle(key: keyof WorkOrderSettings, value: boolean) {
    if (saving) return
    const previous = settings
    setSettings({ ...settings, [key]: value }); setSaving(true); setError('')
    try { await saveWorkOrderSettings({ [key]: value }) }
    catch (reason) { setSettings(previous); setError(reason instanceof Error ? reason.message : 'Không lưu được Work Order settings.') }
    finally { setSaving(false) }
  }

  return (
    <SettingsScaffold title="Cài đặt Work Order" onBack={onBack}>
      <Text style={styles.section}>WORK ORDER</Text>
      <View style={styles.group}>
        <SettingsRow icon="chatbubble-ellipses-outline" label="Work Order Feedback" value="Cho phép phản hồi sau hoàn thành" toggleValue={settings.feedbackEnabled} onToggle={(v) => void toggle('feedbackEnabled', v)} />
        <SettingsRow icon="create-outline" label="Ghi chú khi hoàn thành" value="Yêu cầu kỹ thuật viên nhập ghi chú" toggleValue={settings.completionNoteRequired} onToggle={(v) => void toggle('completionNoteRequired', v)} />
        <SettingsRow icon="barcode-outline" label="Work Order Number Start Count" value={String(settings.numberStartCount).padStart(6, '0')} disabled />
      </View>
      <Text style={styles.section}>MẪU & PHÂN LOẠI</Text>
      <View style={styles.group}>
        <SettingsRow icon="document-text-outline" label="Work Order Forms" value="Checklist / biểu mẫu công việc" toggleValue={settings.formsEnabled} onToggle={(v) => void toggle('formsEnabled', v)} />
        <SettingsRow icon="git-compare-outline" label="Custom Work Order Statuses" value="Trạng thái tùy chỉnh" toggleValue={settings.customStatusesEnabled} onToggle={(v) => void toggle('customStatusesEnabled', v)} />
        <SettingsRow icon="options-outline" label="Work Order Custom Fields" value="Trường dữ liệu tùy chỉnh" toggleValue={settings.customFieldsEnabled} onToggle={(v) => void toggle('customFieldsEnabled', v)} />
        <SettingsRow icon="pricetags-outline" label="Work Order Categories" value="Danh mục công việc" toggleValue={settings.categoriesEnabled} onToggle={(v) => void toggle('categoriesEnabled', v)} />
      </View>
      {loading || saving ? <View style={styles.status}><ActivityIndicator size="small" /><Text style={styles.statusText}>{loading ? 'Đang tải...' : 'Đang lưu...'}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>Cấu hình Work Order được lưu tập trung trên Supabase và chỉ ADMIN có quyền sửa.</Text>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  note: { padding: 16, fontSize: 11.5, lineHeight: 17, color: '#667085' },
  status: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusText: { fontSize: 11.5, color: '#667085' },
  error: { paddingHorizontal: 16, paddingTop: 12, fontSize: 12, color: '#B42318' },
})
