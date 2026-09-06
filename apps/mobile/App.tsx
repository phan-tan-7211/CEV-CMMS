import { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

type EquipmentType = 'PRODUCTION' | 'MEASUREMENT'
type EquipmentStatus = 'RUNNING' | 'STOPPED' | 'MAINTENANCE' | 'DOWN'
type YesNo = '' | 'YES' | 'NO'

type EquipmentDraft = {
  equipmentType: EquipmentType
  equipmentName: string
  equipmentCategory: string
  manufacturer: string
  distributor: string
  model: string
  serialNumber: string
  managingDepartment: string
  currentArea: string
  currentLine: string
  managementResponsiblePrimary: string
  managementResponsibleSecondary: string
  technicalSpecification: string
  description: string
  origin: string
  inServiceDate: string
  warrantyUntil: string
  warrantyContact: string
  note: string
  status: EquipmentStatus
  controlsProductQuality: YesNo
  specialCharacteristicImpact: YesNo
  stopsProduction: YesNo
  hasBackup: YesNo
  capacityImpact: YesNo
}

const INITIAL: EquipmentDraft = {
  equipmentType: 'PRODUCTION',
  equipmentName: '',
  equipmentCategory: '',
  manufacturer: '',
  distributor: '',
  model: '',
  serialNumber: '',
  managingDepartment: '',
  currentArea: '',
  currentLine: '',
  managementResponsiblePrimary: '',
  managementResponsibleSecondary: '',
  technicalSpecification: '',
  description: '',
  origin: '',
  inServiceDate: '',
  warrantyUntil: '',
  warrantyContact: '',
  note: '',
  status: 'RUNNING',
  controlsProductQuality: '',
  specialCharacteristicImpact: '',
  stopsProduction: '',
  hasBackup: '',
  capacityImpact: '',
}

const STEPS = [
  { title: 'Nhận diện', subtitle: 'Thông tin máy và ảnh nhận biết' },
  { title: 'Vị trí & quản lý', subtitle: 'Nơi sử dụng và người chịu trách nhiệm' },
  { title: 'Đánh giá', subtitle: 'Mức độ quan trọng trước khi lưu' },
] as const

const STATUS_OPTIONS: Array<{ value: EquipmentStatus; label: string }> = [
  { value: 'RUNNING', label: 'Hoạt động' },
  { value: 'STOPPED', label: 'Dừng' },
  { value: 'MAINTENANCE', label: 'Bảo trì' },
  { value: 'DOWN', label: 'Sự cố' },
]

function RequiredMark() {
  return <Text style={styles.required}> *</Text>
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline,
  helper,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  required?: boolean
  multiline?: boolean
  helper?: string
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}{required ? <RequiredMark /> : null}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.multilineInput]}
      />
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  )
}

