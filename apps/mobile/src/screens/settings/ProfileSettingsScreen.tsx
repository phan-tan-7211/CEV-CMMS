import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'

import { updateOwnProfile } from '../../features/settings'
import { SettingsScaffold } from './SettingsScaffold'

function metaString(session: Session, ...keys: string[]) {
  const metadata = session.user.user_metadata || {}
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export function ProfileSettingsScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const initialName = useMemo(() => metaString(session, 'display_name', 'full_name', 'name') || session.user.email || '', [session])
  const initialPhone = useMemo(() => metaString(session, 'phone', 'phone_number'), [session])
  const [displayName, setDisplayName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [saving, setSaving] = useState(false)

  const department = metaString(session, 'department', 'department_name') || 'Chưa được gán'
  const role = metaString(session, 'role', 'app_role') || 'Chưa được gán'
  const site = metaString(session, 'site', 'site_name') || 'Chưa được gán'

  async function saveProfile() {
    setSaving(true)
    try {
      await updateOwnProfile(displayName, phone)
      Alert.alert('Đã lưu', 'Tên hiển thị và số điện thoại đã được cập nhật.')
    } catch (error) {
      Alert.alert('Không lưu được hồ sơ', error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsScaffold title="Hồ sơ cá nhân" onBack={onBack}>
      <View style={styles.profileHero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(displayName || session.user.email || 'C').trim().slice(0, 1).toUpperCase()}</Text></View>
        <Pressable onPress={() => Alert.alert('Ảnh đại diện', 'Upload avatar lên tài khoản sẽ được nối với storage ở batch dữ liệu tiếp theo.')}>
          <Text style={styles.changeAvatar}>Đổi ảnh đại diện</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>THÔNG TIN CÁ NHÂN</Text>
      <View style={styles.card}>
        <Field label="Tên hiển thị" value={displayName} onChangeText={setDisplayName} placeholder="Tên hiển thị" />
        <Field label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="Số điện thoại" keyboardType="phone-pad" />
        <ReadOnlyField label="Email" value={session.user.email || '—'} />
      </View>

      <Text style={styles.sectionLabel}>TỔ CHỨC · CHỈ ADMIN ĐƯỢC SỬA</Text>
      <View style={styles.card}>
        <ReadOnlyField label="Department" value={department} />
        <ReadOnlyField label="Role" value={role} />
        <ReadOnlyField label="Site" value={site} last />
      </View>

      <Pressable disabled={saving} onPress={() => { void saveProfile() }} style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.pressed]}>
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>Lưu thay đổi</Text>}
      </Pressable>
    </SettingsScaffold>
  )
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'phone-pad' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#98A2B3" keyboardType={keyboardType} style={styles.input} /></View>
}

function ReadOnlyField({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.readOnlyRow, last && styles.noBorder]}><Text style={styles.readOnlyLabel}>{label}</Text><Text style={styles.readOnlyValue}>{value}</Text></View>
}

const styles = StyleSheet.create({
  profileHero: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#FFFFFF' },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  changeAvatar: { marginTop: 10, fontSize: 13, fontWeight: '800', color: '#155EEF' },
  sectionLabel: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  card: { backgroundColor: '#FFFFFF', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  field: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  fieldLabel: { marginBottom: 7, fontSize: 11.5, fontWeight: '700', color: '#667085' },
  input: { minHeight: 43, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', fontSize: 14, color: '#101828' },
  readOnlyRow: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  noBorder: { borderBottomWidth: 0 },
  readOnlyLabel: { fontSize: 14, fontWeight: '700', color: '#344054' },
  readOnlyValue: { flex: 1, textAlign: 'right', fontSize: 13, color: '#98A2B3' },
  saveButton: { minHeight: 50, marginHorizontal: 16, marginTop: 22, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  saveText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.55 },
  pressed: { backgroundColor: '#004EEB' },
})