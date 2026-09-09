import { useCallback, useState } from 'react'
import { DynamicCustomFieldsSection } from '../components/DynamicCustomFieldsSection'
import { LocationParentPickerModal } from '../components/LocationParentPickerModal'
import { saveEntityCustomValues, type CustomFieldDraftValue } from '../features/core-parity/api/coreParityService'
import { listLocations, saveLocation, type LocationPickerItem } from '../features/master-data'
import { MasterDataFormScreen } from './MasterDataFormScreen'

export function LocationFormScreen({ onBack }: { onBack: () => void }) {
  const [pickerOpen,setPickerOpen]=useState(false)
  const [parent,setParent]=useState<LocationPickerItem|null>(null)
  const [customValues,setCustomValues]=useState<CustomFieldDraftValue[]>([])
  const [customError,setCustomError]=useState('')
  const loadChildren=useCallback((parentId:string|null)=>listLocations({parentId}),[])
  return <>
    <MasterDataFormScreen
      title="Thêm vị trí"
      onBack={onBack}
      submitDisabled={Boolean(customError)}
      fields={[
        {key:'name',label:'Tên vị trí *',placeholder:'Nhập tên vị trí',required:true},
        {key:'parent',label:'Vị trí cha',placeholder:'Chọn vị trí cha',displayValue:parent?.name,onPress:()=>setPickerOpen(true)},
        {key:'address',label:'Địa chỉ',placeholder:'Nhập địa chỉ'},
        {key:'description',label:'Mô tả',placeholder:'Nhập mô tả',multiline:true},
      ]}
      onSubmit={async (values) => {
        const saved=await saveLocation({ name: values.name, parentLocationId: parent?.id || null, address: values.address, description: values.description }) as Record<string,unknown>
        const locationId=String(saved.location_id||saved.locationId||'')
        if(customValues.length&&locationId)await saveEntityCustomValues('LOCATION',locationId,customValues)
        onBack()
      }}
    >
      <DynamicCustomFieldsSection entityType="LOCATION" values={customValues} onChange={setCustomValues} onValidationChange={setCustomError}/>
    </MasterDataFormScreen>
    <LocationParentPickerModal visible={pickerOpen} loadChildren={loadChildren} onClose={()=>setPickerOpen(false)} onSelect={(item)=>{setParent(item);setPickerOpen(false)}}/>
  </>
}