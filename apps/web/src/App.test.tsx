/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./data/supabaseClient', () => ({ supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })), signOut: vi.fn().mockResolvedValue({ error: null }) } } }))

vi.mock('./PwaStatus', () => ({ PwaStatus: () => null }))
vi.mock('./data/liveAudit', () => ({
  loadLiveSession: vi.fn().mockResolvedValue({ email: 'admin@example.com', role: 'ADMIN', contractVersion: 'G1-frozen-2026-08-28' }),
  loadLiveAudit: vi.fn().mockResolvedValue([]),
}))
vi.mock('./LiveDashboardPanel', () => ({ LiveDashboardPanel: () => <h2>Tổng quan trực tiếp</h2> }))
vi.mock('./equipment/EquipmentWorkspace', () => ({ EquipmentWorkspace: () => <h2>Thiết bị trực tiếp</h2> }))
vi.mock('./LiveEquipmentInventoryPanel', () => ({ LiveEquipmentInventoryPanel: () => <h2>Kiểm kê thiết bị trực tiếp</h2> }))
vi.mock('./LiveInspectionPanel', () => ({ LiveInspectionPanel: () => <h2>Kiểm tra trực tiếp</h2> }))
vi.mock('./maintenance/MaintenanceWorkspace', () => ({ MaintenanceWorkspace: () => <h2>Bảo trì trực tiếp</h2> }))
vi.mock('./LiveToolingPanel', () => ({ LiveToolingPanel: () => <h2>Jig gá trực tiếp</h2> }))
vi.mock('./LiveCalibrationPanel', () => ({ LiveCalibrationPanel: () => <h2>Hiệu chuẩn trực tiếp</h2> }))
vi.mock('./LiveAuditPanel', () => ({ LiveAuditPanel: () => <h2>Nhật ký trực tiếp</h2> }))
vi.mock('./QrEquipmentResult', () => ({ QrEquipmentResult: ({ equipmentId }: { equipmentId: string }) => <h2>Hồ sơ thiết bị {equipmentId}</h2> }))

vi.mock('./LiveMaintenancePlanPanel', () => ({ LiveMaintenancePlanPanel: () => null }))
vi.mock('./LiveMaintenanceResultPanel', () => ({ LiveMaintenanceResultPanel: () => null }))
vi.mock('./LiveHandoverPanel', () => ({ LiveHandoverPanel: () => null }))
vi.mock('./LiveDowntimePanel', () => ({ LiveDowntimePanel: () => null }))
vi.mock('./LiveCalibrationEvaluationPanel', () => ({ LiveCalibrationEvaluationPanel: () => null }))
vi.mock('./LiveCalibrationQuotePanel', () => ({ LiveCalibrationQuotePanel: () => null }))

beforeEach(() => {
  window.history.replaceState({}, '', '/')
})
afterEach(() => cleanup())

import App from './App'

describe('khung ứng dụng Vercel + Supabase', () => {
  it('hiển thị tổng quan mặc định', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Tổng quan trực tiếp' })).toBeInTheDocument()
    expect(screen.getByLabelText('Điều hướng trên máy tính')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
    expect(screen.getByText('CEV CMMS')).toBeInTheDocument()
    expect(screen.queryByText(/IATF/i)).not.toBeInTheDocument()
    expect((await screen.findAllByText('Quản trị hệ thống')).length).toBeGreaterThan(0)
  })

  it('điều hướng toàn bộ chức năng desktop đúng module', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Tổng quan trực tiếp' })
    const desktopNav = screen.getByLabelText('Điều hướng trên máy tính')
    const cases = [
      ['Thiết bị', 'Thiết bị trực tiếp'], ['Kiểm kê thiết bị', 'Kiểm kê thiết bị trực tiếp'], ['Danh sách kiểm tra', 'Kiểm tra trực tiếp'], ['Bảo trì phòng ngừa', 'Bảo trì trực tiếp'], ['Jig, gá & dụng cụ', 'Jig gá trực tiếp'], ['Hiệu chuẩn', 'Hiệu chuẩn trực tiếp'], ['Nhật ký & cấu hình', 'Nhật ký trực tiếp'], ['Tổng quan', 'Tổng quan trực tiếp'],
    ] as const
    for (const [navLabel, heading] of cases) {
      fireEvent.click(within(desktopNav).getByRole('button', { name: navLabel }))
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    }
  })

  it('giữ thanh mobile gọn và mở chức năng còn lại từ Thêm', async () => {
    render(<App />)
    expect((await screen.findAllByText('Quản trị hệ thống')).length).toBeGreaterThan(0)
    const mobileNav = screen.getByLabelText('Điều hướng trên điện thoại')
    ;['Trang chủ', 'Công việc', 'Quét QR', 'Thiết bị', 'Thêm'].forEach((label) => expect(within(mobileNav).getByRole('button', { name: label })).toBeInTheDocument())

    fireEvent.click(within(mobileNav).getByRole('button', { name: 'Thêm' }))
    const more = screen.getByRole('dialog', { name: 'Các chức năng khác' })
    ;['Kiểm kê thiết bị', 'Danh sách kiểm tra', 'Phụ tùng & Kho', 'Jig, gá & dụng cụ', 'Hiệu chuẩn', 'Hồ sơ A4', 'Nhật ký & cấu hình'].forEach((label) => expect(within(more).getByRole('button', { name: new RegExp(label) })).toBeInTheDocument())

    fireEvent.click(within(more).getByRole('button', { name: /Kiểm kê thiết bị/ }))
    expect(await screen.findByRole('heading', { name: 'Kiểm kê thiết bị trực tiếp' })).toBeInTheDocument()
  })

  it('giữ ngữ cảnh thiết bị và quay về đúng hồ sơ ban đầu', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Tổng quan trực tiếp' })

    window.dispatchEvent(new CustomEvent('cev:navigate', {
      detail: { view: 'maintenance', equipmentId: 'CEV-ME-002' },
    }))

    expect(await screen.findByRole('heading', { name: 'Bảo trì trực tiếp' })).toBeInTheDocument()
    const back = screen.getByRole('button', { name: '← Trở về CEV-ME-002' })
    expect(back).toBeInTheDocument()

    fireEvent.click(back)
    expect(await screen.findByRole('heading', { name: 'Hồ sơ thiết bị CEV-ME-002' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '← Trở về CEV-ME-002' })).not.toBeInTheDocument()
  })
})
