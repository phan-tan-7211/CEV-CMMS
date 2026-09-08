import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'

type Field = {
  key: string
  label: string
  placeholder: string
  multiline?: boolean
  required?: boolean
  displayValue?: string
  onPress?: () => void
}

export function MasterDataFormScreen({
  title,
  fields,
  onBack,
  onSubmit,
}: {
  title: string
  fields: Field[]
  onBack: () => void
  onSubmit: (values: Record<string, string>) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (saving) return
    const missing = fields.find((field) => field.required && !field.onPress && !String(values[field.key] || '').trim())
    if (missing) { setError(`${missing.label.replace(' *', '')} là bắt buộc.`); return }
    setSaving(true); setError('')
    try { await onSubmit(values) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lưu được dữ liệu.') }
    finally { setSaving(false) }
  }

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828" /></Pressable><Text style={styles.title}>{title}</Text><View style={styles.icon}/></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{fields.map((field)=><View key={field.key} style={styles.field}><Text style={styles.label}>{field.label}</Text>{field.onPress ? <Pressable disabled={saving} onPress={field.onPress} style={styles.selector}><Text style={field.displayValue ? styles.selectorValue : styles.selectorPlaceholder}>{field.displayValue || field.placeholder}</Text><Ionicons name="chevron-forward" size={21} color="#98A2B3" /></Pressable> : <TextInput value={values[field.key] || ''} onChangeText={(value)=>setValues((current)=>({...current,[field.key]:value}))} placeholder={field.placeholder} placeholderTextColor="#98A2B3" multiline={field.multiline} editable={!saving} style={[styles.input,field.multiline&&styles.textarea]}/>}</View>)}{error ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color="#B42318"/><Text style={styles.errorText}>{error}</Text></View> : null}<View style={styles.note}><Ionicons name="cloud-done-outline" size={19} color="#536DFE"/><Text style={styles.noteText}>Dữ liệu được lưu trực tiếp vào CMMS. Quyền tạo/chỉnh sửa áp dụng theo vai trò tài khoản.</Text></View></ScrollView><View style={styles.bottom}><Pressable disabled={saving} onPress={()=>void submit()} style={[styles.save,saving&&styles.saveDisabled]}>{saving ? <ActivityIndicator color="#FFF"/> : <Text style={styles.saveText}>Lưu</Text>}</Pressable></View></SafeAreaView>
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F1F1FA'},header:{minHeight:60,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#FFF',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E5E5EF'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'900',color:'#101828'},content:{padding:14,paddingBottom:30},field:{marginBottom:18},label:{marginBottom:8,fontSize:13.5,fontWeight:'900',color:'#344054'},input:{minHeight:54,paddingHorizontal:14,borderRadius:15,borderWidth:1,borderColor:'#D7D8E5',backgroundColor:'#FFF',fontSize:15,color:'#101828'},textarea:{minHeight:120,paddingTop:14,textAlignVertical:'top'},selector:{minHeight:54,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderRadius:15,borderWidth:1,borderColor:'#D7D8E5',backgroundColor:'#FFF'},selectorValue:{flex:1,fontSize:15,fontWeight:'700',color:'#101828'},selectorPlaceholder:{flex:1,fontSize:15,color:'#98A2B3'},note:{padding:13,flexDirection:'row',gap:8,borderRadius:13,backgroundColor:'#E9EDFF'},noteText:{flex:1,fontSize:12.5,lineHeight:18,color:'#344054'},errorBox:{marginBottom:12,padding:12,flexDirection:'row',gap:8,borderRadius:13,backgroundColor:'#FEF3F2'},errorText:{flex:1,fontSize:12.5,lineHeight:18,color:'#B42318'},bottom:{padding:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:'#EAECF0',backgroundColor:'#FFF'},save:{minHeight:52,borderRadius:26,alignItems:'center',justifyContent:'center',backgroundColor:'#536DFE'},saveDisabled:{opacity:.65},saveText:{fontSize:16,fontWeight:'900',color:'#FFF'}})