function SegmentedChoice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function YesNoRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string
  description: string
  value: YesNo
  onChange: (value: YesNo) => void
}) {
  return (
    <View style={styles.yesNoRow}>
      <View style={styles.yesNoCopy}>
        <Text style={styles.yesNoTitle}>{title}<RequiredMark /></Text>
        <Text style={styles.yesNoDescription}>{description}</Text>
      </View>
      <View style={styles.yesNoButtons}>
        {(['NO', 'YES'] as const).map((answer) => {
          const active = value === answer
          return (
            <Pressable
              key={answer}
              onPress={() => onChange(answer)}
              style={[styles.answerButton, active && (answer === 'YES' ? styles.answerYes : styles.answerNo)]}
            >
              <Text style={[styles.answerText, active && styles.answerTextActive]}>{answer === 'YES' ? 'Có' : 'Không'}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  )
}

function RegistrationScreen() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<EquipmentDraft>(INITIAL)
  const [photoSelected, setPhotoSelected] = useState(false)
  const current = STEPS[step]

  const codePreview = form.equipmentType === 'PRODUCTION' ? 'CEV-PR-xxx' : 'CEV-ME-xxx'

  const missing = useMemo(() => {
    const items: string[] = []
    if (!form.equipmentName.trim()) items.push('Tên thiết bị')
    if (!form.managementResponsiblePrimary.trim()) items.push('Người quản lý chính')
    if (!form.controlsProductQuality) items.push('Kiểm soát chất lượng')
    if (!form.specialCharacteristicImpact) items.push('Đặc tính đặc biệt')
    if (!form.stopsProduction) items.push('Rủi ro dừng công đoạn')
    if (!form.hasBackup) items.push('Phương án dự phòng')
    if (!form.capacityImpact) items.push('Rủi ro sản lượng')
    return items
  }, [form])

  const stepValid = step === 0
    ? Boolean(form.equipmentName.trim())
    : step === 1
      ? Boolean(form.managementResponsiblePrimary.trim())
      : missing.length === 0

  function patch<K extends keyof EquipmentDraft>(key: K, value: EquipmentDraft[K]) {
    setForm((currentForm) => ({ ...currentForm, [key]: value }))
  }

  function submitUi() {
    Alert.alert(
      'UI đăng ký đã hoàn tất',
      `Sẵn sàng nối Supabase/RPC. Mã dự kiến: ${codePreview}.`,
      [{ text: 'OK' }],
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => step > 0 ? setStep(step - 1) : Alert.alert('Thêm thiết bị', 'Đây là màn UI native đầu tiên của CEV CMMS.')}
            style={styles.backButton}
          >
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>Thêm thiết bị</Text>
            <Text style={styles.topSubtitle}>Bước {step + 1}/3 · {current.title}</Text>
          </View>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step + 1}/3</Text></View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader eyebrow={`BƯỚC ${step + 1}`} title={current.title} description={current.subtitle} />

          {step === 0 ? (
            <>
              <View style={styles.codeBanner}>
                <View>
                  <Text style={styles.codeLabel}>MÃ THIẾT BỊ</Text>
                  <Text style={styles.codeValue}>{codePreview}</Text>
                </View>
                <Text style={styles.codeHint}>Tự sinh sau khi lưu</Text>
              </View>

              <Text style={styles.label}>Loại thiết bị<RequiredMark /></Text>
              <SegmentedChoice
                value={form.equipmentType}
                options={[
                  { value: 'PRODUCTION', label: 'Sản xuất · PR' },
                  { value: 'MEASUREMENT', label: 'Đo / kiểm · ME' },
                ]}
                onChange={(value) => patch('equipmentType', value)}
              />

              <Field
                label="Tên thiết bị"
                required
                value={form.equipmentName}
                onChangeText={(value) => patch('equipmentName', value)}
                placeholder="Ví dụ: WPC Auto Soldering Machine"
                helper="Ưu tiên dùng tên chuẩn đã có trong Equipment Master."
              />
              <View style={styles.twoColumns}>
                <View style={styles.half}><Field label="Nhóm thiết bị" value={form.equipmentCategory} onChangeText={(value) => patch('equipmentCategory', value)} placeholder="Auto line" /></View>
                <View style={styles.half}><Field label="Model" value={form.model} onChangeText={(value) => patch('model', value)} placeholder="Model" /></View>
              </View>
              <Field label="Hãng / nhà sản xuất" value={form.manufacturer} onChangeText={(value) => patch('manufacturer', value)} placeholder="Tên hãng" />
              <Field label="Nhà phân phối" value={form.distributor} onChangeText={(value) => patch('distributor', value)} placeholder="Nếu có" />
              <Field label="Số sê-ri" value={form.serialNumber} onChangeText={(value) => patch('serialNumber', value)} placeholder="Serial number" />

              <View style={styles.photoBlock}>
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoIcon}>{photoSelected ? '✓' : '▣'}</Text>
                  <Text style={styles.photoTitle}>{photoSelected ? 'Đã chọn ảnh thiết bị' : 'Ảnh nhận diện thiết bị'}</Text>
                  <Text style={styles.photoDescription}>Chụp toàn cảnh, bảng tên máy hoặc vị trí lắp đặt.</Text>
                </View>
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoButtonPrimary} onPress={() => setPhotoSelected(true)}><Text style={styles.photoButtonPrimaryText}>Chụp ảnh</Text></Pressable>
                  <Pressable style={styles.photoButton} onPress={() => setPhotoSelected(true)}><Text style={styles.photoButtonText}>Thư viện</Text></Pressable>
                </View>
              </View>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Field label="Bộ phận quản lý" value={form.managingDepartment} onChangeText={(value) => patch('managingDepartment', value)} placeholder="Ví dụ: BP - Kỹ thuật" />
              <View style={styles.twoColumns}>
                <View style={styles.half}><Field label="Khu vực" value={form.currentArea} onChangeText={(value) => patch('currentArea', value)} placeholder="Area" /></View>
                <View style={styles.half}><Field label="Line / công đoạn" value={form.currentLine} onChangeText={(value) => patch('currentLine', value)} placeholder="Line" /></View>
              </View>
              <Field
                label="Người quản lý chính"
                required
                value={form.managementResponsiblePrimary}
                onChangeText={(value) => patch('managementResponsiblePrimary', value)}
                placeholder="Người chịu trách nhiệm gần nhất"
                helper="Một thiết bị có 1 người quản lý chính. Không dùng operator làm người quản lý."
              />
              <Field label="Người quản lý phụ" value={form.managementResponsibleSecondary} onChangeText={(value) => patch('managementResponsibleSecondary', value)} placeholder="Không bắt buộc" />

              <View style={styles.divider} />
              <Field label="Thông số kỹ thuật" value={form.technicalSpecification} onChangeText={(value) => patch('technicalSpecification', value)} placeholder="Công suất, điện áp, phạm vi..." multiline />
              <Field label="Mô tả" value={form.description} onChangeText={(value) => patch('description', value)} placeholder="Mô tả ngắn về chức năng thiết bị" multiline />
              <Field label="Xuất xứ" value={form.origin} onChangeText={(value) => patch('origin', value)} placeholder="Korea / Japan / Vietnam..." />
              <View style={styles.twoColumns}>
                <View style={styles.half}><Field label="Ngày đưa vào dùng" value={form.inServiceDate} onChangeText={(value) => patch('inServiceDate', value)} placeholder="YYYY-MM-DD" /></View>
                <View style={styles.half}><Field label="Hết bảo hành" value={form.warrantyUntil} onChangeText={(value) => patch('warrantyUntil', value)} placeholder="YYYY-MM-DD" /></View>
              </View>
              <Field label="Liên hệ bảo hành" value={form.warrantyContact} onChangeText={(value) => patch('warrantyContact', value)} placeholder="Tên / điện thoại / email" />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <View style={styles.assessmentIntro}>
                <Text style={styles.assessmentTitle}>Đánh giá mức độ quan trọng</Text>
                <Text style={styles.assessmentText}>5 câu hỏi này đang là dữ liệu bắt buộc của CEV. Cấp criticality sẽ do business rule hiện có tính tự động khi nối backend.</Text>
              </View>

              <YesNoRow title="Kiểm soát đặc tính chất lượng?" description="Thiết bị trực tiếp kiểm soát hoặc tạo ra đặc tính chất lượng của sản phẩm." value={form.controlsProductQuality} onChange={(value) => patch('controlsProductQuality', value)} />
              <YesNoRow title="Ảnh hưởng đặc tính đặc biệt / an toàn?" description="Có ảnh hưởng tới special characteristic hoặc yêu cầu an toàn." value={form.specialCharacteristicImpact} onChange={(value) => patch('specialCharacteristicImpact', value)} />
              <YesNoRow title="Hỏng máy có dừng công đoạn?" description="Sự cố thiết bị có thể làm dừng công đoạn sản xuất đang phụ thuộc vào máy." value={form.stopsProduction} onChange={(value) => patch('stopsProduction', value)} />
              <YesNoRow title="Có thiết bị / phương án dự phòng?" description="Có máy thay thế hoặc phương án vận hành dự phòng đủ khả năng duy trì sản xuất." value={form.hasBackup} onChange={(value) => patch('hasBackup', value)} />
              <YesNoRow title="Có ảnh hưởng sản lượng / giao hàng?" description="Hỏng thiết bị có nguy cơ ảnh hưởng capacity hoặc delivery." value={form.capacityImpact} onChange={(value) => patch('capacityImpact', value)} />

              <View style={styles.divider} />
              <Text style={styles.label}>Trạng thái ban đầu</Text>
              <SegmentedChoice value={form.status} options={STATUS_OPTIONS} onChange={(value) => patch('status', value)} />
              <Field label="Ghi chú" value={form.note} onChangeText={(value) => patch('note', value)} placeholder="Thông tin cần lưu cho lần đăng ký đầu tiên" multiline />

              <View style={styles.reviewBox}>
                <View style={styles.reviewRow}><Text style={styles.reviewKey}>Tên thiết bị</Text><Text style={styles.reviewValue}>{form.equipmentName || '—'}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewKey}>Mã dự kiến</Text><Text style={styles.reviewValue}>{codePreview}</Text></View>
                <View style={styles.reviewRow}><Text style={styles.reviewKey}>Quản lý chính</Text><Text style={styles.reviewValue}>{form.managementResponsiblePrimary || '—'}</Text></View>
                <View style={[styles.reviewRow, styles.reviewRowLast]}><Text style={styles.reviewKey}>Còn thiếu</Text><Text style={[styles.reviewValue, missing.length ? styles.reviewWarning : styles.reviewOk]}>{missing.length ? `${missing.length} mục` : 'Đủ dữ liệu bắt buộc'}</Text></View>
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable style={styles.secondaryAction} onPress={() => setStep(step - 1)}>
              <Text style={styles.secondaryActionText}>Quay lại</Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={!stepValid}
            onPress={() => step < STEPS.length - 1 ? setStep(step + 1) : submitUi()}
            style={[styles.primaryAction, step === 0 && styles.primaryActionFull, !stepValid && styles.primaryActionDisabled]}
          >
            <Text style={styles.primaryActionText}>{step < STEPS.length - 1 ? 'Tiếp tục  →' : 'Lưu thiết bị'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <RegistrationScreen />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAECF0',
    backgroundColor: '#FFFFFF',
  },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  backGlyph: { fontSize: 36, lineHeight: 38, color: '#101828', marginTop: -2 },
  topTitleWrap: { flex: 1 },
  topTitle: { fontSize: 19, fontWeight: '700', color: '#101828', letterSpacing: -0.2 },
  topSubtitle: { marginTop: 2, fontSize: 12, color: '#667085' },
  stepBadge: { minWidth: 48, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: '#344054' },
  progressTrack: { height: 3, backgroundColor: '#EAECF0' },
  progressFill: { height: 3, backgroundColor: '#2563EB' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 36 },
  sectionHeader: { marginBottom: 22 },
  sectionEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3, color: '#2563EB' },
  sectionTitle: { marginTop: 6, fontSize: 28, lineHeight: 34, fontWeight: '800', color: '#101828', letterSpacing: -0.6 },
  sectionDescription: { marginTop: 8, fontSize: 14, lineHeight: 20, color: '#667085' },
  codeBanner: { minHeight: 78, paddingHorizontal: 18, paddingVertical: 14, marginBottom: 24, borderRadius: 18, backgroundColor: '#F5F8FF', borderWidth: 1, borderColor: '#DCE7FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#6172F3' },
  codeValue: { marginTop: 5, fontSize: 21, fontWeight: '800', color: '#1D2939', letterSpacing: 0.2 },
  codeHint: { maxWidth: 90, textAlign: 'right', fontSize: 11, lineHeight: 15, color: '#667085' },
  label: { marginBottom: 8, fontSize: 13, fontWeight: '700', color: '#344054' },
  required: { color: '#D92D20' },
  fieldBlock: { marginBottom: 18 },
  input: { minHeight: 50, borderRadius: 14, paddingHorizontal: 15, borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', color: '#101828', fontSize: 15 },
  multilineInput: { minHeight: 104, paddingTop: 14, paddingBottom: 14 },
  helper: { marginTop: 7, fontSize: 11, lineHeight: 16, color: '#667085' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  segment: { minHeight: 44, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  segmentActive: { borderColor: '#2563EB', backgroundColor: '#EFF4FF' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#475467' },
  segmentTextActive: { color: '#1D4ED8' },
  twoColumns: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  photoBlock: { marginTop: 4, marginBottom: 6 },
  photoPlaceholder: { minHeight: 170, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#B9C2D0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 20 },
  photoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', textAlign: 'center', textAlignVertical: 'center', fontSize: 22, lineHeight: 44, color: '#3157D5', overflow: 'hidden' },
  photoTitle: { marginTop: 12, fontSize: 15, fontWeight: '800', color: '#1D2939' },
  photoDescription: { marginTop: 6, maxWidth: 280, textAlign: 'center', fontSize: 12, lineHeight: 17, color: '#667085' },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  photoButtonPrimary: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  photoButtonPrimaryText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  photoButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF' },
  photoButtonText: { fontSize: 14, fontWeight: '800', color: '#344054' },
  divider: { height: 1, backgroundColor: '#EAECF0', marginVertical: 10, marginBottom: 24 },
  assessmentIntro: { padding: 16, borderRadius: 16, backgroundColor: '#F9FAFB', marginBottom: 8 },
  assessmentTitle: { fontSize: 15, fontWeight: '800', color: '#1D2939' },
  assessmentText: { marginTop: 5, fontSize: 12, lineHeight: 18, color: '#667085' },
  yesNoRow: { paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  yesNoCopy: { paddingRight: 4 },
  yesNoTitle: { fontSize: 14, fontWeight: '800', color: '#1D2939' },
  yesNoDescription: { marginTop: 5, fontSize: 12, lineHeight: 17, color: '#667085' },
  yesNoButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  answerButton: { minWidth: 78, minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  answerYes: { backgroundColor: '#ECFDF3', borderColor: '#75E0A7' },
  answerNo: { backgroundColor: '#FEF3F2', borderColor: '#FDA29B' },
  answerText: { fontSize: 13, fontWeight: '800', color: '#475467' },
  answerTextActive: { color: '#1D2939' },
  reviewBox: { marginTop: 8, borderRadius: 18, backgroundColor: '#F8FAFC', paddingHorizontal: 16 },
  reviewRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4E7EC' },
  reviewRowLast: { borderBottomWidth: 0 },
  reviewKey: { fontSize: 12, color: '#667085' },
  reviewValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#344054' },
  reviewWarning: { color: '#B54708' },
  reviewOk: { color: '#067647' },
  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4E7EC', backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 10 },
  secondaryAction: { minWidth: 104, minHeight: 52, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryActionText: { fontSize: 14, fontWeight: '800', color: '#344054' },
  primaryAction: { flex: 1, minHeight: 52, paddingHorizontal: 20, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryActionFull: { flex: 1 },
  primaryActionDisabled: { backgroundColor: '#B8C7F5' },
  primaryActionText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
})
