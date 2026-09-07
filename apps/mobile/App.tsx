import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import type { Session } from '@supabase/supabase-js'
import { createEquipment, mobileSupabaseConfigured, supabase, uploadEquipmentPhoto } from './src/supabase'

type EquipmentType = 'PRODUCTION' | 'MEASUREMENT'
type EquipmentStatus = 'RUNNING' | 'STOPPED' | 'MAINTENANCE' | 'DOWN'
type YesNo = '' | 'YES' | 'NO'
type IconName = keyof typeof Ionicons.glyphMap

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
  { title: 'Nhận diện thiết bị', subtitle: 'Tên, model, serial và ảnh nhận biết' },
  { title: 'Vị trí & quản lý', subtitle: 'Nơi sử dụng và người chịu trách nhiệm' },
  { title: 'Đánh giá thiết bị', subtitle: 'Criticality và trạng thái ban đầu' },
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
  icon,
  secureTextEntry,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  required?: boolean
  multiline?: boolean
  helper?: string
  icon?: IconName
  secureTextEntry?: boolean
}) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}{required ? <RequiredMark /> : null}</Text>
      <View style={[styles.inputShell, focused && styles.inputShellFocused, multiline && styles.inputShellMultiline]}>
        {icon ? <Ionicons name={icon} size={18} color={focused ? '#155EEF' : '#98A2B3'} style={styles.inputIcon} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          multiline={multiline}
          secureTextEntry={secureTextEntry}
          autoCapitalize={secureTextEntry ? 'none' : undefined}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, multiline && styles.multilineInput]}
        />
      </View>
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
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
          >
            {active ? <Ionicons name="checkmark-circle" size={17} color="#155EEF" /> : null}
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function SectionCard({
  icon,
  title,
  caption,
  children,
}: {
  icon: IconName
  title: string
  caption?: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}><Ionicons name={icon} size={18} color="#155EEF" /></View>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>{title}</Text>
          {caption ? <Text style={styles.cardCaption}>{caption}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  )
}

