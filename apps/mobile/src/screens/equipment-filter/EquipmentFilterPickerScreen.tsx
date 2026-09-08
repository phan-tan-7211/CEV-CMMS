import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

import { NO_ASSIGNEES_FILTER_VALUE } from '../../features/equipment'

export type EquipmentFilterPickerKey = 'locations' | 'primaryUsers' | 'assignedUsers' | 'assignedTeams' | 'assignedVendors' | 'assignedCustomers'

type Props = {
  pickerKey: EquipmentFilterPickerKey
  title: string
  values: string[]
  selected: string[]
  onToggle: (value: string) => void
  onDone: () => void
}

type LocationSort = 'name-asc' | 'name-desc'

const LOCATION_SORTS: Array<{ key: LocationSort; label: string }> = [
  { key: 'name-asc', label: 'Tên vị trí (A–Z)' },
  { key: 'name-desc', label: 'Tên vị trí (Z–A)' },
]

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi')
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '—'
}

function isPeoplePicker(key: EquipmentFilterPickerKey) {
  return key === 'primaryUsers' || key === 'assignedUsers'
}

function pickerSearchPlaceholder(key: EquipmentFilterPickerKey) {
  if (key === 'locations') return 'Tìm kiếm vị trí'
  if (isPeoplePicker(key)) return 'Tìm kiếm người'
  if (key === 'assignedTeams') return 'Tìm kiếm nhóm'
  if (key === 'assignedVendors') return 'Tìm kiếm nhà cung cấp'
  return 'Tìm kiếm khách hàng'
}

export function EquipmentFilterPickerScreen({ pickerKey, title, values, selected, onToggle, onDone }: Props) {
  const [query, setQuery] = useState('')
  const [locationSort, setLocationSort] = useState<LocationSort>('name-asc')
  const [locationSortOpen, setLocationSortOpen] = useState(false)
  const [locationRoot, setLocationRoot] = useState('')

  const filtered = useMemo(() => {
    let next = [...values]
    const needle = normalize(query)
    if (needle) next = next.filter((value) => normalize(value).includes(needle))
    if (pickerKey === 'locations') {
      if (locationRoot) next = next.filter((value) => value === locationRoot || value.startsWith(`${locationRoot} · `))
      next.sort((a, b) => locationSort === 'name-desc'
        ? b.localeCompare(a, 'vi', { sensitivity: 'base', numeric: true })
        : a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }))
    }
    return next
  }, [locationRoot, locationSort, pickerKey, query, values])

  const locationRoots = useMemo(() => {
    if (pickerKey !== 'locations') return []
    return Array.from(new Set(values.map((value) => value.split(' · ')[0]?.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }))
  }, [pickerKey, values])

  function renderCheckbox(checked: boolean) {
    return <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}</View>
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onDone} hitSlop={8} style={styles.headerIcon}><Ionicons name="arrow-back" size={27} color="#101828" /></Pressable>
        <Text style={styles.headerTitle}>{isPeoplePicker(pickerKey) ? 'Chọn người' : title}</Text>
        <Pressable onPress={onDone} style={styles.headerAction}><Text style={styles.headerActionText}>XONG ({selected.length})</Text></Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={23} color="#667085" />
          <TextInput value={query} onChangeText={setQuery} placeholder={pickerSearchPlaceholder(pickerKey)} placeholderTextColor="#C0C5CC" autoCorrect={false} style={styles.searchInput} />
        </View>
      </View>

      {pickerKey === 'locations' ? (
        <>
          <View style={styles.locationTools}>
            <Pressable onPress={() => setLocationSortOpen(true)} style={styles.sortButton}><Ionicons name="swap-vertical-outline" size={22} color="#101828" /><Text style={styles.sortText}>{LOCATION_SORTS.find((item) => item.key === locationSort)?.label}</Text></Pressable>
          </View>
          {locationRoot ? <View style={styles.breadcrumbRow}><Pressable onPress={() => setLocationRoot('')}><Text style={styles.breadcrumbLink}>Tất cả vị trí</Text></Pressable><Ionicons name="chevron-forward" size={17} color="#98A2B3" /><Text style={styles.breadcrumbCurrent}>{locationRoot}</Text></View> : null}
          {locationRoot === '' && locationRoots.some((root) => values.some((value) => value.startsWith(`${root} · `))) ? (
            <FlatList
              data={locationRoots.filter((root) => !query || normalize(root).includes(normalize(query)))}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const childCount = values.filter((value) => value.startsWith(`${item} · `)).length
                if (!childCount) return <Pressable onPress={() => onToggle(item)} style={styles.simpleRow}><Ionicons name="location-outline" size={24} color="#667085" /><Text style={styles.simpleText}>{item}</Text>{renderCheckbox(selected.includes(item))}</Pressable>
                return <Pressable onPress={() => setLocationRoot(item)} style={styles.simpleRow}><Ionicons name="location-outline" size={24} color="#667085" /><View style={styles.simpleCopy}><Text style={styles.simpleText}>{item}</Text><Text style={styles.simpleSub}>{childCount} vị trí con</Text></View><Ionicons name="chevron-forward" size={22} color="#98A2B3" /></Pressable>
              }}
            />
          ) : (
            <FlatList data={filtered} keyExtractor={(item) => item} renderItem={({ item }) => <Pressable onPress={() => onToggle(item)} style={styles.simpleRow}><Ionicons name="location-outline" size={24} color="#667085" /><Text style={styles.simpleText}>{item}</Text>{renderCheckbox(selected.includes(item))}</Pressable>} ListEmptyComponent={<EmptyPicker text="Chưa có dữ liệu vị trí phù hợp." />} />
          )}
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={pickerKey === 'assignedUsers' ? <Pressable onPress={() => onToggle(NO_ASSIGNEES_FILTER_VALUE)} style={styles.simpleRow}><View style={styles.noAvatar}><Ionicons name="person-remove-outline" size={22} color="#667085" /></View><Text style={styles.simpleText}>Không có người được giao</Text>{renderCheckbox(selected.includes(NO_ASSIGNEES_FILTER_VALUE))}</Pressable> : null}
          renderItem={({ item }) => {
            const checked = selected.includes(item)
            if (isPeoplePicker(pickerKey)) return <Pressable onPress={() => onToggle(item)} style={styles.personRow}><View style={styles.avatar}><Text style={styles.avatarText}>{initials(item)}</Text></View><View style={styles.personCopy}><Text style={styles.personName}>{item}</Text><Text style={styles.personMeta}>Dữ liệu người dùng CMMS</Text></View>{renderCheckbox(checked)}</Pressable>
            if (pickerKey === 'assignedVendors' || pickerKey === 'assignedCustomers') return <Pressable onPress={() => onToggle(item)} style={styles.companyRow}>{renderCheckbox(checked)}<View style={styles.companyCopy}><Text style={styles.companyName}>{item}</Text><Text style={styles.companyMeta}>{pickerKey === 'assignedVendors' ? 'Nhà cung cấp' : 'Khách hàng'} trong CMMS</Text></View></Pressable>
            return <Pressable onPress={() => onToggle(item)} style={styles.simpleRow}><Ionicons name="people-outline" size={24} color="#667085" /><Text style={styles.simpleText}>{item}</Text>{renderCheckbox(checked)}</Pressable>
          }}
          ListEmptyComponent={<EmptyPicker text="Chưa có dữ liệu phù hợp." />}
        />
      )}

      <View style={styles.footer}><Pressable onPress={onDone} style={styles.doneButton}><Text style={styles.doneText}>Xong</Text></Pressable></View>

      <Modal visible={locationSortOpen} transparent animationType="fade" onRequestClose={() => setLocationSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLocationSortOpen(false)}>
          <Pressable style={styles.sortDialog} onPress={() => undefined}>
            <Text style={styles.dialogTitle}>Sắp xếp vị trí</Text>
            {LOCATION_SORTS.map((item) => <Pressable key={item.key} onPress={() => { setLocationSort(item.key); setLocationSortOpen(false) }} style={styles.dialogRow}><Text style={styles.dialogText}>{item.label}</Text>{locationSort === item.key ? <Ionicons name="checkmark" size={23} color="#1570EF" /> : null}</Pressable>)}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

