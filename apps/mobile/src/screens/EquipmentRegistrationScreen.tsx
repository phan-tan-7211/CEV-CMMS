import { useState } from 'react'
import { RegistrationScreen } from '../../App'
import { EntityCustomFieldsScreen } from './EntityCustomFieldsScreen'

/**
 * Dedicated route boundary for equipment registration.
 * After the base registration succeeds, configurable ASSET fields are captured
 * before the shell opens the new equipment detail.
 */
export function EquipmentRegistrationScreen({ onBack, initialBarcode, onCreated }: { onBack: () => void; initialBarcode?: string; onCreated?: (equipmentId: string) => void }) {
  const [createdEquipmentId,setCreatedEquipmentId]=useState('')
  if(createdEquipmentId) return <EntityCustomFieldsScreen entityType="ASSET" entityId={createdEquipmentId} title="Thông tin bổ sung thiết bị" onBack={()=>onCreated?.(createdEquipmentId)} onDone={()=>onCreated?.(createdEquipmentId)}/>
  return <RegistrationScreen onBack={onBack} initialBarcode={initialBarcode} onCreated={(equipmentId)=>setCreatedEquipmentId(equipmentId)} />
}