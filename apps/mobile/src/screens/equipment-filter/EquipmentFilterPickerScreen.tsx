import { useMemo, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
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

type LocationSort = 'name-asc' | 'name-desc' | 'address-asc' | 'address-desc' | 'created-asc' | 'created-desc'

type UserRole = 'Administrator' | 'Technician' | 'Technician (Limited)' | 'Requester' | 'View Only'

const LOCATION_SORTS: Array<{ key: LocationSort; label: string; requiresMetadata?: boolean }> = [
  { key: 'name-asc', label: 'Tên vị trí (A–Z)' },
  { key: 'name-desc', label: 'Tên vị trí (Z–A)' },
  { key: 'address-asc', label: 'Địa chỉ vị trí (A–Z)', requiresMetadata: true },
  { key: 'address-desc', label: 'Địa chỉ vị trí (Z–A)', requiresMetadata: true },
  { key: 'created-asc', label: 'Ngày tạo (cũ nhất trước)', requiresMetadata: true },
  { key: 'created-desc', label: 'Ngày tạo (mới nhất trước)', requiresMetadata: true },
]

const USER_ROLES: Array<{ role: UserRole; description: string }> = [
  { role: 'Administrator', description: 'Toàn quyền quản trị hệ thống và người dùng.' },
  { role: 'Technician', description: 'Kỹ thuật viên có quyền xử lý công việc được giao.' },
  { role: 'Technician (Limited)', description: 'Kỹ thuật viên với quyền thao tác giới hạn.' },
  { role: 'Requester', description: 'Người dùng tạo yêu cầu và theo dõi yêu cầu của mình.' },
  { role: 'View Only', description: 'Chỉ xem dữ liệu, không thay đổi nội dung.' },
]

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('vi')
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '—'
}

