import { useState, type Dispatch, type SetStateAction } from 'react'
import { bulkUpdateEquipmentRows } from '../../data/equipmentBulkEdit'
import type { LiveEquipment } from '../../data/liveEquipment'
import { patchKeyForColumn, type ColumnKey, type InlineChanges } from './equipmentColumns'
import { mergeInlinePatch } from './equipmentRowMappers'

type UseEquipmentBulkEditOptions = {
  rows: LiveEquipment[]
  setRows: Dispatch<SetStateAction<LiveEquipment[]>>
  setError: Dispatch<SetStateAction<string>>
  setMessage: Dispatch<SetStateAction<string>>
}

export function useEquipmentBulkEdit({ rows, setRows, setError, setMessage }: UseEquipmentBulkEditOptions) {
  const [bulkMode,setBulkMode]=useState(false)
  const [bulkSaving,setBulkSaving]=useState(false)
  const [inlineChanges,setInlineChanges]=useState<InlineChanges>({})
  const dirtyCount=Object.keys(inlineChanges).length

  function setInlineCell(equipment:LiveEquipment,key:ColumnKey,value:string|boolean){
    const patchKey=patchKeyForColumn(key)
    if(!patchKey)return
    setInlineChanges((current)=>({...current,[equipment.equipmentId]:{...current[equipment.equipmentId],[patchKey]:value}}))
  }

  function exitBulkMode(){
    if(dirtyCount&&!window.confirm(`Bỏ ${dirtyCount} dòng chưa lưu?`))return
    setInlineChanges({})
    setBulkMode(false)
  }

  async function saveInlineChanges(){
    const changes=Object.entries(inlineChanges).map(([equipmentId,patch])=>({equipmentId,patch}))
    if(!changes.length)return
    const before=rows
    setBulkSaving(true)
    setError('')
    setMessage('')
    setRows((current)=>current.map((row)=>inlineChanges[row.equipmentId]?mergeInlinePatch(row,inlineChanges[row.equipmentId]):row))
    try{
      const result=await bulkUpdateEquipmentRows(changes)
      setInlineChanges({})
      setMessage(`Đã lưu ${result.updatedCount} dòng trực tiếp trên bảng.`)
    }catch(cause){
      setRows(before)
      setError(cause instanceof Error?cause.message:'Không thể lưu thay đổi trên bảng.')
    }finally{
      setBulkSaving(false)
    }
  }

  return {
    bulkMode,setBulkMode,bulkSaving,inlineChanges,setInlineChanges,dirtyCount,
    setInlineCell,exitBulkMode,saveInlineChanges,
  }
}
