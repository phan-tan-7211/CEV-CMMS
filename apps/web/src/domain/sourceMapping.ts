export const SOURCE_DOCUMENTS = [
  { code: 'CEV-BM-TBSX-01', name: 'Lý lịch thiết bị', module: 'EQUIPMENT', recordType: 'MASTER_HISTORY' },
  { code: 'CEV-BM-TBSX-02', name: 'Danh mục quản lý thiết bị sản xuất', module: 'EQUIPMENT', recordType: 'MASTER_LIST' },
  { code: 'CEV-BM-TBSX-03', name: 'Kế hoạch bảo dưỡng máy', module: 'MAINTENANCE', recordType: 'PLAN' },
  { code: 'CEV-BM-TBSX-04', name: 'Sổ theo dõi bảo dưỡng sửa chữa thiết bị', module: 'MAINTENANCE', recordType: 'LOG' },
  { code: 'CEV-BM-TBSX-05', name: 'Biên bản bàn giao trang thiết bị', module: 'EQUIPMENT', recordType: 'HANDOVER' },
  { code: 'CEV-BM-TBSX-06', name: 'Bảng theo dõi chỉ số dừng máy', module: 'KPI', recordType: 'REPORT' },
  { code: 'CEV-BM-TBSX-07', name: 'Phiếu bảo dưỡng dự báo', module: 'MAINTENANCE', recordType: 'WORK_ORDER' },
  { code: 'CEV-BM-TBSX-08', name: 'Kết quả bảo dưỡng sửa chữa thiết bị', module: 'MAINTENANCE', recordType: 'EXECUTION_RESULT' },
  { code: 'CEV-BM-TBSX-09', name: 'Danh mục Jig, Gá và Dụng cụ sản xuất', module: 'TOOLING', recordType: 'MASTER_LIST' },
  { code: 'CEV-BM-TBSX-10', name: 'Kế hoạch kiểm tra, bảo trì jig và thay mới dụng cụ nhanh hỏng', module: 'TOOLING', recordType: 'PLAN' },
  { code: 'CEV-BM-TBSX-11', name: 'Hồ sơ thay đổi thiết kế, sửa đổi dụng cụ', module: 'TOOLING', recordType: 'CHANGE_CONTROL' },
  { code: 'CEV-BM-KTTBHN', name: 'Kiểm tra thiết bị hàng ngày', module: 'INSPECTION', recordType: 'DAILY_CHECK' },
  { code: 'CEV-BM-STCL-03', name: 'Danh mục thiết bị kiểm tra / hiệu chuẩn', module: 'CALIBRATION', recordType: 'MASTER_AND_VENDOR_QUOTE' },
] as const

export const SOURCE_FIRST_WORKFLOW = [
  'REGISTER_EQUIPMENT',
  'DAILY_INSPECTION',
  'PLAN_MAINTENANCE',
  'CREATE_WORK_ORDER',
  'EXECUTE_MAINTENANCE',
  'RECORD_RESULT',
  'HANDOVER_RELEASE',
  'CALCULATE_DOWNTIME_KPI',
] as const

export const SOURCE_POLICY = {
  sourceOfTruth: 'source/',
  principle: 'Nhập dữ liệu một lần, tái sử dụng để tạo biểu mẫu và KPI.',
  financialScope: 'Giữ dữ liệu chi phí/báo giá khi có trong source; tách khỏi master vận hành và ghi rõ mốc lịch sử để không bị hiểu là giá live.',
  persistencePhase: 'Chỉ kết nối Google Sheets/Drive sau khi schema và workflow được chốt.',
} as const
