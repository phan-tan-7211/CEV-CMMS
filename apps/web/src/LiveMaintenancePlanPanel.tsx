import { useEffect, useState } from 'react'
import './Maintenance.css'
import { MaintenancePlanSection } from './MaintenancePlanSection'
import { loadLiveMaintenance, type LiveMaintenancePlan, type MaintenanceEquipmentOption } from './data/liveMaintenance'

export function LiveMaintenancePlanPanel() {
  const [equipment, setEquipment] = useState<MaintenanceEquipmentOption[]>([])
  const [plans, setPlans] = useState<LiveMaintenancePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async () => {
    const result = await loadLiveMaintenance()
    setEquipment(result.equipment)
    setPlans(result.plans)
    setError('')
  }

  useEffect(() => {
    let active = true
    loadLiveMaintenance()
      .then((result) => {
        if (!active) return
        setEquipment(result.equipment)
        setPlans(result.plans)
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải BM03') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <div className="maintenance-state">Đang tải kế hoạch BM03…</div>
  if (error) return <div className="maintenance-feedback error" role="alert">{error}</div>
  return <MaintenancePlanSection equipment={equipment} plans={plans} onSaved={refresh} />
}
