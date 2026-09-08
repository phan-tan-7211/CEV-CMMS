import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'
import { loadSettingsBundle, saveOrganizationSettings } from '../../features/settings/api/settingsService'

export function OrganizationSettingsScreen({ onBack }: { onBack: () => void }) {
  const [automationEnabled, setAutomationEnabled] = useState(true)
  const [multiSiteEnabled, setMultiSiteEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void loadSettingsBundle().then((bundle) => {
      setAutomationEnabled(bundle.organization.automationEnabled)
      setMultiSiteEnabled(bundle.organization.multiSiteEnabled)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Không tải được cài đặt tổ chức.')).finally(() => setLoading(false))
  }, [])

  async function update(patch: { automationEnabled?: boolean; multiSiteEnabled?: boolean }) {
    if (saving) return
    const previousAutomation = automationEnabled
    const previousMultiSite = multiSiteEnabled
    if (typeof patch.automationEnabled === 'boolean') setAutomationEnabled(patch.automationEnabled)
    if (typeof patch.multiSiteEnabled === 'boolean') setMultiSiteEnabled(patch.multiSiteEnabled)
    setSaving(true); setError('')
    try { await saveOrganizationSettings(patch) }
    catch (reason) {
      setAutomationEnabled(previousAutomation); setMultiSiteEnabled(previousMultiSite)
      setError(reason instanceof Error ? reason.message : 'Không lưu được cài đặt tổ chức.')
    } finally { setSaving(false) }
  }

  return (
    <SettingsScaffold title="Cài đặt tổ chức" onBack={onBack}>
      <Text style={styles.section}>CHUNG</Text>
      <View style={styles.group}>
        <SettingsRow icon="language-outline" label="Ngôn ngữ mặc định" value="Tiếng Việt" />
        <SettingsRow icon="calendar-outline" label="Định dạng ngày" value="DD/MM/YYYY" />
        <SettingsRow icon="cash-outline" label="Tiền tệ" value="VND" />
        <SettingsRow icon="time-outline" label="Múi giờ" value="Asia/Ho_Chi_Minh" />
      </View>
      <Text style={styles.section}>TỰ ĐỘNG HÓA & SITE</Text>
      <View style={styles.group}>
        <SettingsRow icon="flash-outline" label="Automation" value="Bật quy tắc workflow tự động" toggleValue={automationEnabled} onToggle={(value) => void update({ automationEnabled: value })} />
        <SettingsRow icon="git-branch-outline" label="Multi-Site" value="Cho phép chuyển site/nhà máy" toggleValue={multiSiteEnabled} onToggle={(value) => void update({ multiSiteEnabled: value })} />
        <SettingsRow icon="people-circle-outline" label="User Roles" value="Administrator · Technician · Requester · View Only" disabled />
      </View>
      {loading || saving ? <View style={styles.status}><ActivityIndicator size="small" /><Text style={styles.statusText}>{loading ? 'Đang tải...' : 'Đang lưu...'}</Text></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.note}>Cấu hình này được lưu tập trung trên Supabase. Chỉ tài khoản ADMIN mới được phép thay đổi.</Text>
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
