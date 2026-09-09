import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { SafeAreaView } from 'react-native-safe-area-context'
import { listLibraryFiles, registerLibraryFile, uploadFileArtifact, type LibraryFile } from '../features/core-parity/api/coreParityService'

const LINK_TYPES=['','ASSET','WORK_ORDER','PART','LOCATION'] as const
export function FilesLibraryScreen({onBack}:{onBack:()=>void}){
  const [rows,setRows]=useState<LibraryFile[]>([])
  const [search,setSearch]=useState('')
  const [busy,setBusy]=useState(false)
  const [linkType,setLinkType]=useState<string>('')
  const [linkId,setLinkId]=useState('')
  async function load(){try{setRows(await listLibraryFiles())}catch(e){Alert.alert('Files',e instanceof Error?e.message:'Không tải được Files Library.')}}
  useEffect(()=>{void load()},[])
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return q?rows.filter((row)=>`${row.fileName} ${row.mimeType} ${row.tags.join(' ')}`.toLowerCase().includes(q)):rows},[rows,search])
  async function upload(){
    try{
      const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true,multiple:false})
      if(result.canceled||!result.assets[0])return
      if(linkType&&!linkId.trim())return Alert.alert('Thiếu mã liên kết',`Nhập ID ${linkType} hoặc bỏ chọn liên kết.`)
      const asset=result.assets[0];setBusy(true)
      const mime=asset.mimeType||'application/octet-stream'
      const uploaded=await uploadFileArtifact(asset.uri,'files',asset.name||`file-${Date.now()}`,mime)
      await registerLibraryFile({fileName:asset.name||`file-${Date.now()}`,bucket:uploaded.bucket,path:uploaded.path,mimeType:mime,size:asset.size||uploaded.size,tags:['mobile'],entityType:linkType||undefined,entityId:linkType?linkId.trim():undefined})
      await load();Alert.alert('Đã upload',asset.name||'Tệp')
    }catch(e){Alert.alert('Upload lỗi',e instanceof Error?e.message:'Không upload được file.')}
    finally{setBusy(false)}
  }
  return <SafeAreaView style={styles.safe}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.copy}><Text style={styles.title}>Files Library</Text><Text style={styles.sub}>Ảnh · PDF · Excel · CSV · tài liệu</Text></View><Pressable onPress={()=>void load()} style={styles.icon}><Ionicons name="refresh" size={21} color="#344054"/></Pressable></View><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.uploadCard}><Text style={styles.cardTitle}>Upload tài liệu</Text><Text style={styles.helper}>Có thể liên kết ngay với Asset / Work Order / Part / Location.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>{LINK_TYPES.map((type)=><Pressable key={type||'NONE'} onPress={()=>setLinkType(type)} style={[styles.pill,type===linkType&&styles.pillActive]}><Text style={[styles.pillText,type===linkType&&styles.pillTextActive]}>{type||'Không liên kết'}</Text></Pressable>)}</ScrollView>{linkType?<TextInput value={linkId} onChangeText={setLinkId} placeholder={`ID ${linkType}`} placeholderTextColor="#98A2B3" style={styles.input}/>:null}<Pressable disabled={busy} onPress={()=>void upload()} style={[styles.upload,busy&&styles.disabled]}>{busy?<ActivityIndicator color="#FFF"/>:<><Ionicons name="cloud-upload-outline" size={20} color="#FFF"/><Text style={styles.uploadText}>Chọn & upload file</Text></>}</Pressable></View>
    <View style={styles.search}><Ionicons name="search" size={18} color="#667085"/><TextInput value={search} onChangeText={setSearch} placeholder="Tìm tên file, loại file, tag" placeholderTextColor="#98A2B3" style={styles.searchInput}/></View>
    <Text style={styles.count}>{filtered.length} file</Text>{filtered.map((row)=><View key={row.fileId} style={styles.fileCard}><View style={styles.fileIcon}><Ionicons name={row.mimeType.includes('image')?'image-outline':row.mimeType.includes('pdf')?'document-text-outline':'document-attach-outline'} size={23} color="#155EEF"/></View><View style={styles.flex}><Text style={styles.fileName}>{row.fileName}</Text><Text style={styles.meta}>{row.mimeType||'file'}{row.size?` · ${Math.round(row.size/1024)} KB`:''} · {row.links.length} liên kết</Text>{row.links.slice(0,3).map((link,index)=><Text key={`${link.entityType}-${link.entityId}-${index}`} style={styles.link}>{link.entityType}: {link.entityId}</Text>)}</View></View>)}{!filtered.length?<View style={styles.empty}><Ionicons name="folder-open-outline" size={36} color="#98A2B3"/><Text style={styles.meta}>Chưa có file phù hợp.</Text></View>:null}
  </ScrollView></SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#F8FAFC'},header:{minHeight:64,paddingHorizontal:8,flexDirection:'row',alignItems:'center',backgroundColor:'#FFF',borderBottomWidth:1,borderBottomColor:'#EAECF0'},icon:{width:46,height:46,alignItems:'center',justifyContent:'center'},copy:{flex:1,alignItems:'center'},title:{fontSize:19,fontWeight:'900',color:'#101828'},sub:{fontSize:11,color:'#667085',marginTop:2},content:{padding:14,paddingBottom:36},uploadCard:{padding:14,borderRadius:14,borderWidth:1,borderColor:'#B2CCFF',backgroundColor:'#EEF4FF'},cardTitle:{fontSize:15,fontWeight:'900',color:'#344054'},helper:{marginTop:3,fontSize:11.5,lineHeight:17,color:'#667085'},pills:{gap:7,paddingVertical:10},pill:{paddingHorizontal:10,paddingVertical:8,borderRadius:17,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},pillActive:{borderColor:'#155EEF',backgroundColor:'#D1E0FF'},pillText:{fontSize:11,fontWeight:'800',color:'#475467'},pillTextActive:{color:'#155EEF'},input:{minHeight:44,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',color:'#101828'},upload:{marginTop:10,minHeight:46,borderRadius:12,backgroundColor:'#155EEF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},uploadText:{fontSize:13,fontWeight:'900',color:'#FFF'},disabled:{opacity:.55},search:{marginTop:14,minHeight:46,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:8,borderRadius:11,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},searchInput:{flex:1,color:'#101828'},count:{marginVertical:10,fontSize:12,fontWeight:'800',color:'#667085'},fileCard:{marginBottom:8,padding:12,flexDirection:'row',gap:10,borderRadius:13,borderWidth:1,borderColor:'#EAECF0',backgroundColor:'#FFF'},fileIcon:{width:42,height:42,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#EEF4FF'},flex:{flex:1,minWidth:0},fileName:{fontSize:13.5,fontWeight:'900',color:'#344054'},meta:{marginTop:3,fontSize:10.5,color:'#667085'},link:{marginTop:3,fontSize:10.5,fontWeight:'700',color:'#6941C6'},empty:{minHeight:150,alignItems:'center',justifyContent:'center',gap:8}})