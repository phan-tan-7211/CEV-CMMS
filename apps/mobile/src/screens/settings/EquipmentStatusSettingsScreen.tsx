import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import {
  createEquipmentStatus,
  deleteEquipmentStatusMaster,
  listEquipmentStatuses,
  updateEquipmentStatusMaster,
  type EquipmentStatusMaster,
} from '../../features/equipment'
import { SettingsScaffold } from './SettingsScaffold'

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
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EquipmentStatusMaster | null>(null)

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
    setError('')
    try {
      if (editing) await updateEquipmentStatusMaster(editing.statusCode, name, color)
      else await createEquipmentStatus(name, color)
      setEditorOpen(false)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không lưu được trạng thái thiết bị.')
    } finally {
      setSaving(false)
    }
  }

  function requestDelete(item: EquipmentStatusMaster) {
    if (item.locked || deleting) return
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setError('')
    try {
      await deleteEquipmentStatusMaster(deleteTarget.statusCode)
      setDeleteTarget(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không xóa được trạng thái thiết bị.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SettingsScaffold title="Trạng thái thiết bị" onBack={onBack} scroll={false}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.note}>Trạng thái đang được thiết bị sử dụng sẽ khóa sửa/xóa. Trạng thái chưa liên kết có thể đổi tên, đổi màu hoặc xóa.</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={19} color="#B42318" />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.center}><ActivityIndicator size="large" color="#155EEF" /></View>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.statusColumn]}>Trạng thái</Text>
                <Text style={[styles.tableHeaderText, styles.usageColumn]}>Sử dụng</Text>
                <Text style={[styles.tableHeaderText, styles.actionColumn]}>Thao tác</Text>
              </View>

              {items.map((item, index) => (
                <View key={item.statusCode} style={[styles.row, index === items.length - 1 && styles.rowLast]}>
                  <View style={styles.statusCell}>
                    <View style={[styles.dot, { backgroundColor: item.color }]} />
                    <View style={styles.copy}>
                      <Text style={styles.name}>{item.displayName}</Text>
                      <Text style={styles.meta}>{item.statusCode}</Text>
                    </View>
                  </View>

                  <View style={styles.usageCell}>
                    <Text style={styles.usageCount}>{item.usageCount}</Text>
                    <Text style={styles.usageLabel}>thiết bị</Text>
                  </View>

                  <View style={styles.actionCell}>
                    {item.locked ? (
                      <View style={styles.lockedAction} accessibilityLabel={`${item.displayName} đang được sử dụng, không thể sửa hoặc xóa`}>
                        <Ionicons name="lock-closed-outline" size={19} color="#98A2B3" />
                      </View>
                    ) : (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Sửa ${item.displayName}`}
                          onPress={() => openEdit(item)}
                          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                        >
                          <Ionicons name="create-outline" size={21} color="#475467" />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Xóa ${item.displayName}`}
                          onPress={() => requestDelete(item)}
                          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                        >
                          <Ionicons name="trash-outline" size={21} color="#B42318" />
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thêm trạng thái mới"
          onPress={openCreate}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={34} color="#FFFFFF" />
        </Pressable>
      </View>

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

      <Modal visible={Boolean(deleteTarget)} transparent animationType="fade" onRequestClose={() => { if (!deleting) setDeleteTarget(null) }}>
        <Pressable style={styles.backdrop} onPress={() => { if (!deleting) setDeleteTarget(null) }}>
          <Pressable style={styles.deleteDialog} onPress={() => undefined}>
            <View style={styles.deleteIconWrap}><Ionicons name="trash-outline" size={24} color="#B42318" /></View>
            <Text style={styles.dialogTitle}>Xóa trạng thái?</Text>
            <Text style={styles.deleteMessage}>Trạng thái “{deleteTarget?.displayName || ''}” sẽ bị xóa khỏi bảng trạng thái thiết bị.</Text>
            <View style={styles.deleteActions}>
              <Pressable disabled={deleting} onPress={() => setDeleteTarget(null)} style={[styles.cancelDeleteButton, deleting && styles.disabledButton]}>
                <Text style={styles.cancelDeleteText}>Hủy</Text>
              </Pressable>
              <Pressable disabled={deleting} onPress={() => { void confirmDelete() }} style={[styles.confirmDeleteButton, deleting && styles.disabledButton]}>
                {deleting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="trash-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.confirmDeleteText}>{deleting ? 'Đang xóa...' : 'Xóa'}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SettingsScaffold>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: 'relative', backgroundColor: '#F8F9FB' },
  scroll: { flex: 1, backgroundColor: '#F8F9FB' },
  content: { paddingBottom: 118 },
  note: { padding: 16, fontSize: 12.5, lineHeight: 18, color: '#667085', backgroundColor: '#F8F9FB' },
  center: { paddingVertical: 36, alignItems: 'center' },
  errorBox: { marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FECDCA', flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FEF3F2' },
  error: { flex: 1, fontSize: 12, lineHeight: 17, color: '#B42318' },
  table: { marginHorizontal: 12, overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: '#E4E7EC', backgroundColor: '#FFFFFF' },
  tableHeader: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EAECF0', backgroundColor: '#F9FAFB' },
  tableHeaderText: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', color: '#667085' },
  statusColumn: { flex: 1 },
  usageColumn: { width: 64, textAlign: 'center' },
  actionColumn: { width: 96, textAlign: 'center' },
  row: { minHeight: 76, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  rowLast: { borderBottomWidth: 0 },
  statusCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10, flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '800', color: '#101828' },
  meta: { marginTop: 3, fontSize: 10.5, color: '#98A2B3' },
  usageCell: { width: 64, alignItems: 'center', justifyContent: 'center' },
  usageCount: { fontSize: 14, fontWeight: '900', color: '#344054' },
  usageLabel: { marginTop: 2, fontSize: 9.5, color: '#98A2B3' },
  actionCell: { width: 96, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'flex-end' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  lockedAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 22, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF', elevation: 6, shadowColor: '#101828', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  pressed: { opacity: 0.62 },
  backdrop: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: 'rgba(16,24,40,0.45)' },
  dialog: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  deleteDialog: { padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF' },
  deleteIconWrap: { width: 48, height: 48, marginBottom: 14, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3F2' },
  dialogTitle: { fontSize: 20, fontWeight: '900', color: '#101828' },
  deleteMessage: { marginTop: 8, fontSize: 13, lineHeight: 19, color: '#667085' },
  input: { minHeight: 48, marginTop: 20, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: '#155EEF', fontSize: 16, color: '#101828' },
  colorLabel: { marginTop: 18, fontSize: 12, fontWeight: '800', color: '#667085' },
  colors: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorChoice: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  colorSelected: { borderWidth: 3, borderColor: '#101828' },
  dialogActions: { marginTop: 24, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  dialogButton: { minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  cancel: { fontSize: 14, fontWeight: '900', color: '#475467' },
  save: { fontSize: 14, fontWeight: '900', color: '#155EEF' },
  deleteActions: { marginTop: 22, flexDirection: 'row', gap: 10 },
  cancelDeleteButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  cancelDeleteText: { fontSize: 14, fontWeight: '800', color: '#344054' },
  confirmDeleteButton: { flex: 1, minHeight: 46, borderRadius: 12, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20' },
  confirmDeleteText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  disabledButton: { opacity: 0.55 },
})