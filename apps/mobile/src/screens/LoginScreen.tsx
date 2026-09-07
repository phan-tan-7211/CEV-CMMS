import { useRef, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'

export function LoginScreen({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const emailValue = useRef('')
  const passwordValue = useRef('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    const email = emailValue.current.trim()
    const password = passwordValue.current

    if (!email || !password) {
      setError('Nhập email và mật khẩu.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await onSignIn(email, password)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={styles.logo}><Ionicons name="construct" size={28} color="#FFFFFF" /></View>
            <Text style={styles.eyebrow}>CORE ELECTRONICS VIETNAM</Text>
            <Text style={styles.title}>CEV CMMS</Text>
            <Text style={styles.subtitle}>Đăng nhập bằng tài khoản hệ thống hiện có.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputShell}>
              <Ionicons name="mail-outline" size={18} color="#98A2B3" />
              <TextInput
                onChangeText={(value) => { emailValue.current = value }}
                placeholder="name@company.com"
                placeholderTextColor="#98A2B3"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                keyboardType="email-address"
                returnKeyType="next"
                editable={!submitting}
                style={styles.input}
              />
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>Mật khẩu <Text style={styles.required}>*</Text></Text>
            <View style={styles.inputShell}>
              <Ionicons name="lock-closed-outline" size={18} color="#98A2B3" />
              <TextInput
                onChangeText={(value) => { passwordValue.current = value }}
                placeholder="Mật khẩu"
                placeholderTextColor="#98A2B3"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                returnKeyType="done"
                editable={!submitting}
                onSubmitEditing={() => { void signIn() }}
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={submitting}
              onPress={() => { void signIn() }}
              style={({ pressed }) => [styles.button, submitting && styles.buttonDisabled, pressed && !submitting && styles.buttonPressed]}
            >
              {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="log-in-outline" size={19} color="#FFFFFF" />}
              <Text style={styles.buttonText}>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F8F9FB' },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  brandBlock: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF', marginBottom: 14 },
  eyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: '#667085' },
  title: { marginTop: 5, fontSize: 28, lineHeight: 34, fontWeight: '900', color: '#101828' },
  subtitle: { marginTop: 6, textAlign: 'center', fontSize: 13, lineHeight: 19, color: '#667085' },
  card: { borderRadius: 20, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: '#E4E7EC', backgroundColor: '#FFFFFF' },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '800', color: '#475467' },
  passwordLabel: { marginTop: 15 },
  required: { color: '#D92D20' },
  inputShell: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#F8FAFC' },
  input: { flex: 1, minHeight: 48, color: '#101828', fontSize: 14 },
  error: { marginTop: 12, fontSize: 12, lineHeight: 18, color: '#B42318' },
  button: { minHeight: 50, marginTop: 18, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#155EEF' },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { backgroundColor: '#004EEB' },
  buttonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
})
