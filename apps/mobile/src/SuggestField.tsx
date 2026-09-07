import { useEffect, useMemo, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  AutocompleteDropdown,
  type IAutocompleteDropdownRef,
} from 'react-native-autocomplete-dropdown'

import { canonicalizeEquipmentValue, cleanEquipmentText } from './equipmentSuggestions'

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
  const controllerRef = useRef<IAutocompleteDropdownRef | null>(null)
  const lastInternalTextRef = useRef(value)

  const dataSet = useMemo(
    () => suggestions.slice(0, 500).map((title, index) => ({ id: `${index}:${title}`, title })),
    [suggestions],
  )

  useEffect(() => {
    if (value === lastInternalTextRef.current) return
    lastInternalTextRef.current = value
    controllerRef.current?.setInputText(value)
  }, [value])

  function handleTextChange(text: string) {
    lastInternalTextRef.current = text
    onChangeText(text)
  }

  function commitCanonicalValue() {
    const canonical = canonicalizeEquipmentValue(value, suggestions)
    if (canonical === value) return
    lastInternalTextRef.current = canonical
    onChangeText(canonical)
    controllerRef.current?.setInputText(canonical)
  }

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <AutocompleteDropdown
        controller={controllerRef}
        dataSet={dataSet}
        loading={loading}
        enableLoadingIndicator
        clearOnFocus={false}
        closeOnBlur={false}
        closeOnSubmit={false}
        showClear={false}
        showChevron
        useFilter
        ignoreAccents
        trimSearchText
        matchFrom="any"
        debounce={0}
        suggestionsListMaxHeight={260}
        onChangeText={handleTextChange}
        onBlur={commitCanonicalValue}
        onSubmit={commitCanonicalValue}
        onSelectItem={(item) => {
          if (!item?.title) return
          lastInternalTextRef.current = item.title
          onChangeText(item.title)
        }}
        emptyResultText={value.trim()
          ? `Không có “${cleanEquipmentText(value)}” · giữ nguyên để thêm mới`
          : 'Chưa có dữ liệu gợi ý'}
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
        LeftComponent={icon ? (
          <View style={styles.leftIcon}>
            <Ionicons name={icon} size={18} color="#98A2B3" />
          </View>
        ) : undefined}
        renderItem={(item) => (
          <View style={styles.optionRow}>
            <Ionicons name="search-outline" size={17} color="#667085" />
            <Text style={styles.optionText} numberOfLines={2}>{item.title}</Text>
          </View>
        )}
        flatListProps={{
          keyboardShouldPersistTaps: 'always',
          nestedScrollEnabled: true,
        }}
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
  leftIcon: { width: 40, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    minHeight: 48,
    color: '#101828',
    fontSize: 14,
    paddingLeft: 0,
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
