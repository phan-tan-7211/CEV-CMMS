import './EquipmentMobile.css'
import './EquipmentMobileSheet.css'
import './EquipmentMobileForms.css'
import { EquipmentMobileRegistration } from './EquipmentMobileRegistration'
import { EquipmentMobilePanel } from './EquipmentMobilePanel'

/** Mobile Equipment composition. Desktop UI must never be imported here. */
export function EquipmentMobileWorkspace() {
  return <div className="maintenance-workspace-stack equipment-mobile-workspace"><EquipmentMobileRegistration/><EquipmentMobilePanel/></div>
}
