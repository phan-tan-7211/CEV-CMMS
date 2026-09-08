import { useMemo, useState } from 'react'
import { canEditEquipment, useAppRole } from '../../auth/AppRoleContext'
import { buildEquipmentMasterSuggestions } from '../../data/equipmentMasterFields'
import { photoHoverPosition } from './equipmentColumns'
import { useEquipmentBulkEdit } from './useEquipmentBulkEdit'
import { useEquipmentData } from './useEquipmentData'
import { useEquipmentEditing } from './useEquipmentEditing'
import { useEquipmentPhotos } from './useEquipmentPhotos'
import { useEquipmentTableState } from './useEquipmentTableState'

export {
  COLUMNS,
  booleanSelectValue,
  columnValue,
  defaultVisibleColumns,
  documentLinks,
  inlineValue,
  parseBooleanSelect,
  patchKeyForColumn,
  photoHoverPosition,
  statusLabel,
} from './equipmentColumns'
export type { ColumnDef, ColumnFilters, ColumnKey, InlineChanges, PhotoHover, PhotoInfo, SortDirection } from './equipmentColumns'

export function useEquipmentPanelController() {
  const role = useAppRole()
  const canBulkEdit = canEditEquipment(role)
  const [message,setMessage]=useState('')

  const {
    photos,uploadingId,deletingPhotoId,refreshPhotoStates,removeEquipmentPhotoState,
    handlePhotoUpload,handlePhotoDelete,handleClipboardUpload,handleEmptyPhotoCellPaste,
  }=useEquipmentPhotos(setMessage)

  const {
    rows,setRows,loading,error,setError,reloadEquipment,
  }=useEquipmentData(refreshPhotoStates)

  const {
    query,setQuery,sortKey,sortDirection,
    visibleColumns,setVisibleColumns,columnPickerOpen,setColumnPickerOpen,
    filterColumn,setFilterColumn,filterSearch,setFilterSearch,columnFilters,setColumnFilters,
    photoHover,setPhotoHover,activeFilterCount,sortedRows,
    toggleSort,toggleColumn,filterOptions,toggleFilterValue,clearFilter,
  }=useEquipmentTableState(rows)

  const {
    bulkMode,setBulkMode,bulkSaving,inlineChanges,setInlineChanges,dirtyCount,
    setInlineCell,exitBulkMode,saveInlineChanges,
  }=useEquipmentBulkEdit({rows,setRows,setError,setMessage})

  const {
    editing,setEditing,profileId,setProfileId,saving,deleting,editCriticality,profileEquipment,
    openEdit,handleSave,handleDelete,
  }=useEquipmentEditing({rows,setRows,setMessage,reloadEquipment,removeEquipmentPhotoState})

  const masterSuggestions=useMemo(()=>buildEquipmentMasterSuggestions(rows.map((row)=>({...row,department:row.usingDepartment}))),[rows])
  const productionCount=rows.filter((row)=>row.equipmentType==='PRODUCTION').length
  const measurementCount=rows.filter((row)=>row.equipmentType==='MEASUREMENT').length

  function openPhotoHover(url:string,name:string,clientX:number,clientY:number){
    if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return
    setPhotoHover({url,name,...photoHoverPosition(clientX,clientY)})
  }

  return {
    rows, photos, editing, setEditing, profileId, setProfileId, loading, error, message, uploadingId, deletingPhotoId, saving, deleting,
    query, setQuery, sortKey, sortDirection, bulkMode, setBulkMode, bulkSaving, inlineChanges, setInlineChanges,
    visibleColumns, setVisibleColumns, columnPickerOpen, setColumnPickerOpen, filterColumn, setFilterColumn, filterSearch, setFilterSearch,
    columnFilters, setColumnFilters, photoHover, setPhotoHover, masterSuggestions, editCriticality, activeFilterCount,
    sortedRows, productionCount, measurementCount, profileEquipment, dirtyCount, canBulkEdit,
    reloadEquipment, openPhotoHover, openEdit, toggleSort, toggleColumn, filterOptions, toggleFilterValue, clearFilter, setInlineCell,
    exitBulkMode, saveInlineChanges, handleSave, handleDelete, handlePhotoUpload, handlePhotoDelete, handleClipboardUpload, handleEmptyPhotoCellPaste,
  }
}

export type EquipmentPanelController = ReturnType<typeof useEquipmentPanelController>
