import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function DateField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  helper?: string
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.shell}>
        <Ionicons name="calendar-outline" size={18} color="#98A2B3" style={styles.icon} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#98A2B3"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginBottom: 15 },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '700', color: '#475467' },
  shell: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#F8FAFC' },
  icon: { marginLeft: 14, marginRight: 9 },
  input: { flex: 1, minHeight: 48, paddingRight: 14, color: '#101828', fontSize: 14 },
  helper: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: '#7A8699' },
})
