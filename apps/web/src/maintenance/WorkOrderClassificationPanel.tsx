import { useEffect, useState } from 'react'
import { supabase } from '../data/supabaseClient'
import { classifyWorkOrder, WORK_ORDER_KIND_LABEL, WORK_ORDER_SOURCE_LABEL } from './workOrderClassification'
import './WorkOrderClassificationPanel.css'

type Props = { workOrderId: string }

type ClassificationView = {
  sourceLabel: string
  kindLabel: string
  sourceType: string
  planClassification: string
  hasDowntime: boolean
}

function text(value: unknown) { return value == null ? '' : String(value).trim() }

export function WorkOrderClassificationPanel({ workOrderId }: Props) {
  const [view, setView] = useState<ClassificationView | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('maintenance_work_order').select('source_type,source_data').eq('work_order_id', workOrderId).single(),
      supabase.from('downtime_event').select('downtime_id').eq('work_order_id', workOrderId).limit(1),
    ]).then(([woResult, downtimeResult]) => {
      if (!active) return
      if (woResult.error) throw woResult.error
      if (downtimeResult.error) throw downtimeResult.error
      const row = (woResult.data || {}) as Record<string, unknown>
      const source = (row.source_data as Record<string, unknown> | null) || {}
      const sourceType = text(row.source_type)
      const planClassification = text(source.planClassification)
      const hasDowntime = Boolean(downtimeResult.data?.length)
      const classification = classifyWorkOrder({ sourceType, planClassification, hasDowntime })
      setView({
        sourceLabel: WORK_ORDER_SOURCE_LABEL[classification.sourceFamily],
        kindLabel: WORK_ORDER_KIND_LABEL[classification.kind],
        sourceType,
        planClassification,
        hasDowntime,
      })
      setError('')
    }).catch((cause: unknown) => {
      if (!active) return
      setView(null)
      setError(cause instanceof Error ? cause.message : 'Không thể phân loại Work Order')
    })
    return () => { active = false }
  }, [workOrderId])

  if (error) return <section className="wo-classification wo-classification-error">Không thể tải phân loại Work Order.</section>
  if (!view) return <section className="wo-classification">Đang xác định nguồn và loại công việc…</section>

  return <section className="wo-classification" aria-label="Phân loại Work Order">
    <div><span>Nguồn</span><strong>{view.sourceLabel}</strong></div>
    <div><span>Loại công việc</span><strong>{view.kindLabel}</strong></div>
    {view.sourceType === 'LEGACY_IMPORT' ? <small>Dữ liệu lịch sử{view.planClassification ? ` · ${view.planClassification}` : ''}{view.hasDowntime ? ' · Có sự kiện dừng máy' : ''}</small> : null}
  </section>
}
