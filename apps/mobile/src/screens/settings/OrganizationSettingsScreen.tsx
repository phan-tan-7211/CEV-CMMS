import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'

export function OrganizationSettingsScreen({ onBack }: { onBack: () => void }) {
  const [automationEnabled, setAutomationEnabled] = useState(true)
  const [multiSiteEnabled, setMultiSiteEnabled] = useState(false)
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
        <SettingsRow icon="flash-outline" label="Automation" value="Bật quy tắc workflow tự động" toggleValue={automationEnabled} onToggle={setAutomationEnabled} />
        <SettingsRow icon="git-branch-outline" label="Multi-Site" value="Cho phép chuyển site/nhà máy" toggleValue={multiSiteEnabled} onToggle={setMultiSiteEnabled} />
        <SettingsRow icon="people-circle-outline" label="User Roles" value="Administrator · Technician · Requester · View Only" disabled />
      </View>
      <Text style={styles.note}>Các lựa chọn trong màn này hiện phục vụ kiểm thử UI. Lưu cấu hình tổ chức lên server sẽ nối sau khi có bảng settings riêng.</Text>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  note: { padding: 16, fontSize: 11.5, lineHeight: 17, color: '#667085' },
})
