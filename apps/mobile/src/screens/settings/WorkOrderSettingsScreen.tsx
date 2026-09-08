import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'

export function WorkOrderSettingsScreen({ onBack }: { onBack: () => void }) {
  const [feedbackEnabled, setFeedbackEnabled] = useState(true)
  const [requireCompletionNote, setRequireCompletionNote] = useState(false)
  return (
    <SettingsScaffold title="Cài đặt Work Order" onBack={onBack}>
      <Text style={styles.section}>WORK ORDER</Text>
      <View style={styles.group}>
        <SettingsRow icon="chatbubble-ellipses-outline" label="Work Order Feedback" value="Cho phép phản hồi sau hoàn thành" toggleValue={feedbackEnabled} onToggle={setFeedbackEnabled} />
        <SettingsRow icon="create-outline" label="Ghi chú khi hoàn thành" value="Yêu cầu kỹ thuật viên nhập ghi chú" toggleValue={requireCompletionNote} onToggle={setRequireCompletionNote} />
        <SettingsRow icon="barcode-outline" label="Work Order Number Start Count" value="000001" disabled />
      </View>
      <Text style={styles.section}>MẪU & PHÂN LOẠI</Text>
      <View style={styles.group}>
        <SettingsRow icon="document-text-outline" label="Work Order Forms" value="Checklist / biểu mẫu công việc" disabled />
        <SettingsRow icon="git-compare-outline" label="Custom Work Order Statuses" value="Trạng thái tùy chỉnh" disabled />
        <SettingsRow icon="options-outline" label="Work Order Custom Fields" value="Trường dữ liệu tùy chỉnh" disabled />
        <SettingsRow icon="pricetags-outline" label="Work Order Categories" value="Danh mục công việc" disabled />
      </View>
      <Text style={styles.note}>Các toggle có thể kiểm thử trực tiếp trong phiên. Các mục quản trị cấu hình cần backend settings riêng trước khi cho phép lưu toàn công ty.</Text>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  note: { padding: 16, fontSize: 11.5, lineHeight: 17, color: '#667085' },
})
