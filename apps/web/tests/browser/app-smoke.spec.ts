import { expect, test, type Page } from '@playwright/test'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
const payload = Buffer.from(JSON.stringify({ sub: USER_ID, aud: 'authenticated', exp: 4102444800, email: 'smoke@example.com', role: 'authenticated' })).toString('base64url')
const token = `${header}.${payload}.`

const EQUIPMENT = [{
  equipment_id: 'CEV-PR-001', equipment_type: 'PRODUCTION', control_number: 'SMOKE', qr_code: 'CEV-PR-001',
  equipment_name: 'Smoke Equipment', model: 'M1', manufacturer: 'CEV', serial_number: 'S1', department: 'PRODUCTION',
  status: 'RUNNING', active: true, source_data: {}, created_at: '2026-08-30T00:00:00Z', updated_at: '2026-08-30T00:00:00Z',
}]

async function installMocks(page: Page) {
  await page.addInitScript(({ authToken, userId }) => {
    localStorage.setItem('sb-supabase-not-configured-auth-token', JSON.stringify({
      access_token: authToken, refresh_token: 'smoke-refresh', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800,
      user: { id: userId, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }))
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => { throw new DOMException('Camera unavailable in CI', 'NotAllowedError') },
      enumerateDevices: async () => [{ kind: 'videoinput', deviceId: 'ci-camera', label: 'CI camera' }],
    } })
  }, { authToken: token, userId: USER_ID })

  await page.route('https://supabase-not-configured.invalid/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
    if (path.includes('/auth/v1/user')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ id: USER_ID, email: 'smoke@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }) })
    if (path.includes('/rest/v1/app_user_role')) return route.fulfill({ status: 200, headers, body: JSON.stringify({ role: 'ADMIN', email: 'smoke@example.com' }) })
    if (path.includes('/rest/v1/equipment_master')) return route.fulfill({ status: 200, headers, body: JSON.stringify(EQUIPMENT) })
    if (path.includes('/rest/v1/rpc/rpc_cmms_scheduler_events')) {
      const now = new Date()
      const at = (hour: number, minute = 0) => {
        const value = new Date(now)
        value.setHours(hour, minute, 0, 0)
        return value.toISOString()
      }
      const schedulerEvents = [
        {
          event_type: 'WORK_ORDER', event_id: 'WO-SMOKE-1', work_order_id: 'WO-SMOKE-1', pm_schedule_id: '', equipment_id: 'CEV-PR-001', equipment_name: 'Smoke Equipment',
          location_id: '', location_name: 'Factory 2', title: 'WO overlap A', status: 'PLANNED', priority: 'NORMAL', start_at: at(9), end_at: at(10, 30), schedule_locked: false,
          primary_person_id: 'P1', primary_person_name: 'Kỹ thuật A', primary_team_id: 'T1', primary_team_name: 'Bảo trì', unscheduled: false, source_data: {},
        },
        {
          event_type: 'WORK_ORDER', event_id: 'WO-SMOKE-2', work_order_id: 'WO-SMOKE-2', pm_schedule_id: '', equipment_id: 'CEV-PR-001', equipment_name: 'Smoke Equipment',
          location_id: '', location_name: 'Factory 2', title: 'WO overlap B', status: 'PLANNED', priority: 'HIGH', start_at: at(9, 30), end_at: at(11), schedule_locked: false,
          primary_person_id: 'P1', primary_person_name: 'Kỹ thuật A', primary_team_id: 'T1', primary_team_name: 'Bảo trì', unscheduled: false, source_data: {},
        },
        ...Array.from({ length: 6 }, (_, index) => ({
          event_type: 'PM_DUE', event_id: `PM-SMOKE-${index + 1}`, work_order_id: '', pm_schedule_id: `PM-SCHEDULE-${index + 1}`, equipment_id: 'CEV-PR-001', equipment_name: 'Smoke Equipment',
          location_id: '', location_name: 'Factory 2', title: `PM Smoke ${index + 1}`, status: index === 0 ? 'OVERDUE' : 'DUE', priority: 'NORMAL', start_at: at(13 + Math.floor(index / 2), index % 2 ? 30 : 0), end_at: '', schedule_locked: false,
          primary_person_id: '', primary_person_name: '', primary_team_id: 'T1', primary_team_name: 'Bảo trì', unscheduled: false,
          source_data: { next_due_at: at(13 + Math.floor(index / 2), index % 2 ? 30 : 0), next_trigger_at: at(12), is_overdue: index === 0, last_generated_work_order_id: index === 1 ? 'WO-PM-SMOKE' : '' },
        })),
      ]
      return route.fulfill({ status: 200, headers, body: JSON.stringify(schedulerEvents) })
    }
    if (path.includes('/rest/v1/rpc/rpc_cmms_scheduler_conflicts')) return route.fulfill({ status: 200, headers, body: '[]' })
    if (path.includes('/rest/v1/rpc/rpc_cmms_reschedule_work_order')) return route.fulfill({ status: 200, headers, body: '{}' })
    if (path.includes('/rest/v1/')) return route.fulfill({ status: 200, headers, body: '[]' })
    if (path.includes('/storage/v1/')) return route.fulfill({ status: 200, headers, body: '[]' })
    return route.fulfill({ status: 200, headers, body: '{}' })
  })
}

