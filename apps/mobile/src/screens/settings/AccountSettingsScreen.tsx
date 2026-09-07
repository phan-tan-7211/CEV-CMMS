import { useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { Ionicons } from '@expo/vector-icons'

import { SettingsRow } from './SettingsRow'
import { SettingsScaffold } from './SettingsScaffold'
import { ProfileSettingsScreen } from './ProfileSettingsScreen'
import { NotificationSettingsScreen } from './NotificationSettingsScreen'
import { LanguageSettingsScreen } from './LanguageSettingsScreen'
import { SecuritySettingsScreen } from './SecuritySettingsScreen'
import { AboutSettingsScreen } from './AboutSettingsScreen'

type SettingsRoute = 'root' | 'profile' | 'notifications' | 'language' | 'security' | 'about'

function displayName(session: Session) {
  const metadata = session.user.user_metadata || {}
  return String(metadata.display_name || metadata.full_name || metadata.name || session.user.email || 'CEV User')
}

export function AccountSettingsScreen({ session, onBack, onSignOut }: { session: Session; onBack: () => void; onSignOut: () => Promise<void> }) {
  const [route, setRoute] = useState<SettingsRoute>('root')
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError('')
    try {
      await onSignOut()
    } catch (reason) {
      setSignOutError(reason instanceof Error ? reason.message : 'Đăng xuất thất bại.')
      setSigningOut(false)
    }
  }

  function confirmSignOut() {
    if (signingOut) return

    if (Platform.OS === 'web') {
      const confirm = (globalThis as typeof globalThis & { confirm?: (message: string) => boolean }).confirm
      if (!confirm || confirm('Bạn muốn đăng xuất khỏi CEV CMMS?')) {
        void signOut()
      }
      return
    }

    Alert.alert('Đăng xuất', 'Bạn muốn đăng xuất khỏi CEV CMMS?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => { void signOut() } },
    ])
  }

  if (route === 'profile') return <ProfileSettingsScreen session={session} onBack={() => setRoute('root')} />
  if (route === 'notifications') return <NotificationSettingsScreen userId={session.user.id} onBack={() => setRoute('root')} />
  if (route === 'language') return <LanguageSettingsScreen onBack={() => setRoute('root')} />
  if (route === 'security') return <SecuritySettingsScreen onBack={() => setRoute('root')} />
  if (route === 'about') return <AboutSettingsScreen onBack={() => setRoute('root')} />

  const name = displayName(session)
  const department = String(session.user.user_metadata?.department || session.user.user_metadata?.department_name || 'Chưa được gán')
  const role = String(session.user.user_metadata?.role || session.user.user_metadata?.app_role || 'Chưa được gán')
  const site = String(session.user.user_metadata?.site || session.user.user_metadata?.site_name || 'Chưa được gán')

  return (
    <SettingsScaffold title="Cài đặt tài khoản" onBack={onBack}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name.trim().slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.email} numberOfLines={1}>{session.user.email || '—'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ" onPress={() => setRoute('profile')} style={styles.profileChevron}>
          <Ionicons name="chevron-forward" size={22} color="#B0B7C3" />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>TÀI KHOẢN</Text>
      <View style={styles.group}>
        <SettingsRow icon="person-outline" label="Hồ sơ cá nhân" value="Avatar, tên hiển thị, số điện thoại" onPress={() => setRoute('profile')} />
        <SettingsRow icon="notifications-outline" label="Thông báo" value="Chọn từng loại cảnh báo" onPress={() => setRoute('notifications')} />
        <SettingsRow icon="language-outline" label="Ngôn ngữ" value="Tiếng Việt" onPress={() => setRoute('language')} />
        <SettingsRow icon="shield-checkmark-outline" label="Bảo mật" value="Đổi mật khẩu" onPress={() => setRoute('security')} />
      </View>

      <Text style={styles.sectionLabel}>TỔ CHỨC · CHỈ ADMIN ĐƯỢC SỬA</Text>
      <View style={styles.group}>
        <SettingsRow icon="business-outline" label="Department" value={department} disabled />
        <SettingsRow icon="people-outline" label="Role" value={role} disabled />
        <SettingsRow icon="location-outline" label="Site" value={site} disabled />
      </View>

      <Text style={styles.sectionLabel}>HỆ THỐNG</Text>
      <View style={styles.group}>
        <SettingsRow icon="information-circle-outline" label="Thông tin ứng dụng" value="CEV CMMS" onPress={() => setRoute('about')} />
        {signingOut ? (
          <View style={styles.signingOutRow}>
            <ActivityIndicator size="small" color="#D92D20" />
            <Text style={styles.signingOutText}>Đang đăng xuất...</Text>
          </View>
        ) : (
          <SettingsRow
            icon="log-out-outline"
            label="Đăng xuất"
            destructive
            onPress={confirmSignOut}
          />
        )}
      </View>
      {signOutError ? <Text style={styles.error}>{signOutError}</Text> : null}
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  profileHeader: { minHeight: 92, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  avatarText: { fontSize: 21, fontWeight: '900', color: '#FFFFFF' },
  profileCopy: { flex: 1, minWidth: 0, paddingHorizontal: 13 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#101828' },
  email: { marginTop: 3, fontSize: 11.5, color: '#667085' },
  profileChevron: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginTop: 18, marginBottom: 7, paddingHorizontal: 16, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.65, color: '#98A2B3' },
  group: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  signingOutRow: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF' },
  signingOutText: { fontSize: 14, fontWeight: '800', color: '#B42318' },
  error: { paddingHorizontal: 16, paddingTop: 10, fontSize: 12, lineHeight: 18, color: '#B42318' },
})
