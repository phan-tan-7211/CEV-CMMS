import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import type { HomeScanResult } from '../api/scanResolver'

type Props = {
  loading: boolean
  result: HomeScanResult | null
  onDismiss: () => void
  onRescan: () => void
  onOpenAsset: (equipmentId: string) => void
  onSelectMultiple: (type: 'asset' | 'part', id: string) => void
}

function ActionRow({
  icon,
  label,
  detail,
  disabled = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  detail?: string
  disabled?: boolean
  onPress?: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, disabled && styles.actionDisabled, pressed && !disabled && styles.pressed]}
    >
      <View style={styles.actionIcon}><Ionicons name={icon} size={21} color={disabled ? '#98A2B3' : '#344054'} /></View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, disabled && styles.actionLabelDisabled]}>{label}</Text>
        {detail ? <Text style={styles.actionDetail}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={21} color={disabled ? '#D0D5DD' : '#98A2B3'} />
    </Pressable>
  )
}

export function HomeScanResultSheet({ loading, result, onDismiss, onRescan, onOpenAsset, onSelectMultiple }: Props) {
  if (!loading && !result) return null

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={loading ? undefined : onDismiss} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#155EEF" />
            <Text style={styles.title}>Đang tra cứu mã...</Text>
            <Text style={styles.body}>CEV CMMS đang kiểm tra mã trên hệ thống.</Text>
          </View>
        ) : result?.type === 'not-found' ? (
          <>
            <View style={styles.centerState}>
              <View style={[styles.stateIcon, styles.warningIcon]}><Ionicons name="search-outline" size={26} color="#B54708" /></View>
              <Text style={styles.title}>Không tìm thấy kết quả</Text>
              <Text style={styles.body}>Không có dữ liệu phù hợp với mã “{result.code}”.</Text>
            </View>
            <Pressable onPress={onRescan} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Quét lại</Text></Pressable>
          </>
        ) : result?.type === 'asset' ? (
          <>
            <View style={styles.resultHeading}>
              <View style={styles.stateIcon}><Ionicons name="cube-outline" size={24} color="#155EEF" /></View>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>Thiết bị</Text>
                <Text style={styles.resultName}>{result.asset.equipmentName || result.asset.equipmentId}</Text>
                <Text style={styles.resultCode}>{result.asset.equipmentId}</Text>
              </View>
            </View>

            <View style={styles.actionGroup}>
              <ActionRow icon="information-circle-outline" label="Chi tiết thiết bị" onPress={() => onOpenAsset(result.asset.equipmentId)} />
              <ActionRow icon="git-network-outline" label="Phân cấp thiết bị" detail="Sẽ nối ở phase Asset actions" disabled />
              <ActionRow icon="time-outline" label="Work Order đang chờ" detail="Sẽ nối theo dữ liệu Work Order" disabled />
              <ActionRow icon="chatbox-ellipses-outline" label="Yêu cầu đang chờ" detail="Sẽ nối theo Request backend" disabled />
              <ActionRow icon="checkmark-done-outline" label="Work Order đã hoàn thành" detail="Sẽ nối tối đa 5 kết quả gần nhất" disabled />
            </View>
            <Pressable onPress={onRescan} style={styles.secondaryButton}><Text style={styles.secondaryText}>Quét mã khác</Text></Pressable>
          </>
        ) : result?.type === 'multiple' ? (
          <>
            <View style={styles.resultHeading}>
              <View style={styles.stateIcon}><Ionicons name="layers-outline" size={24} color="#155EEF" /></View>
              <View style={styles.headingCopy}>
                <Text style={styles.eyebrow}>Nhiều kết quả</Text>
                <Text style={styles.resultName}>Chọn kết quả cần mở</Text>
                <Text style={styles.resultCode}>{result.items.length} kết quả cho “{result.code}”</Text>
              </View>
            </View>
            <FlatList
              data={result.items}
              keyExtractor={(item, index) => `${item.type}:${item.id}:${index}`}
              style={styles.multiList}
              renderItem={({ item }) => (
                <Pressable onPress={() => onSelectMultiple(item.type, item.id)} style={({ pressed }) => [styles.multiRow, pressed && styles.pressed]}>
                  <View style={styles.multiIcon}><Ionicons name={item.type === 'asset' ? 'cube-outline' : 'cube'} size={21} color="#475467" /></View>
                  <View style={styles.multiCopy}><Text style={styles.multiType}>{item.type === 'asset' ? 'Thiết bị' : 'Phụ tùng'}</Text><Text style={styles.multiLabel}>{item.label || item.id}</Text></View>
                  <Ionicons name="chevron-forward" size={21} color="#98A2B3" />
                </Pressable>
              )}
            />
            <Pressable onPress={onRescan} style={styles.secondaryButton}><Text style={styles.secondaryText}>Quét mã khác</Text></Pressable>
          </>
        ) : result?.type === 'part' ? (
          <>
            <View style={styles.resultHeading}>
              <View style={styles.stateIcon}><Ionicons name="cube" size={24} color="#155EEF" /></View>
              <View style={styles.headingCopy}><Text style={styles.eyebrow}>Phụ tùng</Text><Text style={styles.resultName}>{result.label || result.partId}</Text><Text style={styles.resultCode}>{result.partId}</Text></View>
            </View>
            <View style={styles.actionGroup}>
              <ActionRow icon="add-circle-outline" label="Tạo Work Order" detail="Chờ Part/WO server contract" disabled />
              <ActionRow icon="eye-outline" label="Xem phụ tùng" detail="Chờ Part Detail native" disabled />
              <ActionRow icon="layers-outline" label="Tồn kho" detail="Chờ Inventory contract" disabled />
            </View>
            <Pressable onPress={onRescan} style={styles.secondaryButton}><Text style={styles.secondaryText}>Quét mã khác</Text></Pressable>
          </>
        ) : result?.type === 'request-portal' ? (
          <>
            <View style={styles.centerState}>
              <View style={styles.stateIcon}><Ionicons name="globe-outline" size={26} color="#155EEF" /></View>
              <Text style={styles.title}>Request Portal</Text>
              <Text style={styles.body}>Kết quả đã được định tuyến vào Request Portal. Các nút Tạo Work Order / Tạo yêu cầu sẽ bật khi có RequestPortalSettings thật.</Text>
            </View>
            <Pressable onPress={onRescan} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>Quét lại</Text></Pressable>
          </>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 50, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.48)' },
  sheet: { maxHeight: '82%', paddingHorizontal: 18, paddingTop: 9, paddingBottom: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF' },
  grabber: { alignSelf: 'center', width: 42, height: 5, marginBottom: 15, borderRadius: 3, backgroundColor: '#D0D5DD' },
  centerState: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 14 },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF4FF' },
  warningIcon: { backgroundColor: '#FFFAEB' },
  title: { marginTop: 10, fontSize: 20, lineHeight: 25, fontWeight: '900', color: '#101828', textAlign: 'center' },
  body: { marginTop: 7, fontSize: 14, lineHeight: 20, color: '#667085', textAlign: 'center' },
  resultHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 11.5, fontWeight: '900', color: '#155EEF', textTransform: 'uppercase' },
  resultName: { marginTop: 3, fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#101828' },
  resultCode: { marginTop: 2, fontSize: 12.5, lineHeight: 17, color: '#667085' },
  actionGroup: { overflow: 'hidden', borderWidth: 1, borderColor: '#EAECF0', borderRadius: 14 },
  actionRow: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  actionDisabled: { backgroundColor: '#F9FAFB' },
  actionIcon: { width: 32, alignItems: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { fontSize: 14.5, fontWeight: '800', color: '#344054' },
  actionLabelDisabled: { color: '#98A2B3' },
  actionDetail: { marginTop: 2, fontSize: 10.5, lineHeight: 14, color: '#98A2B3' },
  primaryButton: { minHeight: 52, marginTop: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  primaryText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 14.5, fontWeight: '800', color: '#475467' },
  multiList: { maxHeight: 340, borderWidth: 1, borderColor: '#EAECF0', borderRadius: 14 },
  multiRow: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  multiIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  multiCopy: { flex: 1, minWidth: 0 },
  multiType: { fontSize: 10.5, fontWeight: '900', color: '#667085', textTransform: 'uppercase' },
  multiLabel: { marginTop: 2, fontSize: 14.5, fontWeight: '800', color: '#344054' },
  pressed: { opacity: 0.76 },
})