function inferRole(value: string): UserRole | null {
  const normalized = normalize(value)
  for (const item of USER_ROLES) {
    if (normalized.includes(normalize(item.role))) return item.role
  }
  return null
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

function showLocationActions(name: string) {
  Alert.alert(name, undefined, [
    { text: 'Chỉnh sửa', onPress: () => undefined },
    { text: 'Thêm vị trí con', onPress: () => undefined },
    { text: 'Xóa', style: 'destructive', onPress: () => undefined },
    { text: 'Hủy', style: 'cancel' },
  ])
}

export function EquipmentFilterPickerScreen({ pickerKey, title, values, selected, onToggle, onDone }: Props) {
  const [query, setQuery] = useState('')
  const [locationSort, setLocationSort] = useState<LocationSort>('name-asc')
  const [locationSortOpen, setLocationSortOpen] = useState(false)
  const [locationMapMode, setLocationMapMode] = useState(false)
  const [locationRoot, setLocationRoot] = useState('')
  const [roleFilterOpen, setRoleFilterOpen] = useState(false)
  const [roles, setRoles] = useState<UserRole[]>([])

  const hasRoleMetadata = useMemo(() => values.some((value) => inferRole(value) !== null), [values])

  const filtered = useMemo(() => {
    let next = [...values]
    const needle = normalize(query)
    if (needle) next = next.filter((value) => normalize(value).includes(needle))

    if (isPeoplePicker(pickerKey) && roles.length) {
      next = next.filter((value) => {
        const role = inferRole(value)
        return role ? roles.includes(role) : false
      })
    }

    if (pickerKey === 'locations') {
      if (locationRoot) next = next.filter((value) => value === locationRoot || value.startsWith(`${locationRoot} · `))
      if (locationSort === 'name-desc') next.sort((a, b) => b.localeCompare(a, 'vi', { sensitivity: 'base', numeric: true }))
      else next.sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }))
    }

    return next
  }, [locationRoot, locationSort, pickerKey, query, roles, values])

  const locationRoots = useMemo(() => {
    if (pickerKey !== 'locations') return []
    return Array.from(new Set(values.map((value) => value.split(' · ')[0]?.trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base', numeric: true }))
  }, [pickerKey, values])

  function renderCheckbox(checked: boolean) {
    return <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Ionicons name="checkmark" size={17} color="#FFFFFF" /> : null}</View>
  }

  if (roleFilterOpen) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => setRoleFilterOpen(false)} hitSlop={8} style={styles.headerIcon}><Ionicons name="arrow-back" size={27} color="#101828" /></Pressable>
          <Text style={styles.headerTitle}>Vai trò người dùng</Text>
          <Pressable onPress={() => setRoleFilterOpen(false)} style={styles.headerAction}><Text style={styles.headerActionText}>XONG</Text></Pressable>
        </View>
        {!hasRoleMetadata ? <Text style={styles.metadataNotice}>Dữ liệu Equipment hiện chưa có metadata vai trò. Chọn role sẽ chỉ hiển thị người có role thật trong dữ liệu.</Text> : null}
        <ScrollView>
          {USER_ROLES.map((item) => {
            const checked = roles.includes(item.role)
            return (
              <Pressable key={item.role} onPress={() => setRoles((current) => checked ? current.filter((role) => role !== item.role) : [...current, item.role])} style={styles.roleRow}>
                <View style={styles.roleCopy}>
                  <Text style={styles.roleName}>{item.role}</Text>
                  <Text style={styles.roleDescription}>{item.description}</Text>
                </View>
                {checked ? <Ionicons name="checkmark" size={25} color="#1570EF" /> : null}
              </Pressable>
            )
          })}
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onDone} hitSlop={8} style={styles.headerIcon}><Ionicons name="arrow-back" size={27} color="#101828" /></Pressable>
        <Text style={styles.headerTitle}>{isPeoplePicker(pickerKey) ? 'Chọn người' : title}</Text>
        {isPeoplePicker(pickerKey) ? <Pressable onPress={onDone} style={styles.headerAction}><Text style={styles.headerActionText}>HOÀN THÀNH ({selected.length})</Text></Pressable> : pickerKey === 'locations' ? <Pressable accessibilityLabel="Thêm vị trí" onPress={() => Alert.alert('Thêm vị trí', 'Màn hình thêm vị trí đã sẵn sàng cho dữ liệu thật.', [{ text: 'Đóng' }])} style={styles.headerAction}><Ionicons name="add" size={27} color="#155EEF" /></Pressable> : <View style={styles.headerSpacer} />}
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={23} color="#667085" />
          <TextInput value={query} onChangeText={setQuery} placeholder={pickerSearchPlaceholder(pickerKey)} placeholderTextColor="#C0C5CC" autoCorrect={false} style={styles.searchInput} />
        </View>
        {isPeoplePicker(pickerKey) ? (
          <Pressable onPress={() => setRoleFilterOpen(true)} accessibilityLabel="Lọc theo vai trò" style={[styles.roundAction, roles.length > 0 && styles.roundActionActive]}>
            <Ionicons name="options-outline" size={24} color={roles.length > 0 ? '#FFFFFF' : '#101828'} />
          </Pressable>
        ) : null}
      </View>

      {pickerKey === 'locations' ? (
        <>
          <View style={styles.locationTools}>
            <Pressable onPress={() => setLocationSortOpen(true)} style={styles.sortButton}><Ionicons name="swap-vertical-outline" size={22} color="#101828" /><Text style={styles.sortText}>{LOCATION_SORTS.find((item) => item.key === locationSort)?.label}</Text></Pressable>
            <Pressable onPress={() => setLocationMapMode((current) => !current)} accessibilityLabel="Chuyển chế độ bản đồ" style={styles.mapButton}><Ionicons name="map" size={26} color="#101828" /></Pressable>
          </View>
          {locationRoot ? (
            <View style={styles.breadcrumbRow}><Pressable onPress={() => setLocationRoot('')}><Text style={styles.breadcrumbLink}>Tất cả vị trí</Text></Pressable><Ionicons name="chevron-forward" size={17} color="#98A2B3" /><Text style={styles.breadcrumbCurrent}>{locationRoot}</Text></View>
          ) : null}
          {locationMapMode ? (
            <View style={styles.mapEmpty}><Ionicons name="map-outline" size={52} color="#98A2B3" /><Text style={styles.emptyTitle}>Chưa có tọa độ vị trí</Text><Text style={styles.emptyText}>Map view đã có luồng UI nhưng chỉ bật bản đồ thật khi dữ liệu vị trí có latitude/longitude.</Text></View>
          ) : locationRoot === '' && locationRoots.some((root) => values.some((value) => value.startsWith(`${root} · `))) ? (
            <FlatList
              data={locationRoots.filter((root) => !query || normalize(root).includes(normalize(query)))}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const childCount = values.filter((value) => value.startsWith(`${item} · `)).length
                if (!childCount) {
                  const checked = selected.includes(item)
                  return <Pressable onPress={() => onToggle(item)} style={styles.simpleRow}><Ionicons name="location-outline" size={24} color="#667085" /><Text style={styles.simpleText}>{item}</Text><Pressable accessibilityLabel={`Thao tác ${item}`} onPress={() => showLocationActions(item)} hitSlop={8} style={styles.rowAction}><Ionicons name="ellipsis-vertical" size={20} color="#667085" /></Pressable>{renderCheckbox(checked)}</Pressable>
                }
                return <Pressable onPress={() => setLocationRoot(item)} style={styles.simpleRow}><Ionicons name="location-outline" size={24} color="#667085" /><View style={styles.simpleCopy}><Text style={styles.simpleText}>{item}</Text><Text style={styles.simpleSub}>{childCount} vị trí con</Text></View><Pressable accessibilityLabel={`Thao tác ${item}`} onPress={() => showLocationActions(item)} hitSlop={8} style={styles.rowAction}><Ionicons name="ellipsis-vertical" size={20} color="#667085" /></Pressable><Ionicons name="chevron-forward" size={22} color="#98A2B3" /></Pressable>
              }}
            />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              renderItem={({ item }) => <Pressable onPress={() => onToggle(item)} style={styles.simpleRow}><Ionicons name="location-outline" size={24} color="#667085" /><Text style={styles.simpleText}>{item}</Text><Pressable accessibilityLabel={`Thao tác ${item}`} onPress={() => showLocationActions(item)} hitSlop={8} style={styles.rowAction}><Ionicons name="ellipsis-vertical" size={20} color="#667085" /></Pressable>{renderCheckbox(selected.includes(item))}</Pressable>}
              ListEmptyComponent={<EmptyPicker text="Chưa có dữ liệu vị trí phù hợp." />}
            />
          )}
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={pickerKey === 'assignedUsers' ? (
            <Pressable onPress={() => onToggle(NO_ASSIGNEES_FILTER_VALUE)} style={styles.simpleRow}>
              <View style={styles.noAvatar}><Ionicons name="person-remove-outline" size={22} color="#667085" /></View>
              <Text style={styles.simpleText}>Không có người được giao</Text>
              {renderCheckbox(selected.includes(NO_ASSIGNEES_FILTER_VALUE))}
            </Pressable>
          ) : null}
          renderItem={({ item }) => {
            const checked = selected.includes(item)
            if (isPeoplePicker(pickerKey)) {
              const role = inferRole(item)
              return (
                <Pressable onPress={() => onToggle(item)} style={styles.personRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item)}</Text></View>
                  <View style={styles.personCopy}><Text style={styles.personName}>{item}</Text>{role ? <Text style={styles.personMeta}>{role}</Text> : null}</View>
                  {renderCheckbox(checked)}
                </Pressable>
              )
            }
            if (pickerKey === 'assignedVendors' || pickerKey === 'assignedCustomers') {
              return (
                <Pressable onPress={() => onToggle(item)} style={styles.companyRow}>
                  {renderCheckbox(checked)}
                  <View style={styles.companyCopy}><Text style={styles.companyName}>{item}</Text><Text style={styles.companyMeta}>Chưa có địa chỉ / liên hệ trong dữ liệu Equipment</Text></View>
                </Pressable>
              )
            }
            return <Pressable onPress={() => onToggle(item)} style={styles.simpleRow}><Ionicons name="people-outline" size={24} color="#667085" /><Text style={styles.simpleText}>{item}</Text>{renderCheckbox(checked)}</Pressable>
          }}
          ListEmptyComponent={<EmptyPicker text={roles.length && !hasRoleMetadata ? 'Không có metadata vai trò để khớp bộ lọc này.' : 'Chưa có dữ liệu phù hợp.'} />}
        />
      )}

      <View style={styles.footer}><Pressable onPress={onDone} style={styles.doneButton}><Text style={styles.doneText}>Xong</Text></Pressable></View>

      <Modal visible={locationSortOpen} transparent animationType="fade" onRequestClose={() => setLocationSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLocationSortOpen(false)}>
          <Pressable style={styles.sortDialog} onPress={() => undefined}>
            <Text style={styles.dialogTitle}>Sắp xếp vị trí</Text>
            {LOCATION_SORTS.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => { setLocationSort(item.key); setLocationSortOpen(false) }}
                style={styles.dialogRow}
              >
                <View style={styles.dialogCopy}><Text style={styles.dialogText}>{item.label}</Text>{item.requiresMetadata ? <Text style={styles.dialogHint}>Bản mẫu UI — dùng dữ liệu địa chỉ/ngày tạo khi kết nối server</Text> : null}</View>
                {locationSort === item.key ? <Ionicons name="checkmark" size={23} color="#1570EF" /> : null}
              </Pressable>
            ))}
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
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '900', color: '#101828' },
  headerAction: { minHeight: 44, justifyContent: 'center', paddingLeft: 8 },
  headerActionText: { fontSize: 13.5, fontWeight: '800', color: '#344054' },
  headerSpacer: { width: 44 },
  searchRow: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchWrap: { flex: 1, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: '#F9FAFB' },
  searchInput: { flex: 1, minHeight: 46, fontSize: 17, color: '#101828' },
  roundAction: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  roundActionActive: { backgroundColor: '#155EEF' },
  locationTools: { minHeight: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EAECF0' },
  sortButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#101828' },
  mapButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  breadcrumbRow: { minHeight: 42, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F9FAFB' },
  breadcrumbLink: { fontSize: 13, fontWeight: '800', color: '#1570EF' },
  breadcrumbCurrent: { flex: 1, fontSize: 13, color: '#667085' },
  simpleRow: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  simpleCopy: { flex: 1 },
  simpleText: { flex: 1, fontSize: 16, color: '#101828' },
  simpleSub: { marginTop: 3, fontSize: 12.5, color: '#667085' },
  rowAction: { width: 30, height: 36, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 3, borderWidth: 2, borderColor: '#98A2B3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  checkboxChecked: { borderColor: '#155EEF', backgroundColor: '#155EEF' },
  personRow: { minHeight: 74, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' },
  avatarText: { fontSize: 14, fontWeight: '900', color: '#155EEF' },
  noAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  personCopy: { flex: 1 },
  personName: { fontSize: 16, fontWeight: '800', color: '#101828' },
  personMeta: { marginTop: 3, fontSize: 13, color: '#667085' },
  companyRow: { minHeight: 88, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  companyCopy: { flex: 1 },
  companyName: { fontSize: 17, fontWeight: '800', color: '#101828' },
  companyMeta: { marginTop: 6, fontSize: 13, lineHeight: 18, color: '#98A2B3' },
  roleRow: { minHeight: 76, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  roleCopy: { flex: 1 },
  roleName: { fontSize: 17, fontWeight: '800', color: '#101828' },
  roleDescription: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: '#667085' },
  metadataNotice: { paddingHorizontal: 18, paddingVertical: 10, fontSize: 12.5, lineHeight: 18, color: '#7A2E0E', backgroundColor: '#FFF6ED' },
  footer: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0' },
  doneButton: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  doneText: { fontSize: 17, fontWeight: '900', color: '#FFFFFF' },
  empty: { minHeight: 360, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyTitle: { marginTop: 14, fontSize: 18, fontWeight: '900', color: '#475467' },
  emptyText: { marginTop: 7, textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#98A2B3' },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(16,24,40,0.58)' },
  sortDialog: { width: '100%', maxWidth: 440, paddingVertical: 18, borderRadius: 4, backgroundColor: '#FFFFFF' },
  dialogTitle: { paddingHorizontal: 24, paddingBottom: 12, fontSize: 21, fontWeight: '900', color: '#101828' },
  dialogRow: { minHeight: 62, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center' },
  dialogRowDisabled: { opacity: 0.45 },
  dialogCopy: { flex: 1 },
  dialogText: { fontSize: 16.5, color: '#101828' },
  dialogHint: { marginTop: 2, fontSize: 11.5, color: '#667085' },
})
