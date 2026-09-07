import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { canonicalizeEquipmentValue, cleanEquipmentText, equipmentMatchKey } from './equipmentSuggestions'

type IconName = keyof typeof Ionicons.glyphMap

export function SuggestField({
  label,
  value,
  onChangeText,
  suggestions,
  placeholder,
  required,
  helper,
  icon,
  loading,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  helper?: string
  icon?: IconName
  loading?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const selectionActiveRef = useState({ current: false })[0]

  const cleanedValue = cleanEquipmentText(value)
  const matchKey = equipmentMatchKey(cleanedValue)
  const exact = suggestions.find((option) => equipmentMatchKey(option) === matchKey)

  const filtered = useMemo(() => {
    const query = equipmentMatchKey(value)
    const source = query
      ? suggestions.filter((option) => equipmentMatchKey(option).includes(query))
      : suggestions
    return source.slice(0, 6)
  }, [suggestions, value])

  const showMenu = focused

  function choose(option: string) {
    selectionActiveRef.current = true
    onChangeText(option)
    setFocused(false)
    setTimeout(() => { selectionActiveRef.current = false }, 0)
  }

  function commitFreeText() {
    const canonical = canonicalizeEquipmentValue(value, suggestions)
    if (canonical !== value) onChangeText(canonical)
    setFocused(false)
  }

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
        {icon ? <Ionicons name={icon} size={18} color="#98A2B3" style={styles.inputIcon} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => {
              if (!selectionActiveRef.current) commitFreeText()
            }, 120)
          }}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          autoCorrect={false}
          autoCapitalize="sentences"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mở gợi ý ${label}`}
          hitSlop={8}
          onPress={() => setFocused((current) => !current)}
          style={styles.endButton}
        >
          <Ionicons name={focused ? 'chevron-up' : 'chevron-down'} size={17} color="#667085" />
        </Pressable>
      </View>

      {showMenu ? (
        <View style={styles.menu}>
          {loading ? (
            <View style={styles.menuRow}>
              <Ionicons name="sync-outline" size={16} color="#667085" />
              <Text style={styles.loadingText}>Đang tải dữ liệu chuẩn...</Text>
            </View>
          ) : null}

          {!loading ? filtered.map((option) => {
            const active = equipmentMatchKey(option) === matchKey
            return (
              <Pressable
                key={`${label}-${option}`}
                onPressIn={() => { selectionActiveRef.current = true }}
                onPress={() => choose(option)}
                style={({ pressed }) => [styles.optionRow, active && styles.optionRowActive, pressed && styles.pressed]}
              >
                <Ionicons name={active ? 'checkmark-circle' : 'search-outline'} size={17} color={active ? '#155EEF' : '#667085'} />
                <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={2}>{option}</Text>
              </Pressable>
            )
          }) : null}

          {!loading && filtered.length === 0 && !cleanedValue ? (
            <View style={styles.emptyRow}>
              <Ionicons name="information-circle-outline" size={17} color="#667085" />
              <Text style={styles.emptyText}>Chưa có dữ liệu gợi ý cho trường này.</Text>
            </View>
          ) : null}

          {!loading && cleanedValue && !exact ? (
            <Pressable
              onPressIn={() => { selectionActiveRef.current = true }}
              onPress={() => choose(cleanedValue)}
              style={({ pressed }) => [styles.createRow, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={18} color="#155EEF" />
              <View style={styles.createCopy}>
                <Text style={styles.createTitle}>Thêm mới “{cleanedValue}”</Text>
                <Text style={styles.createHint}>Không có trong dữ liệu hiện tại</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.helper}>
        {loading
          ? 'Đang tải dữ liệu chuẩn...'
          : `${suggestions.length} gợi ý chuẩn · ${helper || 'Chọn giá trị đã có; nếu chưa có vẫn có thể thêm mới.'}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 15 },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '700', color: '#475467' },
  required: { color: '#D92D20' },
  inputShell: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    backgroundColor: '#F8FAFC',
  },
  inputShellFocused: {
    borderColor: '#84ADFF',
    backgroundColor: '#FFFFFF',
    shadowColor: '#155EEF',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  inputIcon: { marginLeft: 14, marginRight: 9 },
  input: { flex: 1, minHeight: 48, paddingVertical: 11, color: '#101828', fontSize: 14 },
  endButton: { paddingHorizontal: 12, paddingVertical: 14 },
  menu: {
    marginTop: 6,
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
  },
  menuRow: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  loadingText: { fontSize: 12, color: '#667085' },
  optionRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
  },
  optionRowActive: { backgroundColor: '#EEF4FF' },
  optionText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#344054' },
  optionTextActive: { fontWeight: '800', color: '#155EEF' },
  emptyRow: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  emptyText: { flex: 1, fontSize: 12, color: '#667085' },
  createRow: {
    minHeight: 50,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    backgroundColor: '#F5F8FF',
  },
  createCopy: { flex: 1 },
  createTitle: { fontSize: 12.5, fontWeight: '800', color: '#155EEF' },
  createHint: { marginTop: 2, fontSize: 10.5, color: '#667085' },
  helper: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: '#7A8699' },
  pressed: { opacity: 0.72 },
})
