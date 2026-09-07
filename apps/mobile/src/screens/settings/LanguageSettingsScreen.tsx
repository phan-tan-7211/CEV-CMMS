import { StyleSheet, Text, View } from 'react-native'

import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'

export function LanguageSettingsScreen({ onBack }: { onBack: () => void }) {
  return (
    <SettingsScaffold title="Ngôn ngữ" onBack={onBack}>
      <Text style={styles.intro}>Kiến trúc CEV CMMS chuẩn bị sẵn cho 3 ngôn ngữ. Giai đoạn hiện tại chỉ bật Tiếng Việt.</Text>
      <View style={styles.group}>
        <SettingsRow icon="language-outline" label="Tiếng Việt" value="Đang sử dụng" />
        <SettingsRow icon="language-outline" label="한국어" value="Sắp mở" disabled />
        <SettingsRow icon="language-outline" label="English" value="Sắp mở" disabled />
      </View>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, fontSize: 12.5, lineHeight: 18, color: '#667085' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
})