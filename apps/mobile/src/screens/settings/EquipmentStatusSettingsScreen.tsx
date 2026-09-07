import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { SettingsScaffold } from './SettingsScaffold'
import {
  createEquipmentStatus,
  deleteEquipmentStatusMaster,
  listEquipmentStatuses,
  updateEquipmentStatusMaster,
  type EquipmentStatusMaster,
} from '../../services/equipmentStatusService'

const COLORS = ['#12B76A', '#D92D20', '#F79009', '#667085', '#155EEF', '#7F56D9', '#06AED4', '#EE46BC']

export function EquipmentStatusSettingsScreen({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<EquipmentStatusMaster[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentStatusMaster | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await listEquipmentStatuses())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không tải được trạng thái thiết bị.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function openCreate() {
    setEditing(null)
    setName('')
    setColor(COLORS[0])
    setEditorOpen(true)
  }

  function openEdit(item: EquipmentStatusMaster) {
    if (item.locked) return
    setEditing(item)
    setName(item.displayName)
    setColor(item.color)
    setEditorOpen(true)
  }

  async function save() {
    if (saving || !name.trim()) return
    setSaving(true)
    try {
      if (editing) await updateEquipmentStatusMaster(editing.statusCode, name, color)
      else await createEquipmentStatus(name, color)
      setEditorOpen(false)
      await load()
    } catch (reason) {
      Alert.alert('Không lưu được', reason instanceof Error ? reason.message : 'Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  function remove(item: EquipmentStatusMaster) {
    if (item.locked) return
    Alert.alert('Xóa trạng thái', `Xóa “${item.displayName}”?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void deleteEquipmentStatusMaster(item.statusCode)
            .then(load)
            .catch((reason) => Alert.alert('Không xóa được', reason instanceof Error ? reason.message : 'Vui lòng thử lại.'))
        },
      },
    ])
  }

  return (
    <SettingsScaffold title="Trạng thái thiết bị" onBack={onBack}>
      <Text style={styles.note}>Trạng thái đang được thiết bị sử dụng sẽ khóa sửa/xóa. Trạng thái chưa liên kết có thể đổi tên, đổi màu hoặc xóa.</Text>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? items.map((item) => (
        <View key={item.statusCode} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <View style={styles.copy}>
            <Text style={styles.name}>{item.displayName}</Text>
            <Text style={styles.meta}>{item.usageCount} thiết bị · {item.statusCode}</Text>
          </View>
          {item.locked ? (
            <View style={styles.locked}><Ionicons name="lock-closed-outline" size={18} color="#98A2B3" /></View>
          ) : (
            <View style={styles.actions}>
              <Pressable onPress={() => openEdit(item)} hitSlop={8}><Ionicons name="create-outline" size={21} color="#475467" /></Pressable>
              <Pressable onPress={() => remove(item)} hitSlop={8}><Ionicons name="trash-outline" size={21} color="#B42318" /></Pressable>
            </View>
          )}
        </View>
      )) : null}

      <Pressable accessibilityRole="button" accessibilityLabel="Thêm trạng thái mới" onPress={openCreate} style={styles.fab}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </Pressable>

      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => setEditorOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditorOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => undefined}>
            <Text style={styles.dialogTitle}>{editing ? 'Sửa trạng thái' : 'Thêm trạng thái mới'}</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Nhập tên" placeholderTextColor="#98A2B3" style={styles.input} />
            <Text style={styles.colorLabel}>Màu trạng thái</Text>
            <View style={styles.colors}>
              {COLORS.map((value) => (
                <Pressable key={value} onPress={() => setColor(value)} style={[styles.colorChoice, { backgroundColor: value }, color === value && styles.colorSelected]}>
                  {color === value ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
                </Pressable>
              ))}
            </View>
            <View style={styles.dialogActions}>
              <Pressable onPress={() => setEditorOpen(false)} style={styles.dialogButton}><Text style={styles.cancel}>HỦY</Text></Pressable>
              <Pressable onPress={() => { void save() }} disabled={saving || !name.trim()} style={styles.dialogButton}>
                {saving ? <ActivityIndicator size="small" color="#155EEF" /> : <Text style={styles.save}>LƯU</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  note: { padding: 16, fontSize: 12.5, lineHeight: 18, color: '#667085', backgroundColor: '#F8F9FB' },
  center: { paddingVertical: 36, alignItems: 'center' },
  error: { padding: 16, color: '#B42318' },
  row: { minHeight: 76, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  dot: { width: 13, height: 13, borderRadius: 7, marginRight: 15 },
  copy: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800', color: '#101828' },
  meta: { marginTop: 3, fontSize: 11.5, color: '#98A2B3' },
  locked: { width: 40, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: 18 },
  fab: { position: 'absolute', right: 20, bottom: 22, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF', elevation: 5 },
  backdrop: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(16,24,40,0.45)' },
  dialog: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  dialogTitle: { fontSize: 20, fontWeight: '900', color: '#101828' },
  input: { minHeight: 48, marginTop: 20, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: '#155EEF', fontSize: 16, color: '#101828' },
  colorLabel: { marginTop: 18, fontSize: 12, fontWeight: '800', color: '#667085' },
  colors: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorChoice: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  colorSelected: { borderWidth: 3, borderColor: '#101828' },
  dialogActions: { marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  dialogButton: { minWidth: 64, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  cancel: { fontSize: 14, fontWeight: '900', color: '#475467' },
  save: { fontSize: 14, fontWeight: '900', color: '#155EEF' },
})
