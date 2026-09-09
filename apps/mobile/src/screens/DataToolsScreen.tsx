import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { exportDataset, importDataset, parseCsv, toCsv, type ExportEntityType, type ImportResult } from '../features/core-parity/api/coreParityService'

const TYPES:Array<{id:ExportEntityType;label:string}>=[
  {id:'ASSET',label:'Thiết bị'},{id:'PART',label:'Phụ tùng'},{id:'LOCATION',label:'Vị trí'},{id:'METER',label:'Meter'},{id:'WORK_ORDER',label:'Work Order'},
]
function readText(uri:string){return fetch(uri).then((response)=>{if(!response.ok)throw new Error('Không đọc được file đã chọn.');return response.text()})}

export function DataToolsScreen({onBack}:{onBack:()=>void}){
  const [entityType,setEntityType]=useState<ExportEntityType>('ASSET')
  const [busy,setBusy]=useState(false)
  const [preview,setPreview]=useState<Array<Record<string,unknown>>>([])
  const [importResult,setImportResult]=useState<ImportResult|null>(null)

  async function exportNow(){
    setBusy(true);setImportResult(null)
    try{
      const rows=await exportDataset(entityType);setPreview(rows.slice(0,5))
      const csv=toCsv(rows)
      if(!rows.length)return Alert.alert('Không có dữ liệu','Không có dòng nào để xuất.')
      await Share.share({title:`CEV-${entityType}-${new Date().toISOString().slice(0,10)}.csv`,message:csv})
    }catch(error){Alert.alert('Không xuất được dữ liệu',error instanceof Error?error.message:'Vui lòng thử lại.')}
    finally{setBusy(false)}
  }

  async function chooseImport(){
    try{
      const result=await DocumentPicker.getDocumentAsync({type:['text/csv','text/plain','application/json'],copyToCacheDirectory:true,multiple:false})
      if(result.canceled||!result.assets[0])return
      const asset=result.assets[0]
      const text=await readText(asset.uri)
      let rows:Array<Record<string,unknown>>
      if((asset.name||'').toLowerCase().endsWith('.json')||asset.mimeType==='application/json'){
        const parsed=JSON.parse(text); if(!Array.isArray(parsed))throw new Error('JSON phải là một mảng object.'); rows=parsed as Array<Record<string,unknown>>
      }else rows=parseCsv(text)
      if(!rows.length)return Alert.alert('Không có dòng dữ liệu','CSV/JSON không có dòng dữ liệu để import.')
      if(rows.length>500)return Alert.alert('Quá nhiều dòng','Mỗi lần import tối đa 500 dòng.')
      setPreview(rows.slice(0,5));setImportResult(null)
      Alert.alert('Xác nhận import',`${rows.length} dòng ${TYPES.find((x)=>x.id===entityType)?.label}. Dữ liệu hợp lệ sẽ ghi vào production CMMS.`,[
        {text:'Hủy',style:'cancel'},
        {text:'Import',onPress:()=>void applyImport(rows)},
      ])
    }catch(error){Alert.alert('Không đọc được file',error instanceof Error?error.message:'Vui lòng kiểm tra file CSV/JSON.')}
  }

  async function applyImport(rows:Array<Record<string,unknown>>){
    setBusy(true)
    try{const result=await importDataset(entityType,rows);setImportResult(result);Alert.alert('Import hoàn tất',`Thành công: ${result.successCount}\nLỗi: ${result.failedCount}`)}
    catch(error){Alert.alert('Import thất bại',error instanceof Error?error.message:'Vui lòng thử lại.')}
    finally{setBusy(false)}
  }

  return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.copy}><Text style={styles.title}>Nhập / Xuất dữ liệu</Text><Text style={styles.sub}>CSV / JSON · production CMMS</Text></View><View style={styles.icon}/></View>
    <ScrollView contentContainerStyle={styles.content}><Text style={styles.heading}>Loại dữ liệu</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>{TYPES.map((item)=><Pressable key={item.id} onPress={()=>{setEntityType(item.id);setPreview([]);setImportResult(null)}} style={[styles.pill,item.id===entityType&&styles.pillActive]}><Text style={[styles.pillText,item.id===entityType&&styles.pillTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
    <View style={styles.actions}><Pressable disabled={busy} onPress={()=>void exportNow()} style={styles.primary}><Ionicons name="share-outline" size={19} color="#FFF"/><Text style={styles.primaryText}>Xuất CSV</Text></Pressable><Pressable disabled={busy} onPress={()=>void chooseImport()} style={styles.secondary}><Ionicons name="cloud-upload-outline" size={19} color="#155EEF"/><Text style={styles.secondaryText}>Import CSV/JSON</Text></Pressable></View>
    {busy?<View style={styles.busy}><ActivityIndicator color="#155EEF"/><Text style={styles.muted}>Đang xử lý...</Text></View>:null}
    <View style={styles.info}><Ionicons name="shield-checkmark-outline" size={20} color="#175CD3"/><Text style={styles.infoText}>Import chỉ dành cho Manager/Admin, tối đa 500 dòng. Hệ thống gọi đúng RPC nghiệp vụ hiện có, không ghi thẳng bỏ qua validation.</Text></View>
    {entityType==='ASSET'?<View style={styles.warning}><Ionicons name="warning-outline" size={19} color="#B54708"/><Text style={styles.warningText}>Import Thiết bị bắt buộc 5 cột criticality: controlsProductQuality, specialCharacteristicImpact, stopsProduction, hasBackup, capacityImpact. Không có thì dòng bị từ chối, hệ thống không tự đoán.</Text></View>:null}
    {preview.length?<View style={styles.section}><Text style={styles.heading}>Preview {preview.length} dòng đầu</Text>{preview.map((row,index)=><View key={index} style={styles.previewCard}><Text style={styles.rowIndex}>#{index+1}</Text><Text style={styles.json} numberOfLines={5}>{JSON.stringify(row,null,2)}</Text></View>)}</View>:null}
    {importResult?<View style={styles.section}><Text style={styles.heading}>Kết quả import</Text><View style={styles.resultSummary}><Text style={styles.success}>✓ {importResult.successCount} thành công</Text><Text style={styles.failed}>✕ {importResult.failedCount} lỗi</Text></View>{importResult.items.filter((item)=>!item.ok).slice(0,20).map((item)=><View key={item.row} style={styles.errorRow}><Text style={styles.errorTitle}>Dòng {item.row}</Text><Text style={styles.errorText}>{item.error||'Không rõ lỗi'}</Text></View>)}</View>:null}
    </ScrollView></SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8FAFC'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},copy:{flex:1,alignItems:'center'},title:{fontSize:19,fontWeight:'900',color:'#101828'},sub:{fontSize:11,color:'#667085',marginTop:2},content:{padding:16,paddingBottom:36},heading:{fontSize:15,fontWeight:'900',color:'#344054',marginBottom:10},pills:{gap:8,paddingBottom:8},pill:{paddingHorizontal:12,paddingVertical:9,borderRadius:18,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},pillActive:{backgroundColor:'#155EEF',borderColor:'#155EEF'},pillText:{fontSize:12,fontWeight:'800',color:'#475467'},pillTextActive:{color:'#FFF'},actions:{marginTop:10,flexDirection:'row',gap:8},primary:{flex:1,minHeight:48,borderRadius:12,backgroundColor:'#155EEF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},primaryText:{fontSize:13,fontWeight:'900',color:'#FFF'},secondary:{flex:1,minHeight:48,borderRadius:12,borderWidth:1,borderColor:'#B2CCFF',backgroundColor:'#EEF4FF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},secondaryText:{fontSize:13,fontWeight:'900',color:'#155EEF'},busy:{marginTop:12,flexDirection:'row',gap:8,alignItems:'center'},muted:{fontSize:12,color:'#667085'},info:{marginTop:16,padding:12,borderRadius:12,backgroundColor:'#EFF8FF',flexDirection:'row',gap:8},infoText:{flex:1,fontSize:11.5,lineHeight:17,color:'#175CD3'},warning:{marginTop:10,padding:12,borderRadius:12,backgroundColor:'#FFFAEB',flexDirection:'row',gap:8},warningText:{flex:1,fontSize:11.5,lineHeight:17,color:'#B54708'},section:{marginTop:22},previewCard:{marginBottom:8,padding:10,borderRadius:10,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF',flexDirection:'row',gap:8},rowIndex:{fontSize:11,fontWeight:'900',color:'#667085'},json:{flex:1,fontSize:10.5,lineHeight:15,color:'#344054'},resultSummary:{padding:12,borderRadius:12,backgroundColor:'#FFF',borderWidth:1,borderColor:'#EAECF0',flexDirection:'row',justifyContent:'space-around'},success:{fontSize:13,fontWeight:'900',color:'#027A48'},failed:{fontSize:13,fontWeight:'900',color:'#B42318'},errorRow:{marginTop:8,padding:10,borderRadius:10,backgroundColor:'#FEF3F2'},errorTitle:{fontSize:11.5,fontWeight:'900',color:'#B42318'},errorText:{marginTop:3,fontSize:11,color:'#B42318'}})