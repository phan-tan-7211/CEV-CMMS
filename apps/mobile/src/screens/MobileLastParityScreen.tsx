import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  createTag,
  loadMobileLastParity,
  saveAssetFinancialProfile,
  saveChecklistRule,
  setEntityTag,
  setSignatureRequirement,
  signWorkOrder,
  type AssetFinancialProfile,
  type ChecklistRule,
  type MobileLastParitySnapshot,
} from '../features/mobile-last-parity/api/mobileLastParityService'

type Tab = 'signature' | 'checklist' | 'asset' | 'tags'
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'signature', label: 'Signature' },
  { id: 'checklist', label: 'Checklist Rules' },
  { id: 'asset', label: 'Asset Life' },
  { id: 'tags', label: 'Tags / Sets' },
]

function Btn({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.btn, secondary && styles.btnSecondary, disabled && styles.disabled]}><Text style={[styles.btnText, secondary && styles.btnTextSecondary]}>{label}</Text></Pressable>
}
function Pills({ values, selected, onSelect }: { values: Array<{ id: string; label: string }>; selected: string; onSelect: (id: string) => void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>{values.map((x) => <Pressable key={x.id} onPress={() => onSelect(x.id)} style={[styles.pill, x.id === selected && styles.pillActive]}><Text style={[styles.pillText, x.id === selected && styles.pillTextActive]}>{x.label}</Text></Pressable>)}</ScrollView>
}

export function MobileLastParityScreen({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('signature')
  const [data, setData] = useState<MobileLastParitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  async function load() { setLoading(true); try { setData(await loadMobileLastParity()) } catch (e) { Alert.alert('Mobile parity', e instanceof Error ? e.message : 'Không tải được dữ liệu.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  return <SafeAreaView style={styles.safe} edges={['top','bottom']}><View style={styles.header}><Pressable onPress={onBack} style={styles.icon}><Ionicons name="chevron-back" size={26} color="#101828"/></Pressable><View style={styles.copy}><Text style={styles.title}>UpKeep parity cuối</Text><Text style={styles.sub}>Signature · Checklist rules · Asset life · Tags</Text></View><Pressable onPress={() => void load()} style={styles.icon}><Ionicons name="refresh" size={21} color="#344054"/></Pressable></View><Pills values={TABS} selected={tab} onSelect={(x) => setTab(x as Tab)}/>{loading ? <View style={styles.center}><ActivityIndicator size="large" color="#155EEF"/></View> : null}{!loading && tab === 'signature' ? <SignaturePanel data={data} reload={load}/> : null}{!loading && tab === 'checklist' ? <ChecklistRulesPanel data={data} reload={load}/> : null}{!loading && tab === 'asset' ? <AssetLifePanel data={data} reload={load}/> : null}{!loading && tab === 'tags' ? <TagsPanel data={data} reload={load}/> : null}</SafeAreaView>
}

function SignaturePanel({ data, reload }: { data: MobileLastParitySnapshot | null; reload: () => Promise<void> }) {
  const workOrders = data?.workOrders || []
  const [id, setId] = useState(workOrders[0]?.id || '')
  const [name, setName] = useState('')
  const [role, setRole] = useState('TECHNICIAN')
  const [signature, setSignature] = useState('')
  useEffect(() => { if (!id && workOrders[0]) setId(workOrders[0].id) }, [id, workOrders])
  const wo = workOrders.find((x) => x.id === id)
  async function saveSignature() { if (!id || !name.trim() || !signature.trim()) return Alert.alert('Thiếu chữ ký', 'Nhập tên người ký và nội dung chữ ký.'); try { await signWorkOrder({ workOrderId:id, signerName:name.trim(), signerRole:role, signatureText:signature.trim() }); setSignature(''); await reload() } catch (e) { Alert.alert('Signature', e instanceof Error ? e.message : 'Không lưu được chữ ký.') } }
  return <ScrollView contentContainerStyle={styles.body}><Text style={styles.sectionTitle}>Work Order Signature</Text><Text style={styles.muted}>Bật yêu cầu chữ ký và lưu xác nhận có timestamp cho Work Order.</Text><Pills values={workOrders.slice(0,50).map((x)=>({id:x.id,label:x.id}))} selected={id} onSelect={setId}/>{wo ? <View style={styles.card}><Text style={styles.cardTitle}>{wo.id}</Text><Text style={styles.muted}>{wo.status} · {wo.reason || 'Không mô tả'}</Text><Pressable onPress={() => void setSignatureRequirement(wo.id,!wo.signatureRequired).then(reload)}><Text style={styles.toggle}>{wo.signatureRequired ? '✓ Bắt buộc chữ ký' : '○ Không bắt buộc chữ ký'}</Text></Pressable><TextInput style={styles.input} placeholder="Tên người ký *" value={name} onChangeText={setName}/><TextInput style={styles.input} placeholder="Vai trò" value={role} onChangeText={setRole}/><TextInput style={[styles.input,styles.signatureInput]} placeholder="Ký/xác nhận tại đây *" value={signature} onChangeText={setSignature} multiline/><Btn label="Lưu chữ ký" onPress={() => void saveSignature()}/>{wo.signatures.map((s)=><View key={s.id} style={styles.subCard}><Text style={styles.cardTitle}>{s.name}</Text><Text style={styles.muted}>{s.role || '—'} · {new Date(s.signedAt).toLocaleString('vi-VN')}</Text><Text style={styles.signatureText}>{s.text}</Text></View>)}</View> : <Text style={styles.empty}>Chưa có Work Order.</Text>}</ScrollView>
}

function ChecklistRulesPanel({ data, reload }: { data: MobileLastParitySnapshot | null; reload: () => Promise<void> }) {
  const rows = data?.checklistRules || []
  const [selectedId,setSelectedId]=useState(rows[0]?.templateItemId||'')
  useEffect(()=>{if(!selectedId&&rows[0])setSelectedId(rows[0].templateItemId)},[rows,selectedId])
  const row=rows.find(x=>x.templateItemId===selectedId)
  const [locked,setLocked]=useState(false); const [restrictedRole,setRestrictedRole]=useState(''); const [conditionItemId,setConditionItemId]=useState(''); const [operator,setOperator]=useState('EQUALS'); const [value,setValue]=useState('')
  useEffect(()=>{if(row){setLocked(row.locked);setRestrictedRole(row.restrictedRole||'');setConditionItemId(row.conditionItemId||'');setOperator(row.conditionOperator||'EQUALS');setValue(row.conditionValue||'')}},[row])
  async function save(){if(!row)return;try{await saveChecklistRule({templateItemId:row.templateItemId,locked,restrictedRole,conditionItemId,conditionOperator:conditionItemId?operator:'',conditionValue:conditionItemId?value:''});await reload()}catch(e){Alert.alert('Checklist rule',e instanceof Error?e.message:'Không lưu được rule.')}}
  return <ScrollView contentContainerStyle={styles.body}><Text style={styles.sectionTitle}>Conditional / Locked Tasks</Text><Pills values={rows.slice(0,80).map(x=>({id:x.templateItemId,label:x.label}))} selected={selectedId} onSelect={setSelectedId}/>{row?<View style={styles.card}><Text style={styles.cardTitle}>{row.label}</Text><Pressable onPress={()=>setLocked(v=>!v)}><Text style={styles.toggle}>{locked?'✓ Locked / Restricted':'○ Không khóa'}</Text></Pressable><TextInput style={styles.input} value={restrictedRole} onChangeText={setRestrictedRole} placeholder="Role được phép, ví dụ QUALITY"/><Text style={styles.label}>Hiện task khi task khác thỏa điều kiện</Text><Pills values={[{id:'',label:'Không điều kiện'},...rows.filter(x=>x.templateId===row.templateId&&x.templateItemId!==row.templateItemId).map(x=>({id:x.templateItemId,label:x.label}))]} selected={conditionItemId} onSelect={setConditionItemId}/>{conditionItemId?<><Pills values={['EQUALS','NOT_EQUALS','GT','GTE','LT','LTE','CONTAINS'].map(x=>({id:x,label:x}))} selected={operator} onSelect={setOperator}/><TextInput style={styles.input} value={value} onChangeText={setValue} placeholder="Giá trị điều kiện"/></>:null}<Btn label="Lưu rule" onPress={()=>void save()}/></View>:<Text style={styles.empty}>Chưa có checklist item.</Text>}</ScrollView>
}

function AssetLifePanel({ data, reload }: { data: MobileLastParitySnapshot | null; reload: () => Promise<void> }) {
  const equipment=data?.equipment||[]; const [id,setId]=useState(equipment[0]?.id||''); useEffect(()=>{if(!id&&equipment[0])setId(equipment[0].id)},[equipment,id]); const row=equipment.find(x=>x.id===id)
  const [profile,setProfile]=useState<Record<string,string>>({});
  useEffect(()=>{const p=row?.profile;setProfile({purchaseDate:p?.purchaseDate||'',purchaseCost:p?.purchaseCost?.toString()||'',warrantyExpiry:p?.warrantyExpiry||'',usefulLifeMonths:p?.usefulLifeMonths?.toString()||'',salvageValue:p?.salvageValue?.toString()||'',depreciationMethod:p?.depreciationMethod||'STRAIGHT_LINE',replacementTargetDate:p?.replacementTargetDate||''})},[row])
  const set=(k:string,v:string)=>setProfile(s=>({...s,[k]:v}));
  async function save(){if(!id)return;const payload:AssetFinancialProfile={purchaseDate:profile.purchaseDate||null,purchaseCost:profile.purchaseCost?Number(profile.purchaseCost):null,warrantyExpiry:profile.warrantyExpiry||null,usefulLifeMonths:profile.usefulLifeMonths?Number(profile.usefulLifeMonths):null,salvageValue:profile.salvageValue?Number(profile.salvageValue):null,depreciationMethod:profile.depreciationMethod||'STRAIGHT_LINE',replacementTargetDate:profile.replacementTargetDate||null};try{await saveAssetFinancialProfile(id,payload);await reload()}catch(e){Alert.alert('Asset lifecycle',e instanceof Error?e.message:'Không lưu được.')}}
  return <ScrollView contentContainerStyle={styles.body}><Text style={styles.sectionTitle}>Warranty · Useful Life · Depreciation</Text><Pills values={equipment.slice(0,100).map(x=>({id:x.id,label:x.name||x.id}))} selected={id} onSelect={setId}/>{row?<View style={styles.card}>{[['purchaseDate','Ngày mua YYYY-MM-DD'],['purchaseCost','Giá mua'],['warrantyExpiry','Hết bảo hành YYYY-MM-DD'],['usefulLifeMonths','Tuổi thọ (tháng)'],['salvageValue','Giá trị thu hồi'],['replacementTargetDate','Ngày dự kiến thay YYYY-MM-DD']].map(([k,p])=><TextInput key={k} style={styles.input} value={profile[k]||''} onChangeText={v=>set(k,v)} placeholder={p}/>) }<Pills values={['STRAIGHT_LINE','DECLINING_BALANCE','NONE'].map(x=>({id:x,label:x}))} selected={profile.depreciationMethod||'STRAIGHT_LINE'} onSelect={v=>set('depreciationMethod',v)}/><Btn label="Lưu vòng đời tài sản" onPress={()=>void save()}/></View>:null}</ScrollView>
}

function TagsPanel({ data, reload }: { data: MobileLastParitySnapshot | null; reload: () => Promise<void> }) {
  const [name,setName]=useState(''); const [color,setColor]=useState('#155EEF'); const [entityType,setEntityType]=useState<'ASSET'|'WORK_ORDER'>('ASSET');
  const targets=entityType==='ASSET'?(data?.equipment||[]).map(x=>({id:x.id,label:x.name||x.id})):(data?.workOrders||[]).map(x=>({id:x.id,label:x.id})); const [entityId,setEntityId]=useState(''); useEffect(()=>{if(targets[0]&&!targets.some(x=>x.id===entityId))setEntityId(targets[0].id)},[targets,entityId]);
  async function add(){if(!name.trim())return;try{await createTag(name.trim(),color.trim());setName('');await reload()}catch(e){Alert.alert('Tags',e instanceof Error?e.message:'Không tạo được tag.')}}
  const assigned=new Set((data?.entityTags||[]).filter(x=>x.entityType===entityType&&x.entityId===entityId).map(x=>x.tagId));
  return <ScrollView contentContainerStyle={styles.body}><Text style={styles.sectionTitle}>Tags / Sets</Text><View style={styles.card}><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tên tag *"/><TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="#155EEF"/><Btn label="Tạo tag" onPress={()=>void add()}/></View><Pills values={[{id:'ASSET',label:'Asset'},{id:'WORK_ORDER',label:'Work Order'}]} selected={entityType} onSelect={x=>setEntityType(x as 'ASSET'|'WORK_ORDER')}/><Pills values={targets.slice(0,100)} selected={entityId} onSelect={setEntityId}/>{(data?.tags||[]).map(tag=><Pressable key={tag.id} onPress={()=>void setEntityTag({entityType,entityId,tagId:tag.id,enabled:!assigned.has(tag.id)}).then(reload)} style={[styles.tagRow,assigned.has(tag.id)&&styles.tagRowActive]}><View style={[styles.dot,{backgroundColor:tag.color||'#98A2B3'}]}/><View style={{flex:1}}><Text style={styles.cardTitle}>{tag.name}</Text><Text style={styles.muted}>{tag.usageCount} liên kết</Text></View><Ionicons name={assigned.has(tag.id)?'checkmark-circle':'ellipse-outline'} size={22} color={assigned.has(tag.id)?'#027A48':'#98A2B3'}/></Pressable>)}</ScrollView>
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#FFF'},header:{minHeight:64,flexDirection:'row',alignItems:'center',paddingHorizontal:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#EAECF0'},icon:{width:42,height:42,alignItems:'center',justifyContent:'center'},copy:{flex:1},title:{fontSize:20,fontWeight:'900',color:'#101828'},sub:{fontSize:12,color:'#667085',marginTop:2},pills:{gap:8,paddingHorizontal:14,paddingVertical:10},pill:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'#F2F4F7'},pillActive:{backgroundColor:'#155EEF'},pillText:{fontSize:13,fontWeight:'700',color:'#344054'},pillTextActive:{color:'#FFF'},center:{flex:1,alignItems:'center',justifyContent:'center'},body:{padding:14,paddingBottom:40,gap:12},sectionTitle:{fontSize:21,fontWeight:'900',color:'#101828'},muted:{fontSize:13,color:'#667085'},card:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#EAECF0',borderRadius:14,padding:14,gap:10},subCard:{backgroundColor:'#F9FAFB',borderRadius:10,padding:10,gap:3},cardTitle:{fontSize:15,fontWeight:'800',color:'#101828'},input:{borderWidth:1,borderColor:'#D0D5DD',borderRadius:10,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:'#101828',backgroundColor:'#FFF'},signatureInput:{minHeight:88,textAlignVertical:'top',fontSize:20,fontStyle:'italic'},signatureText:{fontSize:20,fontStyle:'italic',color:'#101828',marginTop:6},btn:{backgroundColor:'#155EEF',paddingHorizontal:14,paddingVertical:11,borderRadius:10,alignItems:'center'},btnSecondary:{backgroundColor:'#FFF',borderWidth:1,borderColor:'#D0D5DD'},btnText:{fontWeight:'800',color:'#FFF'},btnTextSecondary:{color:'#344054'},disabled:{opacity:.45},toggle:{fontSize:14,fontWeight:'800',color:'#155EEF',paddingVertical:6},label:{fontSize:13,fontWeight:'700',color:'#344054'},empty:{padding:20,textAlign:'center',color:'#667085'},tagRow:{flexDirection:'row',alignItems:'center',gap:10,borderWidth:1,borderColor:'#EAECF0',borderRadius:12,padding:12,backgroundColor:'#FFF'},tagRowActive:{borderColor:'#12B76A',backgroundColor:'#ECFDF3'},dot:{width:14,height:14,borderRadius:7}})
