import { saveBusinessParty } from '../features/master-data'
import { MasterDataFormScreen } from './MasterDataFormScreen'

export function CompanyFormScreen({ onBack, customer = false }: { onBack: () => void; customer?: boolean }) {
  return <MasterDataFormScreen
    title={customer ? 'Thêm khách hàng' : 'Thêm nhà cung cấp'}
    onBack={onBack}
    fields={[
      {key:'companyName',label:customer?'Tên khách hàng *':'Tên doanh nghiệp *',placeholder:'Nhập tên công ty',required:true},
      {key:'address',label:'Địa chỉ',placeholder:'Nhập địa chỉ'},
      {key:'phone',label:'Số điện thoại',placeholder:'Nhập số điện thoại'},
      {key:'email',label:'Email',placeholder:'Nhập email'},
      {key:'notes',label:'Ghi chú',placeholder:'Nhập ghi chú',multiline:true},
    ]}
    onSubmit={async (values) => {
      await saveBusinessParty({
        partyKind: customer ? 'CUSTOMER' : 'VENDOR',
        companyName: values.companyName,
        address: values.address,
        phone: values.phone,
        email: values.email,
        notes: values.notes,
      })
      onBack()
    }}
  />
}
