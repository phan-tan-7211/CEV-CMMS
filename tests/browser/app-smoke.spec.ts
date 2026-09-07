import { expect, test, type Page } from '@playwright/test'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const payload = Buffer.from(JSON.stringify({ sub: USER_ID, aud: 'authenticated', exp: 4102444800, email: 'smoke@example.com', role: 'authenticated' })).toString('base64url')
const token = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${payload}.`

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

function mobile(page: Page) {
  return Boolean(page.viewportSize() && page.viewportSize()!.width <= 900)
}

async function openView(page: Page, label: string) {
  if (!mobile(page)) {
    await page.locator('.sidebar nav').getByRole('button', { name: label, exact: true }).click()
  } else if (label === 'Quét QR' || label === 'Thiết bị') {
    await page.locator('.bottom-nav').getByRole('button', { name: label, exact: true }).click()
  } else if (label === 'Bảo trì') {
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

test('current navigation surfaces open without browser crash', async ({ page }) => {
  await openApp(page)
  const labels = mobile(page)
    ? ['Quét QR', 'Thiết bị', 'Bảo trì']
    : ['Quét QR', 'Thiết bị', 'Kiểm tra ngày', 'Bảo trì', 'Jig, gá & dụng cụ', 'Hiệu chuẩn', 'Hồ sơ A4', 'Nhật ký & cấu hình']
  for (const label of labels) {
    await openView(page, label)
    await expect(page.locator('main')).toBeVisible()
  }
  if (mobile(page)) await openMore(page)
})

test('maintenance opens work orders first and can switch record tabs', async ({ page }) => {
  await openApp(page)
  await openView(page, 'Bảo trì')
  const workspace = page.locator('.maintenance-workspace')
  await expect(workspace.getByRole('heading', { name: 'Bảo trì thiết bị' })).toBeVisible()
  const workOrdersTab = workspace.getByRole('button', { name: /^Công việc/ })
  await expect(workOrdersTab).toHaveAttribute('aria-current', 'page')
  const workOrdersPanel = page.locator('#maintenance-tab-work-orders')
  await expect(workOrdersPanel).toBeVisible()
  await expect(workOrdersPanel.getByRole('button', { name: /^Cần tôi xử lý/ })).toBeVisible()

  await workOrdersPanel.getByRole('button', { name: '+ Tạo lệnh công việc', exact: true }).click()
  const intake = page.getByRole('dialog', { name: 'Tạo yêu cầu bảo trì' })
  await expect(intake).toBeVisible()
  await expect(intake.getByLabel(/^Thiết bị/)).toBeVisible()
  await expect(intake.getByLabel(/^Mức ưu tiên/)).toBeVisible()
  await expect(intake.getByLabel(/^Lý do \/ hiện tượng/)).toBeVisible()
  await expect(intake.getByLabel(/^Xử lý dự kiến \/ ghi chú tiếp nhận/)).toBeVisible()
  await expect(intake.getByLabel(/^Bắt đầu dự kiến/)).toBeVisible()
  await expect(intake.getByLabel(/^Kết thúc dự kiến/)).toBeVisible()
  await intake.getByRole('button', { name: 'Hủy', exact: true }).click()
  await expect(intake).toHaveCount(0)

  const plansTab = workspace.getByRole('button', { name: /^Kế hoạch/ })
  await plansTab.click()
  await expect(plansTab).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#maintenance-tab-plans')).toBeVisible()
  await expect(workOrdersPanel).toBeHidden()
  await expect(page.locator('.fatal-screen')).toHaveCount(0)
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
  await expect(page.locator('.sidebar-user')).toContainText('Quản trị hệ thống')
  await expect(page.locator('.sidebar-user').getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible()
})