async function openApp(page: Page) {
  await installMocks(page)
  await page.goto('/')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
}

function mobile(page: Page) { return Boolean(page.viewportSize() && page.viewportSize()!.width <= 900) }

async function openView(page: Page, label: string) {
  if (!mobile(page)) {
    await page.locator('.desktop-sidebar-nav').getByRole('button', { name: label, exact: true }).click()
  } else if (label === 'Quét QR' || label === 'Thiết bị') {
    await page.locator('.bottom-nav').getByRole('button', { name: label, exact: true }).click()
  } else if (label === 'Bảo trì phòng ngừa') {
    await page.locator('.bottom-nav').getByRole('button', { name: 'Công việc', exact: true }).click()
  }
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
}

async function openMore(page: Page) {
  await page.locator('.bottom-nav').getByRole('button', { name: 'Thêm', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Các chức năng khác' })
  await expect(sheet).toBeVisible()
  return sheet
}

async function expectNoPageHorizontalOverflow(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    return Math.max(root.scrollWidth, body.scrollWidth) - window.innerWidth
  })).toBeLessThanOrEqual(1)
}

test('current navigation surfaces open without browser crash', async ({ page }) => {
  await openApp(page)
  const labels = mobile(page)
    ? ['Quét QR', 'Thiết bị', 'Bảo trì phòng ngừa']
    : ['Quét QR', 'Thiết bị', 'Danh sách kiểm tra', 'Bảo trì phòng ngừa', 'Jig, gá & dụng cụ', 'Hiệu chuẩn', 'Hồ sơ A4', 'Nhật ký & cấu hình']
  for (const label of labels) {
    await openView(page, label)
    await expect(page.locator('main')).toBeVisible()
  }
  if (mobile(page)) await openMore(page)
})

test('preventive maintenance opens plans first and can switch to work orders', async ({ page }) => {
  await openApp(page)
  await openView(page, 'Bảo trì phòng ngừa')
  const workspace = page.locator('.maintenance-workspace')
  await expect(workspace.getByRole('heading', { name: 'Bảo trì phòng ngừa' })).toBeVisible()
  const plansTab = workspace.locator('button[aria-controls="maintenance-tab-plans"]')
  await expect(plansTab).toHaveAttribute('aria-current', 'page')
  const plansPanel = page.locator('#maintenance-tab-plans')
  await expect(plansPanel).toBeVisible()
  await expect(plansPanel.getByRole('heading', { name: 'Bảo trì phòng ngừa' })).toBeVisible()
  const workOrdersTab = workspace.locator('button[aria-controls="maintenance-tab-work-orders"]')
  await workOrdersTab.click()
  await expect(workOrdersTab).toHaveAttribute('aria-current', 'page')
  const workOrdersPanel = page.locator('#maintenance-tab-work-orders')
  await expect(workOrdersPanel).toBeVisible()
  await expect(plansPanel).toBeHidden()
  await expect(workOrdersPanel.locator('.maintenance-queue-tabs').getByRole('button', { name: /^Cần tôi xử lý/ })).toBeVisible()
  await workOrdersPanel.getByRole('button', { name: '+ Tạo lệnh công việc', exact: true }).click()
  const intake = page.getByRole('dialog', { name: 'Tạo yêu cầu bảo trì' })
  await expect(intake).toBeVisible()
  await expect(intake.getByLabel(/^Thiết bị/)).toBeVisible()
  await expect(intake.getByLabel(/^Mức ưu tiên/)).toBeVisible()
  await expect(intake.getByLabel(/^Lý do \/ hiện tượng/)).toBeVisible()
  await expect(intake.getByLabel(/^Xử lý dự kiến \/ ghi chú tiếp nhận/)).toBeVisible()
  await expect(intake.getByLabel(/^Bắt đầu dự kiến/)).toBeVisible()
  await expect(intake.getByLabel(/^Hạn xử lý dự kiến/)).toBeVisible()
  await intake.getByRole('button', { name: 'Hủy', exact: true }).click()
  await expect(intake).toHaveCount(0)
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
})

