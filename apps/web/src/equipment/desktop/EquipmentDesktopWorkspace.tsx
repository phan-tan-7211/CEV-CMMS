import './EquipmentDesktop.css'
import './EquipmentDesktopSheet.css'
import { EquipmentDesktopRegistration } from './EquipmentDesktopRegistration'
import { EquipmentDesktopPanel } from './EquipmentDesktopPanel'

/** Desktop Equipment composition. Mobile UI must never be imported here. */
export function EquipmentDesktopWorkspace() {
  return <div className="maintenance-workspace-stack equipment-desktop-workspace"><EquipmentDesktopRegistration/><EquipmentDesktopPanel/></div>
}
