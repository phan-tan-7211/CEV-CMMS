import { useEffect, useMemo, useRef, useState } from 'react'
import type { LiveEquipment } from '../../data/liveEquipment'
import {
  COLUMN_STORAGE_KEY,
  columnValue,
  includesQuery,
  loadVisibleColumns,
  type ColumnFilters,
  type ColumnKey,
  type PhotoHover,
  type SortDirection,
} from './equipmentColumns'

const COLUMN_WIDTH_STORAGE_KEY = 'cev-equipment-column-widths-v1'
const MIN_COLUMN_WIDTH = 42
const MAX_COLUMN_WIDTH = 480

function loadColumnWidths(): Partial<Record<ColumnKey, number>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(COLUMN_WIDTH_STORAGE_KEY) || '{}')
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'number' && value >= MIN_COLUMN_WIDTH && value <= MAX_COLUMN_WIDTH)) as Partial<Record<ColumnKey, number>>
  } catch { return {} }
}

export function useEquipmentTableState(rows: LiveEquipment[]) {
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<ColumnKey>('equipmentId')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadVisibleColumns)
  const [columnWidths, setColumnWidths] = useState<Partial<Record<ColumnKey, number>>>(loadColumnWidths)
  const columnWidthsRef = useRef(columnWidths)
  const [columnPickerOpen, setColumnPickerOpen] = useState(false)
  const [filterColumn, setFilterColumn] = useState<ColumnKey | null>(null)
  const [filterSearch, setFilterSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({})
  const [photoHover, setPhotoHover] = useState<PhotoHover | null>(null)

  useEffect(() => {
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('.equipment-column-picker')) setColumnPickerOpen(false)
      if (!(target instanceof Element) || !target.closest('.equipment-filter-popover,.equipment-filter-button,.equipment-mobile-filter-field,.equipment-mobile-filter-panel')) {
        setFilterColumn(null)
        setFilterSearch('')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setColumnPickerOpen(false)
      setFilterColumn(null)
      setFilterSearch('')
      setPhotoHover(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  const activeFilterCount = Object.values(columnFilters).filter((value) => value?.length).length
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (!includesQuery(row, query.trim().toLocaleLowerCase())) return false
    for (const [key, values] of Object.entries(columnFilters) as Array<[ColumnKey, string[] | undefined]>) {
      if (values?.length && !values.includes(columnValue(row, key) || '—')) return false
    }
    return true
  }), [rows, query, columnFilters])

  const sortedRows = useMemo(() => filteredRows.toSorted((a, b) => {
    const result = columnValue(a, sortKey).localeCompare(columnValue(b, sortKey), 'vi', { numeric: true, sensitivity: 'base' })
    return sortDirection === 'asc' ? result : -result
  }), [filteredRows, sortKey, sortDirection])

  function toggleSort(key: ColumnKey) {
    if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  function resizeColumn(key: ColumnKey, startX: number) {
    const startWidth = columnWidthsRef.current[key] || 150
    let latestWidth = startWidth
    let frame = 0

    const publish = () => {
      frame = 0
      setColumnWidths((current) => ({ ...current, [key]: latestWidth }))
    }

    const onMove = (event: PointerEvent) => {
      latestWidth = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + event.clientX - startX))
      columnWidthsRef.current = { ...columnWidthsRef.current, [key]: latestWidth }
      if (!frame) frame = window.requestAnimationFrame(publish)
    }

    const onUp = () => {
      if (frame) window.cancelAnimationFrame(frame)
      setColumnWidths((current) => ({ ...current, [key]: latestWidth }))
      localStorage.setItem(COLUMN_WIDTH_STORAGE_KEY, JSON.stringify({ ...columnWidthsRef.current, [key]: latestWidth }))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    window.addEventListener('pointercancel', onUp, { once: true })
  }

  function resetColumnWidths() {
    columnWidthsRef.current = {}
    setColumnWidths({})
    localStorage.removeItem(COLUMN_WIDTH_STORAGE_KEY)
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  function filterOptions(key: ColumnKey) {
    return Array.from(new Set(rows.map((row) => columnValue(row, key) || '—')))
      .toSorted((a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' }))
  }

  function toggleFilterValue(key: ColumnKey, value: string) {
    setColumnFilters((current) => {
      const selected = current[key] || []
      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
      const result = { ...current, [key]: next }
      if (!next.length) delete result[key]
      return result
    })
  }

  function clearFilter(key: ColumnKey) {
    setColumnFilters((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  return {
    query, setQuery,
    sortKey, sortDirection,
    visibleColumns, setVisibleColumns,
    columnWidths, resizeColumn, resetColumnWidths,
    columnPickerOpen, setColumnPickerOpen,
    filterColumn, setFilterColumn,
    filterSearch, setFilterSearch,
    columnFilters, setColumnFilters,
    photoHover, setPhotoHover,
    activeFilterCount,
    sortedRows,
    toggleSort,
    toggleColumn,
    filterOptions,
    toggleFilterValue,
    clearFilter,
  }
}
