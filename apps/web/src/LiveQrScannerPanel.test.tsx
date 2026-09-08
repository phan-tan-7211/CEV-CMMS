/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  index: vi.fn(), hasCamera: vi.fn(), construct: vi.fn(), start: vi.fn(),
  stop: vi.fn(), destroy: vi.fn(), hasFlash: vi.fn(), turnFlashOn: vi.fn(), turnFlashOff: vi.fn(),
}))
vi.mock('./data/qrIndex', () => ({
  loadQrEquipmentIndex: mocks.index,
  parseEquipmentIdFromQr: (value: string) => value.match(/CEV-(?:PR|ME)-\d{3}/)?.[0] || '',
}))
vi.mock('qr-scanner', () => ({ default: class {
  static hasCamera = mocks.hasCamera
  constructor(...args: unknown[]) { mocks.construct(...args) }
  start = mocks.start
  stop = mocks.stop
  destroy = mocks.destroy
  hasFlash = mocks.hasFlash
  turnFlashOn = mocks.turnFlashOn
  turnFlashOff = mocks.turnFlashOff
} }))
import { LiveQrScannerPanel } from './LiveQrScannerPanel'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.index.mockResolvedValue([])
  mocks.hasCamera.mockResolvedValue(true)
  mocks.start.mockResolvedValue(undefined)
  mocks.hasFlash.mockResolvedValue(false)
  mocks.turnFlashOn.mockResolvedValue(undefined)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function mountReady(onOpenEquipment = vi.fn()) {
  const view = render(<LiveQrScannerPanel onOpenEquipment={onOpenEquipment} />)
  const toggle = screen.getByRole('button', { name: 'Chạm để bật camera' })
  await waitFor(() => expect(toggle).toBeEnabled())
  return { ...view, toggle }
}

