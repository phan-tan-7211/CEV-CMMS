import { useCallback, useState } from 'react'
import { LocationParentPickerModal } from '../components/LocationParentPickerModal'
import { listLocations, saveLocation, type LocationPickerItem } from '../features/master-data'
import { MasterDataFormScreen } from './MasterDataFormScreen'

export function LocationFormScreen({ onBack }: { onBack: () => void }) {
  const [pickerOpen,setPickerOpen]=useState(false)
  const [parent,setParent]=useState<LocationPickerItem|null>(null)
  const loadChildren=useCallback((parentId:string|null)=>listLocations({parentId}),[])
  return <>
    <MasterDataFormScreen
      title="Thêm vị trí"
      onBack={onBack}
      fields={[
        {key:'name',label:'Tên vị trí *',placeholder:'Nhập tên vị trí',required:true},
        {key:'parent',label:'Vị trí cha',placeholder:'Chọn vị trí cha',displayValue:parent?.name,onPress:()=>setPickerOpen(true)},
        {key:'address',label:'Địa chỉ',placeholder:'Nhập địa chỉ'},
        {key:'description',label:'Mô tả',placeholder:'Nhập mô tả',multiline:true},
      ]}
      onSubmit={async (values) => {
        await saveLocation({ name: values.name, parentLocationId: parent?.id || null, address: values.address, description: values.description })
        onBack()
      }}
    />
    <LocationParentPickerModal visible={pickerOpen} loadChildren={loadChildren} onClose={()=>setPickerOpen(false)} onSelect={(item)=>{setParent(item);setPickerOpen(false)}}/>
  </>
}
