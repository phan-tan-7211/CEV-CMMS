import { useState } from 'react'
import { DynamicCustomFieldsSection } from '../components/DynamicCustomFieldsSection'
import { saveEntityCustomValues, type CustomFieldDraftValue } from '../features/core-parity/api/coreParityService'
import { saveBusinessParty } from '../features/master-data'
import { MasterDataFormScreen } from './MasterDataFormScreen'

export function CompanyFormScreen({ onBack, customer = false }: { onBack: () => void; customer?: boolean }) {
  const [customValues,setCustomValues]=useState<CustomFieldDraftValue[]>([])
  const [customError,setCustomError]=useState('')
  const entityType=customer?'CUSTOMER':'VENDOR'
  return <MasterDataFormScreen
    title={customer ? 'Thêm khách hàng' : 'Thêm nhà cung cấp'}
    onBack={onBack}
    submitDisabled={Boolean(customError)}
    fields={[
      {key:'companyName',label:customer?'Tên khách hàng *':'Tên doanh nghiệp *',placeholder:'Nhập tên công ty',required:true},
      {key:'address',label:'Địa chỉ',placeholder:'Nhập địa chỉ'},
      {key:'phone',label:'Số điện thoại',placeholder:'Nhập số điện thoại'},
      {key:'email',label:'Email',placeholder:'Nhập email'},
      {key:'notes',label:'Ghi chú',placeholder:'Nhập ghi chú',multiline:true},
    ]}
    onSubmit={async (values) => {
      const saved=await saveBusinessParty({
        partyKind: customer ? 'CUSTOMER' : 'VENDOR',
        companyName: values.companyName,
        address: values.address,
        phone: values.phone,
        email: values.email,
        notes: values.notes,
      }) as Record<string,unknown>
      const partyId=String(saved.party_id||saved.partyId||'')
      if(customValues.length&&partyId)await saveEntityCustomValues(entityType,partyId,customValues)
      onBack()
    }}
  >
    <DynamicCustomFieldsSection entityType={entityType} values={customValues} onChange={setCustomValues} onValidationChange={setCustomError}/>
  </MasterDataFormScreen>
}