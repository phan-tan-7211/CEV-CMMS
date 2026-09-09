import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import {
  listCustomFields,
  listEntityCustomValues,
  type CustomFieldDefinition,
  type CustomFieldDraftValue,
} from '../features/core-parity/api/coreParityService'

type Props = {
  entityType: string
  entityId?: string
  values: CustomFieldDraftValue[]
  onChange: (values: CustomFieldDraftValue[]) => void
  disabled?: boolean
  compact?: boolean
}

function normalizeStoredValue(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map((item) => String(item))
  return String(value)
}

export function validateCustomFieldValues(definitions: CustomFieldDefinition[], values: CustomFieldDraftValue[]) {
  const map = new Map(values.map((item) => [item.fieldId, item.value]))
  const missing = definitions.find((field) => {
    if (!field.required) return false
    const value = map.get(field.fieldId)
    if (Array.isArray(value)) return value.length === 0
    if (typeof value === 'boolean') return false
    return String(value ?? '').trim() === ''
  })
  return missing ? `${missing.label} là bắt buộc.` : ''
}

export function DynamicCustomFieldsSection({ entityType, entityId = '', values, onChange, disabled = false, compact = false }: Props) {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const loader = entityId.trim() ? listEntityCustomValues(entityType, entityId.trim()) : listCustomFields(entityType)
    void loader.then((rows) => {
      if (!active) return
      const defs = rows.map((row) => ({
        fieldId: row.fieldId,
        entityType: row.entityType,
        label: row.label,
        fieldType: row.fieldType,
        required: row.required,
        choices: Array.isArray(row.choices) ? row.choices : [],
        sortOrder: row.sortOrder,
      }))
      setDefinitions(defs)
      if (entityId.trim()) {
        const withValue = rows as Array<CustomFieldDefinition & { value?: unknown }>
        const initial = withValue.filter((row) => row.value !== null && row.value !== undefined).map((row) => ({ fieldId: row.fieldId, value: normalizeStoredValue(row.value) }))
        onChange(initial)
      }
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không tải được custom fields.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [entityId, entityType])

  const byId = useMemo(() => new Map(values.map((item) => [item.fieldId, item.value])), [values])

  function patch(fieldId: string, value: unknown) {
    const next = values.filter((item) => item.fieldId !== fieldId)
    onChange([...next, { fieldId, value }])
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator size="small" color="#155EEF"/><Text style={styles.muted}>Đang tải trường tùy chỉnh...</Text></View>
  if (error) return <View style={styles.error}><Ionicons name="alert-circle-outline" size={18} color="#B42318"/><Text style={styles.errorText}>{error}</Text></View>
  if (!definitions.length) return null

  return <View style={[styles.section, compact && styles.sectionCompact]}>
    <View style={styles.heading}><View style={styles.headingIcon}><Ionicons name="options-outline" size={18} color="#6941C6"/></View><View style={styles.headingCopy}><Text style={styles.title}>Trường tùy chỉnh</Text><Text style={styles.subtitle}>{definitions.length} trường theo cấu hình CMMS</Text></View></View>
    {definitions.map((field) => {
      const current = byId.get(field.fieldId)
      const label = `${field.label}${field.required ? ' *' : ''}`
      if (field.fieldType === 'BOOLEAN') {
        const checked = Boolean(current)
        return <Pressable key={field.fieldId} disabled={disabled} onPress={() => patch(field.fieldId, !checked)} style={styles.booleanRow}>
          <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? '#155EEF' : '#98A2B3'}/><Text style={styles.booleanLabel}>{label}</Text>
        </Pressable>
      }
      if (field.fieldType === 'SELECT') {
        return <View key={field.fieldId} style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.choiceWrap}>{field.choices.map((choice) => <Pressable key={choice} disabled={disabled} onPress={() => patch(field.fieldId, choice)} style={[styles.choice, current === choice && styles.choiceActive]}><Text style={[styles.choiceText, current === choice && styles.choiceTextActive]}>{choice}</Text></Pressable>)}</View></View>
      }
      if (field.fieldType === 'MULTI_SELECT') {
        const selected = Array.isArray(current) ? current.map(String) : []
        return <View key={field.fieldId} style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.choiceWrap}>{field.choices.map((choice) => { const active = selected.includes(choice); return <Pressable key={choice} disabled={disabled} onPress={() => patch(field.fieldId, active ? selected.filter((item) => item !== choice) : [...selected, choice])} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice}</Text></Pressable> })}</View></View>
      }
      return <View key={field.fieldId} style={styles.field}><Text style={styles.label}>{label}</Text><TextInput editable={!disabled} value={String(current ?? '')} onChangeText={(value) => patch(field.fieldId, field.fieldType === 'NUMBER' ? value : value)} keyboardType={field.fieldType === 'NUMBER' ? 'decimal-pad' : 'default'} placeholder={field.fieldType === 'DATE' ? 'YYYY-MM-DD' : `Nhập ${field.label.toLowerCase()}`} placeholderTextColor="#98A2B3" style={styles.input}/></View>
    })}
  </View>
}

const styles = StyleSheet.create({
  section:{marginTop:18,padding:14,borderRadius:16,borderWidth:1,borderColor:'#E9D7FE',backgroundColor:'#FCFAFF'},
  sectionCompact:{marginTop:10},
  heading:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14},
  headingIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:'#F4EBFF'},
  headingCopy:{flex:1},title:{fontSize:14,fontWeight:'900',color:'#344054'},subtitle:{marginTop:2,fontSize:11,color:'#667085'},
  field:{marginBottom:14},label:{marginBottom:7,fontSize:12.5,fontWeight:'800',color:'#344054'},
  input:{minHeight:46,paddingHorizontal:12,borderRadius:10,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF',fontSize:14,color:'#101828'},
  booleanRow:{minHeight:46,marginBottom:8,paddingHorizontal:4,flexDirection:'row',alignItems:'center',gap:9},booleanLabel:{fontSize:13,fontWeight:'700',color:'#344054'},
  choiceWrap:{flexDirection:'row',flexWrap:'wrap',gap:7},choice:{paddingHorizontal:11,paddingVertical:8,borderRadius:18,borderWidth:1,borderColor:'#D0D5DD',backgroundColor:'#FFF'},choiceActive:{borderColor:'#155EEF',backgroundColor:'#EEF4FF'},choiceText:{fontSize:12,fontWeight:'700',color:'#475467'},choiceTextActive:{color:'#155EEF'},
  loading:{minHeight:48,marginTop:12,flexDirection:'row',alignItems:'center',gap:8},muted:{fontSize:12,color:'#667085'},
  error:{marginTop:12,padding:10,flexDirection:'row',gap:8,borderRadius:10,backgroundColor:'#FEF3F2'},errorText:{flex:1,fontSize:12,color:'#B42318'},
})