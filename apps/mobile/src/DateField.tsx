import { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return new Date()
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

export function DateField({
  label,
  value,
  onChange,
  helper,
  maximumDate,
  minimumDate,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  helper?: string
  maximumDate?: Date
  minimumDate?: Date
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const selectedDate = useMemo(() => fromIsoDate(value), [value])

  function handleChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') setPickerOpen(false)
    if (event.type !== 'set' || !date) return
    onChange(toIsoDate(date))
  }

  if (Platform.OS === 'web') {
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

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Chạm để chọn ngày`}
        onPress={() => setPickerOpen(true)}
        style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={18} color="#667085" style={styles.icon} />
        <Text style={[styles.dateText, !value && styles.placeholder]}>
          {value ? displayDate(value) : 'Chọn ngày'}
        </Text>
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Xóa ${label}`}
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation()
              onChange('')
            }}
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={19} color="#98A2B3" />
          </Pressable>
        ) : null}
        <Ionicons name="chevron-down" size={16} color="#98A2B3" style={styles.chevron} />
      </Pressable>

      {pickerOpen ? (
        <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : undefined}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'android' ? 'calendar' : 'inline'}
            onChange={handleChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
          />
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.doneButton} onPress={() => setPickerOpen(false)}>
              <Text style={styles.doneText}>Xong</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
  dateText: { flex: 1, minHeight: 48, textAlignVertical: 'center', paddingVertical: 14, color: '#101828', fontSize: 14, fontWeight: '600' },
  placeholder: { color: '#98A2B3', fontWeight: '400' },
  clearButton: { paddingHorizontal: 7, paddingVertical: 10 },
  chevron: { marginRight: 13 },
  helper: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: '#7A8699' },
  pressed: { opacity: 0.72 },
  iosPickerWrap: { marginTop: 6, borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  doneButton: { alignSelf: 'flex-end', marginRight: 12, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EEF4FF' },
  doneText: { color: '#155EEF', fontWeight: '800', fontSize: 13 },
})
