import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { ModulePreviewScreen } from './ModulePreviewScreen'

export function VendorsScreen({ onBack, onAddVendor, onAddCustomer }: { onBack: () => void; onAddVendor: () => void; onAddCustomer: () => void }) {
  const [chooserVisible, setChooserVisible] = useState(false)
  const choose = (action: () => void) => { setChooserVisible(false); action() }
  return <>
    <ModulePreviewScreen title="Nhà cung cấp & Khách hàng" hint="Tìm công ty..." onBack={onBack} onAdd={() => setChooserVisible(true)} items={[{title:'Korea YooChang',subtitle:'Nhà cung cấp • Chưa có địa chỉ',icon:'business-outline',color:'#F79009'},{title:'Core Electronics',subtitle:'Khách hàng • Chưa có số điện thoại',icon:'people-outline',color:'#2E90FA'},{title:'Nhà cung cấp mới',subtitle:'Nhà cung cấp • Đang hoạt động',icon:'business-outline',color:'#12B76A'}]} />
    <Modal visible={chooserVisible} transparent animationType="slide" onRequestClose={() => setChooserVisible(false)}>
      <Pressable style={styles.overlay} onPress={() => setChooserVisible(false)}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Thêm mới</Text>
          <Text style={styles.sheetHint}>Chọn loại thông tin cần tạo</Text>
          <Pressable style={styles.option} onPress={() => choose(onAddVendor)}><Text style={styles.optionTitle}>Nhà cung cấp</Text><Text style={styles.optionHint}>Thông tin doanh nghiệp cung ứng</Text></Pressable>
          <Pressable style={styles.option} onPress={() => choose(onAddCustomer)}><Text style={styles.optionTitle}>Khách hàng</Text><Text style={styles.optionHint}>Thông tin doanh nghiệp/đơn vị nhận dịch vụ</Text></Pressable>
          <Pressable style={styles.cancel} onPress={() => setChooserVisible(false)}><Text style={styles.cancelText}>Hủy</Text></Pressable>
        </View>
      </Pressable>
    </Modal>
  </>
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.28)' },
  sheet: { padding: 20, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFF' },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#101828' },
  sheetHint: { marginTop: 5, marginBottom: 14, fontSize: 13, color: '#667085' },
  option: { padding: 15, marginTop: 10, borderRadius: 15, backgroundColor: '#F1F1FA' },
  optionTitle: { fontSize: 15, fontWeight: '900', color: '#1D2939' },
  optionHint: { marginTop: 4, fontSize: 12.5, color: '#667085' },
  cancel: { alignItems: 'center', padding: 14, marginTop: 8 },
  cancelText: { fontSize: 15, fontWeight: '800', color: '#155EEF' },
})
