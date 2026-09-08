# Hệ thống quản lý thiết bị IATF 16949

Ứng dụng quản lý thiết bị sản xuất, thiết bị đo kiểm, bảo trì, hiệu chuẩn, Jig & Tooling và truy vết lịch sử theo nguyên tắc **một nguồn dữ liệu gốc**.

> **Quy tắc bắt buộc cho dev/AI:** đọc `AGENTS.md` trước khi thay đổi kiến trúc hoặc triển khai feature.

## Nguyên tắc dữ liệu

**Một thiết bị = một mã = một hồ sơ gốc = một lịch sử xuyên suốt.**

- `equipment_master` là master thiết bị duy nhất.
- `PRODUCTION` và `MEASUREMENT` dùng chung Equipment Master.
- Inspection, Maintenance, Downtime, Handover, Calibration, Movement và Audit tham chiếu cùng `equipment_id`.
- Không tạo master song song theo phòng ban/nghiệp vụ.
- Tooling có lifecycle riêng theo `tooling_id`.

## Kiến trúc runtime hiện tại của nhánh Supabase

```text
Người dùng
    ↓
Vercel Frontend
React + Vite + TypeScript
    ↓
Supabase
├─ PostgreSQL
├─ Auth
├─ RLS
├─ Storage
└─ RPC / transactional workflow
```

**Không dùng Apps Script, Google Sheets hoặc Google Drive trong runtime mới.**

Canonical frontend origin:

```text
https://iatf-16949-equipment-management.vercel.app
```

## Phạm vi hệ thống

- BM-TBSX-01/02: Equipment Master / Lý lịch thiết bị.
- BM-KTTBHN: kiểm tra thiết bị hằng ngày.
- Kế hoạch PM và Maintenance Work Order.
- BM-TBSX-05: bàn giao thiết bị.
- Downtime / KPI.
- BM-TBSX-09/10/11: Jig & Tooling.
- Calibration Master / Calibration Log / chứng chỉ hiệu chuẩn.
- Equipment Movement.
- Audit Log.

## Backend authority

Business mutation quan trọng chạy qua Supabase RPC thay vì frontend tự ghép nhiều thao tác:

- Daily Inspection, bao gồm nhánh `STOP_REPAIR` tạo Inspection + Work Order + Downtime và cập nhật trạng thái thiết bị trong cùng transaction.
- Maintenance workflow và gate BM-05 trước Release.
- Tooling create / plan / modification workflow.
- Calibration Log + cập nhật Calibration Master + Audit.
- Equipment Master update và Audit.

RLS và role-check phía database là lớp quyền authoritative. Frontend chỉ mirror quyền để ẩn/khóa action không hợp lệ.

## Role

Các role ứng dụng:

- `MAINTENANCE`
- `SUPERVISOR`
- `QUALITY`
- `MANAGER`
- `ADMIN`

`Audit & Cấu hình` chỉ ADMIN. Equipment Master edit hiện ADMIN-only. Các workflow khác bám đúng permission matrix trong `src/auth/AppRoleContext.tsx` và RPC tương ứng.

## Storage

Evidence lưu trong private Supabase Storage, gồm các bucket/prefix nghiệp vụ như:

- `equipment-photos`
- `calibration-certificates`
- `maintenance-before-after`
- `tooling-change-attachments`
- `handover-records`

Database lưu path/metadata, không lưu binary image trong table.

## Frontend

Web và Mobile là hai ứng dụng độc lập trong cùng một Git repository:

```text
apps/web/       React + Vite + TypeScript
apps/mobile/    React Native + Expo
supabase/       Database, Auth, RLS, Storage và RPC
```

Các workspace production:

- Tổng quan
- Thiết bị
- Kiểm tra ngày
- Bảo trì
- Jig & Tooling
- Hiệu chuẩn
- Audit & Cấu hình

Workspace được lazy-load theo màn để giảm initial bundle. UI dùng pattern thống nhất: KPI → search/filter → bảng chính → drawer/profile/action.

## Dữ liệu nguồn và IATF

Nguồn nghiệp vụ chuẩn nằm trong `source/` và các tài liệu được người quản trị xác nhận. `source/` là tài liệu nghiệp vụ, **không phải backend legacy** và không được xóa trong cleanup runtime.

Không tự tạo dữ liệu giao dịch production từ template/ví dụ nếu chưa được phê duyệt.

## Development

```bash
cd apps/web
npm install
npm run dev
npm test
npm run build
npm run lint
```

Supabase env xem `apps/web/.env.example`. Không commit service-role key hoặc secret vào client/GitHub.

## Tài liệu chính

- `AGENTS.md`
- `docs/MASTER_IMPLEMENTATION_PLAN.md`
- `docs/SUPABASE_ONLY_ARCHITECTURE.md`
- `docs/EQUIPMENT_ID_CONVENTION.md`
- `docs/SOURCE_FIRST_IMPLEMENTATION_PLAN.md`
