import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { deriveEquipmentCriticality } from '../../data/autoRegistration'
import { checkEquipmentDeletion, deleteUnusedEquipment } from '../../data/equipmentDeletion'
import { updateEquipmentDetails, type EquipmentMasterEditInput } from '../../data/equipmentMasterEdit'
import type { LiveEquipment } from '../../data/liveEquipment'
import { mergeDraftIntoRow, toDraft } from './equipmentRowMappers'

type UseEquipmentEditingOptions = {
  rows: LiveEquipment[]
  setRows: Dispatch<SetStateAction<LiveEquipment[]>>
  setMessage: Dispatch<SetStateAction<string>>
  reloadEquipment: (force?: boolean) => Promise<void>
  removeEquipmentPhotoState: (equipmentId: string) => void
}

export function useEquipmentEditing({ rows, setRows, setMessage, reloadEquipment, removeEquipmentPhotoState }: UseEquipmentEditingOptions) {
  const [editing,setEditing]=useState<EquipmentMasterEditInput|null>(null)
  const [profileId,setProfileId]=useState('')
  const [saving,setSaving]=useState(false)
  const [deleting,setDeleting]=useState(false)

  useEffect(()=>{
    if(!editing)return
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setEditing(null)}
    window.addEventListener('keydown',onKeyDown)
    return()=>window.removeEventListener('keydown',onKeyDown)
  },[editing])

  const editCriticality=editing?deriveEquipmentCriticality(editing):''
  const profileEquipment=profileId?rows.find((row)=>row.equipmentId===profileId)||null:null

  function openEdit(row:LiveEquipment){
    setProfileId('')
    setEditing(toDraft(row))
  }

  async function handleSave(){
    if(!editing)return
    if(!editing.equipmentName.trim()){setMessage('Tên thiết bị không được để trống.');return}
    if(!editing.managementResponsiblePrimary?.trim()){setMessage('Người phụ trách quản lý chính không được để trống.');return}
    if(!editCriticality){setMessage('Trả lời đủ 5 câu về mức độ quan trọng trước khi lưu.');return}
    setSaving(true)
    setMessage('')
    const draft=editing
    try{
      const result=await updateEquipmentDetails(draft)
      setRows((current)=>current.map((row)=>mergeDraftIntoRow(row,draft,result.criticality)))
      setMessage(`Đã lưu ${result.equipmentId} · Cấp ${result.criticality}`)
      setEditing(null)
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Không thể lưu thay đổi')
    }finally{
      setSaving(false)
    }
  }

  async function handleDelete(){
    if(!editing||deleting||saving)return
    const equipmentId=editing.equipmentId.trim().toUpperCase()
    setDeleting(true)
    setMessage('')
    try{
      const check=await checkEquipmentDeletion(equipmentId)
      if(!check.exists){
        setMessage(`${equipmentId} không còn tồn tại.`)
        setEditing(null)
        await reloadEquipment(true)
        return
      }
      if(!check.canDelete){
        setMessage(`Không thể xóa ${equipmentId} vì đã có dữ liệu liên quan. ${check.blockers.map((item)=>`${item.label}: ${item.count}`).join(' · ')}`)
        return
      }
      if(!window.confirm(`Xóa ${equipmentId} - ${editing.equipmentName}?\n\nThiết bị chưa có dữ liệu nghiệp vụ liên quan nên có thể xóa. Hệ thống cũng sẽ xóa toàn bộ ảnh của mã này. Hành động không thể hoàn tác.`))return
      const result=await deleteUnusedEquipment(equipmentId)
      setRows((current)=>current.filter((row)=>row.equipmentId!==equipmentId))
      removeEquipmentPhotoState(equipmentId)
      setProfileId('')
      setEditing(null)
      setMessage(`Đã xóa ${equipmentId}${Number(result.removedPhotos||0)>0?` và ${result.removedPhotos} ảnh`:''}.`)
    }catch(cause){
      setMessage(cause instanceof Error?cause.message:'Không thể xóa thiết bị')
    }finally{
      setDeleting(false)
    }
  }

  return {
    editing,setEditing,profileId,setProfileId,saving,deleting,editCriticality,profileEquipment,
    openEdit,handleSave,handleDelete,
  }
}
