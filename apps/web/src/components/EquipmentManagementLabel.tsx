import { EquipmentQr } from './EquipmentQr'
import './EquipmentManagementLabel.css'

type Row = Record<string, unknown>
export type EquipmentLabelSize = 'tiny' | 'standard' | 'large'

export const EQUIPMENT_LABEL_SIZES: Array<{ id: EquipmentLabelSize; label: string; stockWidth: number; stockHeight: number; printWidth: number; printHeight: number }> = [
  { id: 'tiny', label: '15 × 25 mm', stockWidth: 15, stockHeight: 25, printWidth: 25, printHeight: 15 },
  { id: 'standard', label: '30 × 50 mm', stockWidth: 30, stockHeight: 50, printWidth: 50, printHeight: 30 },
  { id: 'large', label: '45 × 80 mm', stockWidth: 45, stockHeight: 80, printWidth: 80, printHeight: 45 },
]

type Props = {
  row: Row
  size?: EquipmentLabelSize
}

function sourceData(row: Row) {
  const value = row.source_data
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}

function text(row: Row, key: string) {
  const direct = row[key]
  if (direct !== null && direct !== undefined && String(direct).trim()) return String(direct).trim()
  const nested = sourceData(row)[key]
  return nested === null || nested === undefined ? '' : String(nested).trim()
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    RUNNING: 'HOẠT ĐỘNG',
    DOWN: 'SỰ CỐ',
    MAINTENANCE: 'BẢO TRÌ',
    STOPPED: 'DỪNG',
    DISPOSED: 'THANH LÝ',
  }
  return labels[value.toUpperCase()] || value || 'CHƯA XÁC ĐỊNH'
}

export function EquipmentManagementLabel({ row, size = 'standard' }: Props) {
  const equipmentId = text(row, 'equipment_id')
  const equipmentName = text(row, 'equipment_name')
  const qrValue = text(row, 'qr_code') || equipmentId
  const primary = text(row, 'managementResponsiblePrimary')
  const secondary = text(row, 'managementResponsibleSecondary')
  const area = text(row, 'currentArea')
  const line = text(row, 'currentLine')
  const criticality = text(row, 'criticality')
  const status = text(row, 'status')
  const location = [area, line].filter(Boolean).join(' · ')
  const missingPrimaryLabel = size === 'tiny' ? '—' : 'CHƯA GÁN'

  return <section className={`equipment-management-label label-${size}`} aria-label={`Tem quản lý ${equipmentId}`}>
    <header>
      <div><strong>CORE ELECTRONICS VIETNAM</strong><span>TEM QUẢN LÝ THIẾT BỊ</span></div>
      <div className="equipment-label-badges">
        {criticality ? <b>CẤP {criticality}</b> : null}
        <b>{statusLabel(status)}</b>
      </div>
    </header>

    <div className="equipment-label-body">
      <div className="equipment-label-table" role="table" aria-label="Thông tin quản lý thiết bị">
        <div className="equipment-label-row" role="row">
          <div className="equipment-label-key" role="cell">Mã quản lý thiết bị</div>
          <div className="equipment-label-value equipment-label-code" role="cell">{equipmentId || '—'}</div>
        </div>
        <div className="equipment-label-row" role="row">
          <div className="equipment-label-key" role="cell">Tên thiết bị</div>
          <div className="equipment-label-value equipment-label-name" role="cell">{equipmentName || '—'}</div>
        </div>
        <div className="equipment-label-responsible" role="rowgroup">
          <div className="equipment-label-key equipment-label-responsible-title">Người phụ trách quản lý</div>
          <div className="equipment-label-responsible-lines">
            <div><b>Chính</b><strong className={!primary ? 'is-missing' : ''}>{primary || missingPrimaryLabel}</strong></div>
            <div><b>Phụ</b><strong>{secondary || '—'}</strong></div>
          </div>
        </div>
        {size === 'large' ? <div className="equipment-label-location">Vị trí: <strong>{location || '—'}</strong></div> : null}
      </div>

      <div className="equipment-label-qr">
        <EquipmentQr value={qrValue} size={150} label="" />
        <span>QUÉT HỒ SƠ / KIỂM KÊ</span>
      </div>
    </div>
  </section>
}