function EmptyPicker({ text }: { text: string }) {
  return <View style={styles.empty}><Ionicons name="filter-outline" size={48} color="#D0D5DD" /><Text style={styles.emptyTitle}>Chưa có dữ liệu</Text><Text style={styles.emptyText}>{text}</Text></View>
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' }, header: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: '#101828' }, headerAction: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 }, headerActionText: { fontSize: 13.5, fontWeight: '800', color: '#344054' }, searchRow: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, searchWrap: { flex: 1, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: '#F9FAFB' }, searchInput: { flex: 1, minHeight: 46, fontSize: 17, color: '#101828' }, locationTools: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' }, sortButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }, sortText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#101828' }, breadcrumbRow: { minHeight: 42, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F9FAFB' }, breadcrumbLink: { fontSize: 13, fontWeight: '800', color: '#1570EF' }, breadcrumbCurrent: { flex: 1, fontSize: 13, color: '#667085' }, simpleRow: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, simpleCopy: { flex: 1 }, simpleText: { flex: 1, fontSize: 16, color: '#101828' }, simpleSub: { marginTop: 3, fontSize: 12.5, color: '#667085' }, checkbox: { width: 22, height: 22, borderRadius: 3, borderWidth: 2, borderColor: '#98A2B3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, checkboxChecked: { borderColor: '#155EEF', backgroundColor: '#155EEF' }, personRow: { minHeight: 74, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' }, avatarText: { fontSize: 14, fontWeight: '900', color: '#155EEF' }, noAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' }, personCopy: { flex: 1 }, personName: { fontSize: 16, fontWeight: '800', color: '#101828' }, personMeta: { marginTop: 3, fontSize: 13, color: '#667085' }, companyRow: { minHeight: 76, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' }, companyCopy: { flex: 1 }, companyName: { fontSize: 17, fontWeight: '800', color: '#101828' }, companyMeta: { marginTop: 4, fontSize: 13, color: '#667085' }, footer: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' }, doneButton: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' }, doneText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' }, empty: { minHeight: 360, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }, emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '900', color: '#475467' }, emptyText: { marginTop: 7, textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#98A2B3' }, backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(16,24,40,0.58)' }, sortDialog: { width: '100%', maxWidth: 440, paddingVertical: 18, borderRadius: 4, backgroundColor: '#FFFFFF' }, dialogTitle: { paddingHorizontal: 24, paddingBottom: 12, fontSize: 21, fontWeight: '900', color: '#101828' }, dialogRow: { minHeight: 62, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dialogText: { fontSize: 16.5, color: '#101828' },
})