function YesNoRow({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: IconName
  title: string
  description: string
  value: YesNo
  onChange: (value: YesNo) => void
}) {
  return (
    <View style={styles.assessmentRow}>
      <View style={styles.assessmentHeading}>
        <View style={styles.assessmentIcon}><Ionicons name={icon} size={17} color="#475467" /></View>
        <View style={styles.assessmentCopy}>
          <Text style={styles.assessmentTitle}>{title}<RequiredMark /></Text>
          <Text style={styles.assessmentDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.answerGroup}>
        {(['NO', 'YES'] as const).map((answer) => {
          const active = value === answer
          return (
            <Pressable
              key={answer}
              onPress={() => onChange(answer)}
              style={({ pressed }) => [
                styles.answerButton,
                active && (answer === 'YES' ? styles.answerYes : styles.answerNo),
                pressed && styles.pressed,
              ]}
            >
              {active ? <Ionicons name={answer === 'YES' ? 'checkmark' : 'close'} size={15} color={answer === 'YES' ? '#067647' : '#B42318'} /> : null}
              <Text style={[styles.answerText, active && (answer === 'YES' ? styles.answerTextYes : styles.answerTextNo)]}>
                {answer === 'YES' ? 'Có' : 'Không'}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function StepProgress({ step }: { step: number }) {
  return (
    <View style={styles.progressWrap}>
      {STEPS.map((item, index) => {
        const complete = index < step
        const active = index === step
        return (
          <View key={item.title} style={styles.progressItem}>
            <View style={[styles.progressBar, (complete || active) && styles.progressBarActive]} />
          </View>
        )
      })}
    </View>
  )
}

function RegistrationScreen({ onSignOut }: { onSignOut: () => void }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<EquipmentDraft>(INITIAL)
  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView | null>(null)
  const current = STEPS[step]

  const codePreview = form.equipmentType === 'PRODUCTION' ? 'CEV-PR-xxx' : 'CEV-ME-xxx'
  const typeLabel = form.equipmentType === 'PRODUCTION' ? 'Thiết bị sản xuất' : 'Thiết bị đo / kiểm'

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

  async function openCamera() {
    const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission()
    if (!permission.granted) {
      Alert.alert('Cần quyền camera', 'Hãy cấp quyền camera để chụp ảnh thiết bị.')
      return
    }
    setCameraOpen(true)
  }

  async function capturePhoto() {
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 })
      if (photo?.uri) {
        setPhotoUri(photo.uri)
        setCameraOpen(false)
      }
    } catch {
      Alert.alert('Không chụp được ảnh', 'Vui lòng thử lại.')
    }
  }

  async function selectFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Cần quyền thư viện', 'Hãy cấp quyền truy cập ảnh để chọn ảnh thiết bị.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.85,
    })

    if (!result.canceled && result.assets[0]?.uri) {
      setPhotoUri(result.assets[0].uri)
    }
  }

  async function submitUi() {
    if (saving) return
    if (!mobileSupabaseConfigured) {
      setSaveError('Chưa cấu hình EXPO_PUBLIC_SUPABASE_URL và EXPO_PUBLIC_SUPABASE_ANON_KEY.')
      return
    }

    setSaving(true)
    setSaveError('')
    setSaveMessage('')

    try {
      const result = await createEquipment({
        equipmentType: form.equipmentType,
        equipmentName: form.equipmentName.trim(),
        equipmentCategory: form.equipmentCategory.trim(),
        manufacturer: form.manufacturer.trim(),
        distributor: form.distributor.trim(),
        model: form.model.trim(),
        serialNumber: form.serialNumber.trim(),
        department: '',
        currentArea: form.currentArea.trim(),
        currentLine: form.currentLine.trim(),
        managingDepartment: form.managingDepartment.trim(),
        managementResponsiblePrimary: form.managementResponsiblePrimary.trim(),
        managementResponsibleSecondary: form.managementResponsibleSecondary.trim(),
        technicalSpecification: form.technicalSpecification.trim(),
        description: form.description.trim(),
        origin: form.origin.trim(),
        inServiceDate: form.inServiceDate.trim(),
        warrantyUntil: form.warrantyUntil.trim(),
        warrantyContact: form.warrantyContact.trim(),
        note: form.note.trim(),
        status: form.status,
        controlsProductQuality: form.controlsProductQuality === 'YES',
        specialCharacteristicImpact: form.specialCharacteristicImpact === 'YES',
        stopsProduction: form.stopsProduction === 'YES',
        hasBackup: form.hasBackup === 'YES',
        capacityImpact: form.capacityImpact === 'YES',
      })

      if (photoUri) {
        try {
          await uploadEquipmentPhoto(result.equipmentId, photoUri)
        } catch (photoError) {
          const detail = photoError instanceof Error ? photoError.message : 'Không tải được ảnh.'
          setSaveError(`Thiết bị ${result.equipmentId} đã được tạo nhưng ảnh chưa tải lên: ${detail}`)
          return
        }
      }

      const message = `${result.equipmentId} · Criticality ${result.criticality || '—'}`
      setSaveMessage(message)
      Alert.alert('Đã tạo thiết bị', message)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không thể tạo thiết bị.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.shell}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              onPress={() => step > 0 ? setStep(step - 1) : Alert.alert('Tài khoản', 'Bạn muốn đăng xuất khỏi CEV CMMS?', [{ text: 'Hủy', style: 'cancel' }, { text: 'Đăng xuất', style: 'destructive', onPress: onSignOut }])}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={22} color="#101828" />
            </Pressable>
            <View style={styles.topTitleWrap}>
              <Text style={styles.topTitle}>Thêm thiết bị</Text>
              <Text style={styles.topSubtitle}>{current.title}</Text>
            </View>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{step + 1} / {STEPS.length}</Text></View>
          </View>

          <StepProgress step={step} />

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.screenIntro}>
              <Text style={styles.screenTitle}>{current.title}</Text>
              <Text style={styles.screenSubtitle}>{current.subtitle}</Text>
            </View>

            {step === 0 ? (
              <>
                <View style={styles.assetHero}>
                  <View style={styles.assetHeroTop}>
                    <View style={styles.assetHeroIcon}><Ionicons name="hardware-chip-outline" size={22} color="#FFFFFF" /></View>
                    <View style={styles.assetHeroChip}><Text style={styles.assetHeroChipText}>{form.equipmentType === 'PRODUCTION' ? 'PR' : 'ME'}</Text></View>
                  </View>
                  <Text style={styles.assetHeroLabel}>MÃ THIẾT BỊ TỰ SINH</Text>
                  <Text style={styles.assetHeroCode}>{codePreview}</Text>
                  <Text style={styles.assetHeroMeta}>{typeLabel} · QR dùng chính mã thiết bị</Text>
                </View>

                <SectionCard icon="options-outline" title="Loại thiết bị" caption="Chọn đúng nhóm để hệ thống sinh prefix mã">
                  <SegmentedChoice
                    value={form.equipmentType}
                    options={[
                      { value: 'PRODUCTION', label: 'Sản xuất · PR' },
                      { value: 'MEASUREMENT', label: 'Đo / kiểm · ME' },
                    ]}
                    onChange={(value) => patch('equipmentType', value)}
                  />
                </SectionCard>

                <SectionCard icon="information-circle-outline" title="Thông tin nhận diện" caption="Các thông tin nhìn thấy trực tiếp trên máy hoặc nameplate">
                  <Field
                    icon="cube-outline"
                    label="Tên thiết bị"
                    required
                    value={form.equipmentName}
                    onChangeText={(value) => patch('equipmentName', value)}
                    placeholder="Ví dụ: WPC Auto Soldering Machine"
                    helper="Ưu tiên dùng tên chuẩn đã có trong Equipment Master."
                  />
                  <Field icon="grid-outline" label="Nhóm thiết bị" value={form.equipmentCategory} onChangeText={(value) => patch('equipmentCategory', value)} placeholder="Ví dụ: Auto line" />
                  <Field icon="pricetag-outline" label="Model" value={form.model} onChangeText={(value) => patch('model', value)} placeholder="Model / part number" />
                  <Field icon="business-outline" label="Hãng / nhà sản xuất" value={form.manufacturer} onChangeText={(value) => patch('manufacturer', value)} placeholder="Tên hãng" />
                  <Field icon="storefront-outline" label="Nhà phân phối" value={form.distributor} onChangeText={(value) => patch('distributor', value)} placeholder="Nếu có" />
                  <Field icon="barcode-outline" label="Số sê-ri" value={form.serialNumber} onChangeText={(value) => patch('serialNumber', value)} placeholder="Serial number" />
                </SectionCard>

                <SectionCard icon="camera-outline" title="Ảnh thiết bị" caption="Một ảnh rõ máy hoặc nameplate giúp nhận diện nhanh ngoài hiện trường">
                  <View style={[styles.photoStage, photoUri && styles.photoStageSelected]}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="contain" />
                    ) : (
                      <>
                        <View style={styles.photoOrb}>
                          <Ionicons name="camera-outline" size={26} color="#155EEF" />
                        </View>
                        <Text style={styles.photoTitle}>Thêm ảnh nhận diện</Text>
                        <Text style={styles.photoDescription}>Chụp toàn cảnh, bảng tên máy hoặc vị trí lắp đặt.</Text>
                      </>
                    )}
                  </View>
                  {photoUri ? (
                    <View style={styles.photoSelectedRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#067647" />
                      <Text style={styles.photoSelectedText}>Đã chọn ảnh · luôn hiển thị toàn bộ ảnh</Text>
                      <Pressable accessibilityRole="button" accessibilityLabel="Xóa ảnh" hitSlop={10} onPress={() => setPhotoUri(null)}>
                        <Ionicons name="trash-outline" size={19} color="#B42318" />
                      </Pressable>
                    </View>
                  ) : null}
                  <View style={styles.photoActions}>
                    <Pressable style={({ pressed }) => [styles.photoButtonPrimary, pressed && styles.pressed]} onPress={openCamera}>
                      <Ionicons name="camera" size={18} color="#FFFFFF" />
                      <Text style={styles.photoButtonPrimaryText}>Chụp ảnh</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]} onPress={selectFromLibrary}>
                      <Ionicons name="images-outline" size={18} color="#344054" />
                      <Text style={styles.photoButtonText}>Thư viện</Text>
                    </Pressable>
                  </View>
                </SectionCard>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <SectionCard icon="location-outline" title="Vị trí sử dụng" caption="Dùng để tìm máy nhanh khi mở Work Order hoặc quét QR">
                  <Field icon="people-outline" label="Bộ phận quản lý" value={form.managingDepartment} onChangeText={(value) => patch('managingDepartment', value)} placeholder="Ví dụ: BP - Kỹ thuật" />
                  <Field icon="map-outline" label="Khu vực" value={form.currentArea} onChangeText={(value) => patch('currentArea', value)} placeholder="Area / zone" />
                  <Field icon="git-branch-outline" label="Line / công đoạn" value={form.currentLine} onChangeText={(value) => patch('currentLine', value)} placeholder="Line / process" />
                </SectionCard>

                <SectionCard icon="person-circle-outline" title="Người chịu trách nhiệm" caption="Một máy có một người quản lý chính và tối đa một người phụ">
                  <Field
                    icon="person-outline"
                    label="Người quản lý chính"
                    required
                    value={form.managementResponsiblePrimary}
                    onChangeText={(value) => patch('managementResponsiblePrimary', value)}
                    placeholder="Người chịu trách nhiệm gần nhất"
                    helper="Không dùng operator vận hành làm người quản lý thiết bị."
                  />
                  <Field icon="person-add-outline" label="Người quản lý phụ" value={form.managementResponsibleSecondary} onChangeText={(value) => patch('managementResponsibleSecondary', value)} placeholder="Không bắt buộc" />
                </SectionCard>

                <SectionCard icon="document-text-outline" title="Thông tin kỹ thuật" caption="Có thể bổ sung dần sau khi thiết bị đã được tạo">
                  <Field icon="speedometer-outline" label="Thông số kỹ thuật" value={form.technicalSpecification} onChangeText={(value) => patch('technicalSpecification', value)} placeholder="Công suất, điện áp, phạm vi..." multiline />
                  <Field icon="reader-outline" label="Mô tả" value={form.description} onChangeText={(value) => patch('description', value)} placeholder="Mô tả ngắn về chức năng thiết bị" multiline />
                  <Field icon="earth-outline" label="Xuất xứ" value={form.origin} onChangeText={(value) => patch('origin', value)} placeholder="Korea / Japan / Vietnam..." />
                  <Field icon="calendar-outline" label="Ngày đưa vào dùng" value={form.inServiceDate} onChangeText={(value) => patch('inServiceDate', value)} placeholder="YYYY-MM-DD" />
                  <Field icon="shield-checkmark-outline" label="Hết bảo hành" value={form.warrantyUntil} onChangeText={(value) => patch('warrantyUntil', value)} placeholder="YYYY-MM-DD" />
                  <Field icon="call-outline" label="Liên hệ bảo hành" value={form.warrantyContact} onChangeText={(value) => patch('warrantyContact', value)} placeholder="Tên / điện thoại / email" />
                </SectionCard>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <View style={styles.assessmentIntro}>
                  <View style={styles.assessmentIntroIcon}><Ionicons name="shield-checkmark-outline" size={22} color="#155EEF" /></View>
                  <View style={styles.assessmentIntroCopy}>
                    <Text style={styles.assessmentIntroTitle}>Criticality sẽ được tính tự động</Text>
                    <Text style={styles.assessmentIntroText}>Trả lời 5 câu bắt buộc theo business rule hiện có của CEV.</Text>
                  </View>
                </View>

                <SectionCard icon="analytics-outline" title="Mức độ ảnh hưởng" caption="Không dùng cảm tính A/B/C; hệ thống tự suy ra sau khi lưu">
                  <YesNoRow icon="checkmark-done-outline" title="Kiểm soát đặc tính chất lượng?" description="Thiết bị trực tiếp kiểm soát hoặc tạo ra đặc tính chất lượng." value={form.controlsProductQuality} onChange={(value) => patch('controlsProductQuality', value)} />
                  <YesNoRow icon="warning-outline" title="Ảnh hưởng đặc tính đặc biệt / an toàn?" description="Có ảnh hưởng tới special characteristic hoặc yêu cầu an toàn." value={form.specialCharacteristicImpact} onChange={(value) => patch('specialCharacteristicImpact', value)} />
                  <YesNoRow icon="pause-circle-outline" title="Hỏng máy có dừng công đoạn?" description="Sự cố thiết bị có thể làm dừng công đoạn sản xuất." value={form.stopsProduction} onChange={(value) => patch('stopsProduction', value)} />
                  <YesNoRow icon="repeat-outline" title="Có thiết bị / phương án dự phòng?" description="Có máy thay thế hoặc phương án đủ khả năng duy trì sản xuất." value={form.hasBackup} onChange={(value) => patch('hasBackup', value)} />
                  <YesNoRow icon="trending-down-outline" title="Có ảnh hưởng sản lượng / giao hàng?" description="Hỏng thiết bị có nguy cơ ảnh hưởng capacity hoặc delivery." value={form.capacityImpact} onChange={(value) => patch('capacityImpact', value)} />
                </SectionCard>

                <SectionCard icon="pulse-outline" title="Trạng thái ban đầu" caption="Trạng thái thực tế tại thời điểm đăng ký">
                  <SegmentedChoice value={form.status} options={STATUS_OPTIONS} onChange={(value) => patch('status', value)} />
                  <Field icon="create-outline" label="Ghi chú" value={form.note} onChangeText={(value) => patch('note', value)} placeholder="Thông tin cần lưu cho lần đăng ký đầu tiên" multiline />
                </SectionCard>

                {saveError ? (
                  <View style={styles.saveError}>
                    <Ionicons name="alert-circle" size={19} color="#B42318" />
                    <Text style={styles.saveErrorText}>{saveError}</Text>
                  </View>
                ) : null}
                {saveMessage ? (
                  <View style={styles.saveSuccess}>
                    <Ionicons name="checkmark-circle" size={19} color="#067647" />
                    <Text style={styles.saveSuccessText}>{saveMessage}</Text>
                  </View>
                ) : null}

                <View style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View>
                      <Text style={styles.reviewEyebrow}>SẴN SÀNG LƯU</Text>
                      <Text style={styles.reviewTitle}>{form.equipmentName || 'Thiết bị mới'}</Text>
                    </View>
                    <View style={[styles.reviewState, missing.length === 0 ? styles.reviewStateOk : styles.reviewStateWarning]}>
                      <Ionicons name={missing.length === 0 ? 'checkmark-circle' : 'alert-circle'} size={17} color={missing.length === 0 ? '#067647' : '#B54708'} />
                      <Text style={[styles.reviewStateText, missing.length === 0 ? styles.reviewStateTextOk : styles.reviewStateTextWarning]}>
                        {missing.length === 0 ? 'Đủ dữ liệu' : `Thiếu ${missing.length}`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewRow}><Text style={styles.reviewKey}>Mã dự kiến</Text><Text style={styles.reviewValue}>{codePreview}</Text></View>
                  <View style={styles.reviewRow}><Text style={styles.reviewKey}>Loại</Text><Text style={styles.reviewValue}>{typeLabel}</Text></View>
                  <View style={styles.reviewRow}><Text style={styles.reviewKey}>Quản lý chính</Text><Text style={styles.reviewValue}>{form.managementResponsiblePrimary || '—'}</Text></View>
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {step > 0 ? (
              <Pressable style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]} onPress={() => setStep(step - 1)}>
                <Ionicons name="arrow-back" size={18} color="#344054" />
                <Text style={styles.secondaryActionText}>Quay lại</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={!stepValid || saving}
              onPress={() => step < STEPS.length - 1 ? setStep(step + 1) : submitUi()}
              style={({ pressed }) => [
                styles.primaryAction,
                step === 0 && styles.primaryActionFull,
                (!stepValid || saving) && styles.primaryActionDisabled,
                pressed && stepValid && !saving && styles.primaryActionPressed,
              ]}
            >
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={styles.primaryActionText}>{step < STEPS.length - 1 ? 'Tiếp tục' : saving ? 'Đang lưu...' : 'Lưu thiết bị'}</Text>
              {!saving ? <Ionicons name={step < STEPS.length - 1 ? 'arrow-forward' : 'checkmark'} size={19} color="#FFFFFF" /> : null}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
          <SafeAreaView style={styles.cameraModal} edges={['top', 'bottom']}>
            <View style={styles.cameraHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng camera"
                style={({ pressed }) => [styles.cameraClose, pressed && styles.pressed]}
                onPress={() => setCameraOpen(false)}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.cameraTitle}>Chụp ảnh thiết bị</Text>
              <View style={styles.cameraHeaderSpacer} />
            </View>
            <CameraView ref={cameraRef} style={styles.cameraView} facing="back" />
            <View style={styles.cameraFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chụp ảnh"
                style={({ pressed }) => [styles.captureOuter, pressed && styles.capturePressed]}
                onPress={capturePhoto}
              >
                <View style={styles.captureInner} />
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>
      </View>
    </SafeAreaView>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function signIn() {
    if (!mobileSupabaseConfigured) {
      setError('Chưa cấu hình Supabase cho mobile.')
      return
    }
    if (!email.trim() || !password) {
      setError('Nhập email và mật khẩu.')
      return
    }

    setSubmitting(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (authError) setError(authError.message)
    setSubmitting(false)
  }

  return (
    <SafeAreaView style={styles.loginSafeArea} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.loginBody} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.loginBrand}>
          <View style={styles.loginLogo}><Ionicons name="construct" size={28} color="#FFFFFF" /></View>
          <Text style={styles.loginEyebrow}>CORE ELECTRONICS VIETNAM</Text>
          <Text style={styles.loginTitle}>CEV CMMS</Text>
          <Text style={styles.loginSubtitle}>Đăng nhập bằng tài khoản hệ thống hiện có.</Text>
        </View>
        <View style={styles.loginCard}>
          <Field icon="mail-outline" label="Email" value={email} onChangeText={setEmail} placeholder="name@company.com" required />
          <Field icon="lock-closed-outline" label="Mật khẩu" value={password} onChangeText={setPassword} placeholder="Mật khẩu" required secureTextEntry />
          {error ? <Text style={styles.loginError}>{error}</Text> : null}
          <Pressable
            disabled={submitting}
            onPress={signIn}
            style={({ pressed }) => [styles.loginButton, submitting && styles.primaryActionDisabled, pressed && !submitting && styles.primaryActionPressed]}
          >
            {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="log-in-outline" size={19} color="#FFFFFF" />}
            <Text style={styles.loginButtonText}>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function MobileApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <View style={styles.loadingScreen}><ActivityIndicator size="large" color="#155EEF" /></View>
  }

  if (!session) return <LoginScreen />
  return <RegistrationScreen onSignOut={() => { void supabase.auth.signOut() }} />
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MobileApp />
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F3F5F7' },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: '#F7F8FA',
    borderLeftWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
    borderRightWidth: Platform.OS === 'web' ? StyleSheet.hairlineWidth : 0,
    borderColor: '#EAECF0',
  },
  topBar: {
    minHeight: 70,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  iconButton: {
    width: 42,
    height: 42,
    marginRight: 8,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F4F7',
  },
  topTitleWrap: { flex: 1 },
  topTitle: { fontSize: 18, fontWeight: '800', color: '#101828', letterSpacing: -0.25 },
  topSubtitle: { marginTop: 2, fontSize: 11.5, fontWeight: '500', color: '#667085' },
  stepBadge: { minWidth: 50, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontSize: 11.5, fontWeight: '800', color: '#344054' },
  progressWrap: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12, backgroundColor: '#FFFFFF' },
  progressItem: { flex: 1 },
  progressBar: { height: 3, borderRadius: 3, backgroundColor: '#E4E7EC' },
  progressBarActive: { backgroundColor: '#155EEF' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 32 },
  screenIntro: { marginBottom: 18 },
  screenTitle: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#101828', letterSpacing: -0.45 },
  screenSubtitle: { marginTop: 5, fontSize: 13, lineHeight: 19, color: '#667085' },
  assetHero: { padding: 18, marginBottom: 14, borderRadius: 22, backgroundColor: '#101828' },
  assetHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  assetHeroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D2939' },
  assetHeroChip: { minWidth: 40, height: 28, paddingHorizontal: 10, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#344054' },
  assetHeroChipText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8, color: '#FFFFFF' },
  assetHeroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.25, color: '#98A2B3' },
  assetHeroCode: { marginTop: 5, fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: 0.2, color: '#FFFFFF' },
  assetHeroMeta: { marginTop: 7, fontSize: 12, color: '#D0D5DD' },
  sectionCard: { marginBottom: 14, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 17 },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  cardHeaderCopy: { flex: 1, marginLeft: 11 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1D2939' },
  cardCaption: { marginTop: 2, fontSize: 11.5, lineHeight: 16, color: '#667085' },
  label: { marginBottom: 7, fontSize: 12, fontWeight: '700', color: '#475467' },
  required: { color: '#D92D20' },
  fieldBlock: { marginBottom: 15 },
  inputShell: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#F8FAFC' },
  inputShellFocused: { borderColor: '#84ADFF', backgroundColor: '#FFFFFF', shadowColor: '#155EEF', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  inputShellMultiline: { alignItems: 'flex-start' },
  inputIcon: { marginLeft: 14, marginRight: 9, marginTop: 1 },
  input: { flex: 1, minHeight: 48, paddingRight: 14, paddingVertical: 11, color: '#101828', fontSize: 14 },
  multilineInput: { minHeight: 92, paddingTop: 13, paddingBottom: 13 },
  helper: { marginTop: 6, fontSize: 10.5, lineHeight: 15, color: '#7A8699' },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 1 },
  segment: { minWidth: 120, minHeight: 44, flexGrow: 1, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: '#E4E7EC', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  segmentActive: { borderColor: '#B2CCFF', backgroundColor: '#EEF4FF' },
  segmentText: { fontSize: 12.5, fontWeight: '700', color: '#475467' },
  segmentTextActive: { color: '#155EEF' },
  pressed: { opacity: 0.74 },
  photoStage: { minHeight: 142, borderRadius: 18, borderWidth: 1, borderColor: '#DDE5F0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 18 },
  photoStageSelected: { borderColor: '#ABEFC6', backgroundColor: '#101828', padding: 8 },
  photoPreview: { width: '100%', height: 220 },
  photoSelectedRow: { minHeight: 42, marginTop: 8, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: '#ECFDF3' },
  photoSelectedText: { flex: 1, fontSize: 11.5, fontWeight: '700', color: '#067647' },
  photoOrb: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  photoOrbSelected: { backgroundColor: '#ECFDF3' },
  photoTitle: { marginTop: 11, fontSize: 14, fontWeight: '800', color: '#1D2939' },
  photoDescription: { marginTop: 5, maxWidth: 300, textAlign: 'center', fontSize: 11, lineHeight: 16, color: '#667085' },
  photoActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
  photoButtonPrimary: { flex: 1, minHeight: 46, borderRadius: 14, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  photoButtonPrimaryText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  photoButton: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#D0D5DD', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  photoButtonText: { fontSize: 13, fontWeight: '800', color: '#344054' },
  assessmentIntro: { marginBottom: 14, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: '#DCE7FF', flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F8FF' },
  assessmentIntroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF2FF' },
  assessmentIntroCopy: { flex: 1, marginLeft: 11 },
  assessmentIntroTitle: { fontSize: 13.5, fontWeight: '800', color: '#1D2939' },
  assessmentIntroText: { marginTop: 3, fontSize: 11, lineHeight: 16, color: '#667085' },
  assessmentRow: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EAECF0' },
  assessmentHeading: { flexDirection: 'row', alignItems: 'flex-start' },
  assessmentIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F2F4F7' },
  assessmentCopy: { flex: 1, marginLeft: 10 },
  assessmentTitle: { fontSize: 13, fontWeight: '800', color: '#1D2939' },
  assessmentDescription: { marginTop: 4, fontSize: 11, lineHeight: 16, color: '#667085' },
  answerGroup: { flexDirection: 'row', gap: 8, marginTop: 11, marginLeft: 44 },
  answerButton: { minWidth: 78, minHeight: 38, paddingHorizontal: 13, borderRadius: 19, borderWidth: 1, borderColor: '#E4E7EC', flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  answerYes: { borderColor: '#ABEFC6', backgroundColor: '#ECFDF3' },
  answerNo: { borderColor: '#FECDCA', backgroundColor: '#FEF3F2' },
  answerText: { fontSize: 12, fontWeight: '800', color: '#667085' },
  answerTextYes: { color: '#067647' },
  answerTextNo: { color: '#B42318' },
  saveError: { marginBottom: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#FECDCA', flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#FEF3F2' },
  saveErrorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#B42318' },
  saveSuccess: { marginBottom: 12, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#ABEFC6', flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#ECFDF3' },
  saveSuccessText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '800', color: '#067647' },
  reviewCard: { marginBottom: 8, padding: 17, borderRadius: 20, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  reviewHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
  reviewEyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.1, color: '#667085' },
  reviewTitle: { marginTop: 4, maxWidth: 220, fontSize: 16, fontWeight: '800', color: '#101828' },
  reviewState: { minHeight: 32, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', gap: 5, alignItems: 'center' },
  reviewStateOk: { backgroundColor: '#ECFDF3' },
  reviewStateWarning: { backgroundColor: '#FFFAEB' },
  reviewStateText: { fontSize: 10.5, fontWeight: '800' },
  reviewStateTextOk: { color: '#067647' },
  reviewStateTextWarning: { color: '#B54708' },
  reviewDivider: { height: 1, marginVertical: 14, backgroundColor: '#EAECF0' },
  reviewRow: { minHeight: 36, flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'space-between' },
  reviewKey: { fontSize: 11.5, color: '#667085' },
  reviewValue: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700', color: '#344054' },
  footer: { paddingHorizontal: 14, paddingTop: 11, paddingBottom: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EAECF0', flexDirection: 'row', gap: 9, backgroundColor: '#FFFFFF', shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: -5 }, elevation: 8 },
  secondaryAction: { minWidth: 108, minHeight: 52, paddingHorizontal: 16, borderRadius: 15, borderWidth: 1, borderColor: '#D0D5DD', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryActionText: { fontSize: 13, fontWeight: '800', color: '#344054' },
  primaryAction: { flex: 1, minHeight: 52, paddingHorizontal: 20, borderRadius: 15, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF', shadowColor: '#155EEF', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  primaryActionFull: { flex: 1 },
  primaryActionDisabled: { backgroundColor: '#B2CCFF', shadowOpacity: 0, elevation: 0 },
  primaryActionPressed: { backgroundColor: '#004EEB', transform: [{ scale: 0.99 }] },
  primaryActionText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F8FA' },
  loginSafeArea: { flex: 1, backgroundColor: '#F3F5F7' },
  loginBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  loginBrand: { alignItems: 'center', marginBottom: 24 },
  loginLogo: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  loginEyebrow: { marginTop: 17, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, color: '#667085' },
  loginTitle: { marginTop: 5, fontSize: 29, fontWeight: '900', color: '#101828' },
  loginSubtitle: { marginTop: 6, textAlign: 'center', fontSize: 13, color: '#667085' },
  loginCard: { width: '100%', maxWidth: 460, alignSelf: 'center', padding: 18, borderRadius: 22, borderWidth: 1, borderColor: '#EAECF0', backgroundColor: '#FFFFFF' },
  loginError: { marginBottom: 12, fontSize: 12, lineHeight: 17, fontWeight: '700', color: '#B42318' },
  loginButton: { minHeight: 52, borderRadius: 15, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#155EEF' },
  loginButtonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  cameraModal: { flex: 1, backgroundColor: '#000000' },
  cameraHeader: { minHeight: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#101828' },
  cameraClose: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D2939' },
  cameraTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  cameraHeaderSpacer: { width: 44 },
  cameraView: { flex: 1 },
  cameraFooter: { minHeight: 118, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101828' },
  captureOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  capturePressed: { transform: [{ scale: 0.94 }] },
})