test('scheduler surfaces PM state, overlap lanes and month overflow list', async ({ page }) => {
  await installMocks(page)
  await page.goto('/?phase3=scheduler')
  await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
  const scheduler = page.locator('.scheduler-workspace')
  await expect(scheduler.getByRole('heading', { name: 'Lịch trình' })).toBeVisible()
  await expect(scheduler.locator('.scheduler-pm-strip')).toContainText('PM trong kỳ')
  await expect(scheduler.locator('.scheduler-pm-strip')).toContainText('PM quá hạn')
  await expect(scheduler.locator('.scheduler-event.pm-overdue')).toHaveCount(1)
  await expect(scheduler.locator('.scheduler-pm-badges').first()).toBeVisible()
  const overlapCards = scheduler.locator('.scheduler-time-events .scheduler-event.wo')
  await expect(overlapCards).toHaveCount(2)
  const widths = await overlapCards.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).width))
  expect(new Set(widths).size).toBeGreaterThanOrEqual(1)
  await scheduler.getByRole('button', { name: 'Tháng', exact: true }).click()
  const more = scheduler.getByRole('button', { name: '+1 công việc', exact: true }).first()
  await expect(more).toBeVisible()
  await more.click()
  await expect(page.getByRole('dialog', { name: /Công việc/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Đóng danh sách ngày' })).toBeVisible()
})

test('QR fallback opens the equipment profile when camera is denied', async ({ page }) => {
  await openApp(page)
  await openView(page, 'Quét QR')
  await page.getByRole('button', { name: 'Chạm để bật camera' }).click()
  await expect(page.locator('.qr-message')).toContainText('Không mở được camera')
  await page.getByRole('combobox', { name: 'Tìm mã hoặc tên thiết bị' }).fill('CEV-PR-001')
  await page.getByRole('button', { name: 'Mở', exact: true }).click()
  const profile = page.locator('.equipment-profile-layer')
  await expect(profile).toBeVisible()
  await expect(profile.getByRole('heading', { level: 2 })).toContainText('CEV-PR-001')
  await profile.getByRole('button', { name: 'Đóng hồ sơ', exact: true }).click()
  await expect(profile).toHaveCount(0)
})

test('A4 and account controls match the current shell', async ({ page }) => {
  await openApp(page)
  if (mobile(page)) {
    const sheet = await openMore(page)
    await expect(sheet).toContainText('Quản trị hệ thống')
    await expect(sheet.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible()
    return
  }
  await openView(page, 'Hồ sơ A4')
  await expect(page.getByRole('heading', { name: 'Hồ sơ / Tem quản lý' })).toBeVisible()
  await expect(page.locator('.a4-document')).toContainText('CEV-BM-TBSX-01')
  await expect(page.getByRole('button', { name: 'In / Xuất PDF A4' })).toBeVisible()
  await expect(page.locator('.sidebar-account')).toContainText('Quản trị hệ thống')
  await expect(page.locator('.sidebar-account').getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible()
})

test('key routes do not create page-level horizontal overflow at target responsive widths', async ({ page }) => {
  const widths = [375, 440, 768, 1024, 1440]
  await page.setViewportSize({ width: widths[0], height: 900 })
  await openApp(page)
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.app-shell')).toHaveAttribute('data-role', 'ADMIN')
    await expect(page.locator('.fatal-screen')).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page)
    const labels = width <= 900
      ? ['Quét QR', 'Thiết bị', 'Bảo trì phòng ngừa']
      : ['Thiết bị', 'Danh sách kiểm tra', 'Bảo trì phòng ngừa', 'Jig, gá & dụng cụ', 'Hiệu chuẩn', 'Hồ sơ A4', 'Nhật ký & cấu hình']
    for (const label of labels) {
      await openView(page, label)
      await expect(page.locator('main')).toBeVisible()
      await expectNoPageHorizontalOverflow(page)
    }
  }
})
