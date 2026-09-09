import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { DynamicCustomFieldsSection } from '../components/DynamicCustomFieldsSection'
import { saveEntityCustomValues, type CustomFieldDraftValue } from '../features/core-parity/api/coreParityService'

export function EntityCustomFieldsScreen({ entityType, entityId, title='Trường tùy chỉnh', onBack, onDone }: { entityType: string; entityId: string; title?: string; onBack: () => void; onDone?: () => void }) {
  const [values,setValues]=useState<CustomFieldDraftValue[]>([])
  const [validation,setValidation]=useState('')
  const [saving,setSaving]=useState(false)
  async function save(){
    if(validation)return Alert.alert('Thiếu thông tin',validation)
    setSaving(true)
    try{if(values.length)await saveEntityCustomValues(entityType,entityId,values);(onDone||onBack)()}
    catch(error){Alert.alert('Không lưu được custom fields',error instanceof Error?error.message:'Vui lòng thử lại.')}
    finally{setSaving(false)}
  }
  return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.copy}><Text style={styles.title}>{title}</Text><Text style={styles.sub}>{entityId}</Text></View><View style={styles.icon}/></View><ScrollView contentContainerStyle={styles.content}><DynamicCustomFieldsSection entityType={entityType} entityId={entityId} values={values} onChange={setValues} onValidationChange={setValidation}/><View style={styles.note}><Ionicons name="information-circle-outline" size={18} color="#175CD3"/><Text style={styles.noteText}>Các trường được cấu hình bởi quản trị viên và lưu trực tiếp với đối tượng này.</Text></View></ScrollView><View style={styles.bottom}><Pressable disabled={saving||Boolean(validation)} onPress={()=>void save()} style={[styles.save,(saving||Boolean(validation))&&styles.disabled]}>{saving?<ActivityIndicator color="#FFF"/>:<Text style={styles.saveText}>Lưu & tiếp tục</Text>}</Pressable></View></SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8FAFC'},header:{minHeight:62,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},copy:{flex:1,alignItems:'center'},title:{fontSize:18,fontWeight:'900',color:'#101828'},sub:{marginTop:2,fontSize:10.5,color:'#667085'},content:{padding:16,paddingBottom:32},note:{marginTop:16,padding:12,flexDirection:'row',gap:8,borderRadius:12,backgroundColor:'#EFF8FF'},noteText:{flex:1,fontSize:12,lineHeight:17,color:'#175CD3'},bottom:{padding:16,borderTopWidth:1,borderTopColor:'#EAECF0',backgroundColor:'#FFF'},save:{minHeight:52,borderRadius:26,backgroundColor:'#155EEF',alignItems:'center',justifyContent:'center'},saveText:{fontSize:16,fontWeight:'900',color:'#FFF'},disabled:{opacity:.5}})