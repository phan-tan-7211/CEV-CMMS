import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Ionicons } from '@expo/vector-icons'

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return new Date()
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDisplayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return value.trim()
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
  const [iosPickerOpen, setIosPickerOpen] = useState(false)
  const selectedDate = parseDate(value)

  function handleChange(event: DateTimePickerEvent, nextDate?: Date) {
    if (Platform.OS === 'ios') setIosPickerOpen(false)
    if (event.type !== 'set' || !nextDate) return
    onChange(toIsoDate(nextDate))
  }

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: 'date',
        display: 'calendar',
        maximumDate,
        minimumDate,
        onChange: handleChange,
      })
      return
    }
    setIosPickerOpen(true)
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value ? toDisplayDate(value) : 'Chưa chọn ngày'}`}
        onPress={openPicker}
        style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
      >
        <Ionicons name="calendar-outline" size={18} color="#667085" style={styles.icon} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? toDisplayDate(value) : 'Chọn ngày'}
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
            <Ionicons name="close-circle" size={20} color="#98A2B3" />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={18} color="#98A2B3" />
        )}
      </Pressable>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}

      {Platform.OS === 'ios' && iosPickerOpen ? (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="spinner"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  block: { marginBottom: 15 },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '700', color: '#475467' },
  shell: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#F8FAFC', paddingRight: 14 },
  icon: { marginLeft: 14, marginRight: 9 },
  value: { flex: 1, fontSize: 14, color: '#101828', fontWeight: '600' },
  placeholder: { color: '#98A2B3', fontWeight: '400' },
  clearButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  helper: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: '#7A8699' },
  pressed: { opacity: 0.74 },
})