describe('tap the QR frame to control the camera', () => {
  it('uses one native button over the frame to start, stop and restart', async () => {
    const { toggle } = await mountReady()
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.closest('.qr-camera')).not.toBeNull()
    expect(screen.queryByText('Mở camera & quét ngay')).not.toBeInTheDocument()
    fireEvent.click(toggle)
    const stop = await screen.findByRole('button', { name: 'Chạm để tắt camera' })
    expect(stop).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(stop)
    expect(mocks.stop).toHaveBeenCalledOnce()
    expect(mocks.destroy).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Chạm để bật camera' }))
    await screen.findByRole('button', { name: 'Chạm để tắt camera' })
    expect(mocks.start).toHaveBeenCalledTimes(2)
  })

  it('disables the frame until the equipment index is ready', async () => {
    let resolve!: (rows: never[]) => void
    mocks.index.mockReturnValue(new Promise(r => { resolve = r }))
    render(<LiveQrScannerPanel onOpenEquipment={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Chạm để bật camera' })
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    expect(mocks.hasCamera).not.toHaveBeenCalled()
    await act(async () => resolve([]))
    expect(toggle).toBeEnabled()
  })

  it('does not create multiple cameras during repeated taps while starting', async () => {
    let resolve!: () => void
    mocks.start.mockReturnValue(new Promise<void>(r => { resolve = r }))
    const { toggle } = await mountReady()
    fireEvent.click(toggle)
    await waitFor(() => expect(mocks.start).toHaveBeenCalledOnce())
    expect(toggle).toBeDisabled()
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(mocks.construct).toHaveBeenCalledOnce()
    await act(async () => resolve())
    expect(await screen.findByRole('button', { name: 'Chạm để tắt camera' })).toBeEnabled()
  })

  it('allows retry from the frame after a camera permission error', async () => {
    mocks.start.mockRejectedValueOnce(new Error('Permission denied'))
    const { toggle } = await mountReady()
    fireEvent.click(toggle)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Permission denied'))
    expect(toggle).toBeEnabled()
    fireEvent.click(toggle)
    await screen.findByRole('button', { name: 'Chạm để tắt camera' })
  })

  it('keeps flash controls outside the frame without stopping the camera', async () => {
    mocks.hasFlash.mockResolvedValue(true)
    const { toggle } = await mountReady()
    fireEvent.click(toggle)
    const flash = await screen.findByRole('button', { name: 'Bật đèn' })
    expect(flash.closest('.qr-camera')).toBeNull()
    fireEvent.click(flash)
    await screen.findByRole('button', { name: 'Tắt đèn' })
    expect(mocks.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Chạm để tắt camera' })).toBeEnabled()
  })

  it('does not construct a camera after leaving during the camera check', async () => {
    let resolve!: (available: boolean) => void
    mocks.hasCamera.mockReturnValue(new Promise<boolean>(r => { resolve = r }))
    const { toggle, unmount } = await mountReady()
    fireEvent.click(toggle)
    unmount()
    await act(async () => resolve(true))
    expect(mocks.construct).not.toHaveBeenCalled()
  })
})

describe('visible scan acknowledgement inside the camera frame', () => {
  const equipment = { equipmentId: 'CEV-PR-001', equipmentName: 'Máy test QR', equipmentType: 'PRODUCTION', status: 'ACTIVE' }

  async function scanning(onOpenEquipment = vi.fn()) {
    mocks.index.mockResolvedValue([equipment])
    const view = await mountReady(onOpenEquipment)
    fireEvent.click(view.toggle)
    await screen.findByRole('button', { name: 'Chạm để tắt camera' })
    const decode = mocks.construct.mock.calls[0][1] as (result: { data: string }) => void
    return { ...view, decode, onOpenEquipment }
  }

  it('opens immediately without a success message and only once', async () => {
    const { decode, onOpenEquipment } = await scanning()
    const vibration = vi.fn()
    vi.stubGlobal('navigator', { vibrate: vibration })
    vi.useFakeTimers()
    act(() => decode({ data: 'CEV-PR-001' }))
    expect(onOpenEquipment).toHaveBeenCalledExactlyOnceWith('CEV-PR-001')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText('Đang mở hồ sơ…')).not.toBeInTheDocument()
    expect(mocks.stop).toHaveBeenCalledOnce()
    act(() => decode({ data: 'CEV-PR-001' }))
    act(() => vi.advanceTimersByTime(2000))
    expect(onOpenEquipment).toHaveBeenCalledTimes(1)
    expect(vibration).toHaveBeenCalledExactlyOnceWith(80)
  })

  it('warns in-frame for invalid and unknown codes while scanning continues', async () => {
    const { decode, onOpenEquipment } = await scanning()
    vi.useFakeTimers()
    act(() => decode({ data: 'not-a-device' }))
    expect(screen.getByRole('alert').closest('.qr-camera')).not.toBeNull()
    expect(screen.queryByText('Đặt QR vào giữa khung để quét')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('not-a-device')
    expect(screen.getByRole('alert')).toHaveTextContent('QR không chứa mã thiết bị CEV hợp lệ')
    act(() => decode({ data: 'https://example.com/equipment/CEV-PR-999?source=qr' }))
    expect(screen.getByRole('alert')).toHaveTextContent('CEV-PR-999 không có trong danh sách thiết bị')
    expect(screen.getByRole('alert')).toHaveTextContent('https://example.com/equipment/CEV-PR-999?source=qr')
    expect(mocks.stop).not.toHaveBeenCalled()
    expect(onOpenEquipment).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1600))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Đặt QR vào giữa khung để quét').closest('.qr-camera')).not.toBeNull()
    act(() => decode({ data: 'CEV-PR-001' }))
    expect(onOpenEquipment).toHaveBeenCalledExactlyOnceWith('CEV-PR-001')
  })

  it('ignores stale camera results after leaving the QR screen', async () => {
    const { decode, onOpenEquipment, unmount } = await scanning()
    unmount()
    act(() => decode({ data: 'CEV-PR-001' }))
    expect(onOpenEquipment).not.toHaveBeenCalled()
  })
})
