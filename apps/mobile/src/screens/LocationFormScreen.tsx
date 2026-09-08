import { saveLocation } from '../features/master-data'
import { MasterDataFormScreen } from './MasterDataFormScreen'

export function LocationFormScreen({ onBack }: { onBack: () => void }) {
  return <MasterDataFormScreen
    title="Thêm vị trí"
    onBack={onBack}
    fields={[
      {key:'name',label:'Tên vị trí *',placeholder:'Nhập tên vị trí',required:true},
      {key:'address',label:'Địa chỉ',placeholder:'Nhập địa chỉ'},
      {key:'description',label:'Mô tả',placeholder:'Nhập mô tả',multiline:true},
    ]}
    onSubmit={async (values) => {
      await saveLocation({ name: values.name, address: values.address, description: values.description })
      onBack()
    }}
  />
}
