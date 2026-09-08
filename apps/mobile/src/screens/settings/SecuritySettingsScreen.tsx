import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { updateOwnPassword } from '../../features/settings'
import { SettingsScaffold } from './SettingsScaffold'

export function SecuritySettingsScreen({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function updatePassword() {
    if (password.length < 8) return Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu mới phải có ít nhất 8 ký tự.')
    if (password !== confirmPassword) return Alert.alert('Mật khẩu không khớp', 'Nhập lại mật khẩu mới chưa trùng khớp.')
    setSaving(true)
    try {
      await updateOwnPassword(password)
      setPassword('')
      setConfirmPassword('')
      Alert.alert('Đã cập nhật', 'Mật khẩu tài khoản đã được thay đổi.')
    } catch (error) {
      Alert.alert('Không đổi được mật khẩu', error instanceof Error ? error.message : 'Không thể cập nhật mật khẩu.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScaffold title="Bảo mật" onBack={onBack}>
      <Text style={styles.intro}>Đổi mật khẩu của tài khoản CEV CMMS đang đăng nhập.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Mật khẩu mới</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Tối thiểu 8 ký tự" placeholderTextColor="#98A2B3" style={styles.input} />
        <Text style={[styles.label, styles.secondLabel]}>Nhập lại mật khẩu mới</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Nhập lại mật khẩu" placeholderTextColor="#98A2B3" style={styles.input} />
      </View>
      <Pressable disabled={saving} onPress={() => { void updatePassword() }} style={({ pressed }) => [styles.button, saving && styles.disabled, pressed && styles.pressed]}>
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>Đổi mật khẩu</Text>}
      </Pressable>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, fontSize: 12.5, lineHeight: 18, color: '#667085' },
  card: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  label: { marginBottom: 7, fontSize: 11.5, fontWeight: '800', color: '#667085' },
  secondLabel: { marginTop: 14 },
  input: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', fontSize: 14, color: '#101828', backgroundColor: '#FFFFFF' },
  button: { minHeight: 50, marginHorizontal: 16, marginTop: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  buttonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.55 },
  pressed: { backgroundColor: '#004EEB' },
})