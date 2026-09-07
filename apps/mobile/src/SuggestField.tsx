import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AutocompleteDropdown } from 'react-native-autocomplete-dropdown'

import { canonicalizeEquipmentValue, cleanEquipmentText } from './equipmentSuggestions'

type IconName = keyof typeof Ionicons.glyphMap

type DropdownController = {
  open?: () => void
  close?: () => void
  setInputText?: (text: string) => void
}

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
  const controllerRef = useRef<DropdownController | null>(null)
  const lastInternalTextRef = useRef(value)

  const dataSet = useMemo(
    () => suggestions.slice(0, 200).map((title, index) => ({ id: `${index}:${title}`, title })),
    [suggestions],
  )

  useEffect(() => {
    if (value !== lastInternalTextRef.current) {
      lastInternalTextRef.current = value
      controllerRef.current?.setInputText?.(value)
    }
  }, [value])

  function handleTextChange(text: string) {
    lastInternalTextRef.current = text
    onChangeText(text)
  }

  function handleBlur() {
    const canonical = canonicalizeEquipmentValue(value, suggestions)
    if (canonical !== value) {
      lastInternalTextRef.current = canonical
      onChangeText(canonical)
      controllerRef.current?.setInputText?.(canonical)
    }
  }

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <AutocompleteDropdown
        controller={(controller) => { controllerRef.current = controller as DropdownController }}
        dataSet={dataSet}
        loading={loading}
        clearOnFocus={false}
        closeOnBlur={false}
        closeOnSubmit={false}
        showClear={false}
        showChevron
        useFilter
        ignoreAccents
        trimSearchText
        matchFrom="any"
        suggestionsListMaxHeight={260}
        initialValue={null}
        onChangeText={handleTextChange}
        onBlur={handleBlur}
        onSelectItem={(item) => {
          if (!item?.title) return
          lastInternalTextRef.current = item.title
          onChangeText(item.title)
        }}
        emptyResultText={value.trim() ? `Không có “${cleanEquipmentText(value)}” · có thể giữ nguyên để thêm mới` : 'Chưa có dữ liệu gợi ý'}
        textInputProps={{
          placeholder,
          placeholderTextColor: '#98A2B3',
          autoCorrect: false,
          autoCapitalize: 'sentences',
          returnKeyType: 'done',
          style: styles.textInput,
        }}
        inputContainerStyle={styles.inputContainer}
        suggestionsListContainerStyle={styles.suggestionsContainer}
        suggestionsListTextStyle={styles.suggestionText}
        containerStyle={styles.dropdownContainer}
        rightButtonsContainerStyle={styles.rightButtons}
        ChevronIconComponent={<Ionicons name="chevron-down" size={17} color="#667085" />}
        renderItem={(item) => (
          <View style={styles.optionRow}>
            <Ionicons name="search-outline" size={17} color="#667085" />
            <Text style={styles.optionText} numberOfLines={2}>{item.title}</Text>
          </View>
        )}
        LeftIconComponent={icon ? <Ionicons name={icon} size={18} color="#98A2B3" /> : undefined}
      />

      <Text style={styles.helper}>
        {loading
          ? 'Đang tải dữ liệu chuẩn...'
          : `${suggestions.length} gợi ý chuẩn · ${helper || 'Gõ để lọc; chọn giá trị đã có hoặc giữ nguyên nội dung mới.'}`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fieldBlock: { marginBottom: 15 },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '700', color: '#475467' },
  required: { color: '#D92D20' },
  dropdownContainer: { width: '100%' },
  inputContainer: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAECF0',
    backgroundColor: '#F8FAFC',
  },
  textInput: {
    minHeight: 48,
    color: '#101828',
    fontSize: 14,
    paddingLeft: 4,
  },
  rightButtons: { right: 4, height: 46, alignSelf: 'center' },
  suggestionsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    elevation: 18,
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  suggestionText: { fontSize: 13, color: '#344054' },
  optionRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
  },
  optionText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#344054' },
  helper: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: '#7A8699' },
})
