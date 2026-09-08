import type { CalibrationMaster, CalibrationQuoteSummary, CalibrationVendorQuote } from '../domain/calibration'

/**
 * Local sample transcribed from source/DANH SÁCH THIẾT BỊ  HIỆU CHUẨN (2024.06.01).md.
 * Historical snapshot for schema/UI validation, not live company status or current supplier pricing.
 */
export const CALIBRATION_SOURCE_SNAPSHOT = '2024-06-01'
export const CALIBRATION_SOURCE_DOCUMENT = 'DANH SÁCH THIẾT BỊ HIỆU CHUẨN (2024.06.01)'

export const mockCalibrationMaster: CalibrationMaster[] = [
  { calibrationEquipmentId: 'CAL-CEV-TB-113', equipmentId: 'CEV-TB-113', controlNumber: 'CEV-TB-113', department: 'QC', category: 'Weight', instrumentName: 'ELECTRONIC SCALE', localName: 'Cân', operationalStatus: 'OK', specification: '0.001g-220g', accuracy: '0.001', model: 'EB-220HU', manufacturer: 'SHIMADZU', serialNumber: '00799', purpose: 'Kiểm tra trọng lượng', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-HP50-001', department: 'QC', category: 'Torque', instrumentName: 'Digital Torque Meter HP-50', localName: 'Máy kiểm tra lực siết', operationalStatus: 'OK', model: 'HP-50', manufacturer: 'HIOS', purpose: 'Kiểm tra lực siết', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-CEV-TB-301', equipmentId: 'CEV-TB-301', controlNumber: 'CEV-TB-301', department: 'QC', category: 'Thickness', instrumentName: 'FILM THICKNESS METER', localName: 'Máy kiểm tra độ dày sơn', operationalStatus: 'OK', specification: '0~603μm', accuracy: '1μm', model: '456', manufacturer: 'Elcometer', purpose: 'Kiểm tra độ dày lớp phủ sơn', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-CEV-TB-302', equipmentId: 'CEV-TB-302', controlNumber: 'CEV-TB-302', department: 'QC', category: 'Microscope', instrumentName: 'TOOL MAKERS MICROSCOPE', localName: 'Kính hiển vi', operationalStatus: 'OK', accuracy: '1μm', model: 'TM', manufacturer: 'Mitutoyo', serialNumber: '900041208', purpose: 'Kiểm tra độ dày lớp phủ sơn', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-CEV-TB-401', equipmentId: 'CEV-TB-401', controlNumber: 'CEV-TB-401', department: 'QC', category: 'Voltage', instrumentName: 'PUNTURE TESTER', localName: 'Máy đo điện áp', operationalStatus: 'OK', specification: '0KV - 5 KV', model: 'ILO PT2013', manufacturer: 'ILOSAM ENG', serialNumber: 'PT2013-17230', purpose: 'Kiểm tra điện áp', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-CEV-TB-001', equipmentId: 'CEV-TB-001', controlNumber: 'CEV-TB-001', department: 'QC', category: 'LCR', instrumentName: 'LCR METER', localName: 'Meter', operationalStatus: 'OK', specification: '20Hz - 1MHz', model: 'HP4284A', manufacturer: 'Agilent', serialNumber: '2940307919', purpose: 'Kiểm tra giá trị cuộn cảm LCR', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-TH9201-01', department: 'COIL', category: 'HIPOT', instrumentName: 'TH9201 HIPOT TESTER', operationalStatus: 'OK', model: 'TH9201', manufacturer: 'TONGHUI', serialNumber: 'N06819104', purpose: 'Kiểm tra short giữa coil và core', lastCalibrationDate: '2024-06-28', nextDueDate: '2025-06-28', instrumentStatus: 'ACTIVE', active: true },
  { calibrationEquipmentId: 'CAL-TENSION-001', department: 'COIL', category: 'Tension', instrumentName: 'TENSION METER', localName: 'Kiểm tra độ căng dây', operationalStatus: 'OK', specification: '0.5N', purpose: 'Kiểm tra lực căng dây', instrumentStatus: 'ACTIVE', active: true },
]

const quote = (calibrationEquipmentId: string, provider: string, amountVnd: number): CalibrationVendorQuote => ({ calibrationEquipmentId, provider, amountVnd, sourceDate: CALIBRATION_SOURCE_SNAPSHOT, sourceDocument: CALIBRATION_SOURCE_DOCUMENT })

export const calibrationVendorQuotes: CalibrationVendorQuote[] = [
  quote('CAL-CEV-TB-113', 'G.TECH', 200000), quote('CAL-CEV-TB-113', 'CALTEK', 250000), quote('CAL-CEV-TB-113', 'TECHMASTER', 300000), quote('CAL-CEV-TB-113', 'ISOCAL', 300000), quote('CAL-CEV-TB-113', 'KAIZEN CREATIVE', 450000),
  quote('CAL-CEV-TB-301', 'G.TECH', 800000), quote('CAL-CEV-TB-301', 'CALTEK', 900000), quote('CAL-CEV-TB-301', 'TECHMASTER', 1000000), quote('CAL-CEV-TB-301', 'ISOCAL', 400000), quote('CAL-CEV-TB-301', 'KAIZEN CREATIVE', 600000),
  quote('CAL-CEV-TB-302', 'G.TECH', 800000), quote('CAL-CEV-TB-302', 'CALTEK', 900000), quote('CAL-CEV-TB-302', 'TECHMASTER', 1000000), quote('CAL-CEV-TB-302', 'ISOCAL', 1000000), quote('CAL-CEV-TB-302', 'KAIZEN CREATIVE', 1500000),
  quote('CAL-CEV-TB-401', 'G.TECH', 500000), quote('CAL-CEV-TB-401', 'CALTEK', 1000000), quote('CAL-CEV-TB-401', 'TECHMASTER', 1000000), quote('CAL-CEV-TB-401', 'ISOCAL', 700000), quote('CAL-CEV-TB-401', 'KAIZEN CREATIVE', 600000),
  quote('CAL-CEV-TB-001', 'G.TECH', 400000), quote('CAL-CEV-TB-001', 'CALTEK', 600000), quote('CAL-CEV-TB-001', 'TECHMASTER', 600000), quote('CAL-CEV-TB-001', 'ISOCAL', 500000), quote('CAL-CEV-TB-001', 'KAIZEN CREATIVE', 1200000),
]

export const calibrationQuoteSummary: CalibrationQuoteSummary[] = [
  { provider: 'G.TECH', itemCount: 48, subtotalVnd: 18700000, vatRate: 0.08, totalVnd: 20196000, sourceDate: CALIBRATION_SOURCE_SNAPSHOT },
  { provider: 'CALTEK', itemCount: 48, subtotalVnd: 25700000, vatRate: 0.08, totalVnd: 27756000, sourceDate: CALIBRATION_SOURCE_SNAPSHOT },
  { provider: 'TECHMASTER', itemCount: 48, subtotalVnd: 27120000, vatRate: 0.08, totalVnd: 29289600, sourceDate: CALIBRATION_SOURCE_SNAPSHOT },
  { provider: 'ISOCAL', itemCount: 48, subtotalVnd: 22300000, vatRate: 0.05, totalVnd: 23415000, sourceDate: CALIBRATION_SOURCE_SNAPSHOT },
  { provider: 'KAIZEN CREATIVE', itemCount: 48, subtotalVnd: 40150000, vatRate: 0.08, totalVnd: 43362000, sourceDate: CALIBRATION_SOURCE_SNAPSHOT },
]
