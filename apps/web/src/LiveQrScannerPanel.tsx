import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import './QrScanner.css'
import './QrCompact.css'
import { loadQrEquipmentIndex, parseEquipmentIdFromQr, type QrEquipmentIndexItem } from './data/qrIndex'

type Props = {
  onOpenEquipment: (equipmentId: string) => void
}

type ScanFeedback = {
  kind: 'warning'
  title: string
  detail: string
  rawValue: string
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* Visual feedback remains available. */ }
}

function searchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

export function LiveQrScannerPanel({ onOpenEquipment }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const cameraAttemptRef = useRef(0)
  const startingRef = useRef(false)
  const acceptedRef = useRef(false)
  const feedbackTimerRef = useRef<number | null>(null)
  const lastRejectedRef = useRef({ value: '', at: 0 })
  const [index, setIndex] = useState<QrEquipmentIndexItem[]>([])
  const [indexLoading, setIndexLoading] = useState(true)
  const [indexError, setIndexError] = useState('')
  const [cameraState, setCameraState] = useState<'IDLE' | 'STARTING' | 'SCANNING' | 'ERROR'>('IDLE')
  const [message, setMessage] = useState('Đưa QR thiết bị vào khung để quét.')
  const [manualCode, setManualCode] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [activeOption, setActiveOption] = useState(-1)
  const [hasFlash, setHasFlash] = useState(false)
  const [flashOn, setFlashOn] = useState(false)
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null)

  const equipmentById = useMemo(() => new Map(index.map((item) => [item.equipmentId, item])), [index])
  const suggestions = useMemo(() => {
    const words = searchText(manualCode).split(/\s+/).filter(Boolean)
    return index.filter((item) => {
      const text = searchText(`${item.equipmentId} ${item.equipmentName}`)
      return words.every((word) => text.includes(word))
    }).slice(0, 6)
  }, [index, manualCode])

  useEffect(() => {
    let active = true
    void loadQrEquipmentIndex()
      .then((rows) => { if (active) setIndex(rows) })
      .catch((cause) => { if (active) setIndexError(cause instanceof Error ? cause.message : 'Không tải được danh sách thiết bị') })
      .finally(() => { if (active) setIndexLoading(false) })
    return () => { active = false }
  }, [])

  const stopCamera = useCallback(() => {
    cameraAttemptRef.current += 1
    startingRef.current = false
    scannerRef.current?.stop()
    scannerRef.current?.destroy()
    scannerRef.current = null
    setHasFlash(false)
    setFlashOn(false)
  }, [])

  useEffect(() => () => {
    stopCamera()
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
  }, [stopCamera])

  function clearFeedback() {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current)
    feedbackTimerRef.current = null
    setFeedback(null)
  }

  function rejectValue(value: string, messageText: string) {
    const now = Date.now()
    if (lastRejectedRef.current.value === value && now - lastRejectedRef.current.at < 1200) return
    lastRejectedRef.current = { value, at: now }
    setMessage(messageText)
    clearFeedback()
    setFeedback({ kind: 'warning', title: 'Đã đọc QR · chưa mở được hồ sơ', detail: messageText, rawValue: value })
    vibrate(80)
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null)
      feedbackTimerRef.current = null
    }, 1600)
  }

  function acceptValue(rawValue: string) {
    if (acceptedRef.current) return false
    const equipmentId = parseEquipmentIdFromQr(rawValue)
    if (!equipmentId) {
      rejectValue(rawValue, 'QR không chứa mã thiết bị CEV hợp lệ.')
      return false
    }

    const equipment = equipmentById.get(equipmentId)
    if (!equipment) {
      rejectValue(rawValue, `${equipmentId} không có trong danh sách thiết bị.`)
      return false
    }

    acceptedRef.current = true
    setSuggestionsOpen(false)
    stopCamera()
    clearFeedback()
    setCameraState('IDLE')
    vibrate(80)
    onOpenEquipment(equipmentId)
    return true
  }

  async function startCamera() {
    if (startingRef.current || acceptedRef.current) return
    if (indexLoading) {
      setMessage('Đang tải thiết bị…')
      return
    }

    stopCamera()
    clearFeedback()
    lastRejectedRef.current = { value: '', at: 0 }
    const attempt = cameraAttemptRef.current
    startingRef.current = true
    setCameraState('STARTING')
    setMessage('Đang mở camera sau…')

    try {
      if (!await QrScanner.hasCamera()) throw new Error('Thiết bị không có camera khả dụng')
      if (attempt !== cameraAttemptRef.current) return
      const video = videoRef.current
      if (!video) throw new Error('QR_VIDEO_UNAVAILABLE')

      const scanner = new QrScanner(
        video,
        (result) => { if (attempt === cameraAttemptRef.current && result.data) acceptValue(result.data) },
        {
          preferredCamera: 'environment',
          maxScansPerSecond: 25,
          returnDetailedScanResult: true,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          onDecodeError: () => undefined,
        },
      )
      scannerRef.current = scanner
      await scanner.start()
      if (attempt !== cameraAttemptRef.current) return
      startingRef.current = false
      setCameraState('SCANNING')
      setMessage('Đưa mã QR vào khung.')
      const flashAvailable = await scanner.hasFlash().catch(() => false)
      if (attempt !== cameraAttemptRef.current) return
      setHasFlash(flashAvailable)
    } catch (cause) {
      if (attempt !== cameraAttemptRef.current) return
      stopCamera()
      setCameraState('ERROR')
      setMessage(cause instanceof Error ? `Không mở được camera: ${cause.message}` : 'Không mở được camera.')
    }
  }

  function toggleCamera() {
    if (indexLoading || startingRef.current || acceptedRef.current) return
    if (cameraState === 'SCANNING') {
      stopCamera()
      clearFeedback()
      setCameraState('IDLE')
      setMessage('Đã dừng camera. Chạm vào khung để quét tiếp.')
    } else {
      void startCamera()
    }
  }

  async function toggleFlash() {
    const scanner = scannerRef.current
    if (!scanner || !hasFlash) return
    try {
      if (flashOn) await scanner.turnFlashOff()
      else await scanner.turnFlashOn()
      setFlashOn((value) => !value)
    } catch {
      setMessage('Camera này không bật được đèn flash.')
    }
  }

  function submitManualCode(selectedId?: string) {
    const value = selectedId ?? manualCode.trim()
    if (!value) return
    if (acceptValue(value)) setManualCode('')
  }

  return <div className="qr-page">
    <section className="qr-scanner-card">
      <div className={`qr-camera ${cameraState.toLowerCase()}${feedback ? ` qr-feedback-${feedback.kind}` : ''}`}>
        <video ref={videoRef} playsInline muted aria-label="Camera quét QR" />
        <div className="qr-scan-frame" aria-hidden="true"><span /><span /><span /><span /></div>
        <button
          className="qr-camera-toggle"
          type="button"
          onClick={toggleCamera}
          disabled={indexLoading || cameraState === 'STARTING'}
          aria-label={cameraState === 'SCANNING' ? 'Chạm để tắt camera' : 'Chạm để bật camera'}
          aria-pressed={cameraState === 'SCANNING'}
          aria-busy={cameraState === 'STARTING'}
        >
          <span className="qr-camera-prompt">
            <svg className="qr-camera-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {cameraState === 'SCANNING'
                ? <rect x="6" y="6" width="12" height="12" rx="2" />
                : <><path d="M8 5l2-2h4l2 2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><circle cx="12" cy="12" r="4" /></>}
            </svg>
            <strong>{indexLoading ? 'Đang tải thiết bị…' : cameraState === 'STARTING' ? 'Đang mở camera…' : cameraState === 'SCANNING' ? 'Chạm để tắt camera' : 'Chạm để bật camera'}</strong>
            {cameraState !== 'SCANNING' ? <span>Chạm ở bất kỳ đâu trong khung này</span> : null}
          </span>
        </button>
        {cameraState === 'SCANNING' && !feedback ? <div className="qr-live-guidance">Đặt QR vào giữa khung để quét</div> : null}
        {feedback ? <div className={`qr-scan-feedback ${feedback.kind}`} role="alert" aria-atomic="true">
          <span className="qr-feedback-symbol" aria-hidden="true">!</span>
          <strong>{feedback.title}</strong>
          <span className="qr-feedback-raw">{feedback.rawValue}</span>
          <span className="qr-feedback-detail">{feedback.detail}</span>
          <small>{cameraState === 'SCANNING' ? 'Camera vẫn đang quét.' : 'Nhập mã khác hoặc bật camera để quét.'}</small>
        </div> : null}
      </div>

      {cameraState === 'ERROR' || indexError || (cameraState === 'SCANNING' && hasFlash) ? <div className="qr-controls">
        {cameraState === 'SCANNING' && hasFlash ? <button className="qr-flash" type="button" onClick={() => void toggleFlash()}>{flashOn ? 'Tắt đèn' : 'Bật đèn'}</button> : null}
        {cameraState === 'ERROR' || indexError ? <div className="qr-message" role="status">{indexError || message}</div> : null}
      </div> : null}
    </section>

    <section className="qr-manual-card">
      <label className="sr-only" htmlFor="qr-equipment-search">Tìm mã hoặc tên thiết bị</label>
      <div className="qr-manual-row">
        <input id="qr-equipment-search" role="combobox" aria-autocomplete="list"
          aria-expanded={suggestionsOpen} aria-controls="qr-equipment-options"
          aria-activedescendant={suggestionsOpen && activeOption >= 0 && suggestions[activeOption] ? `qr-option-${activeOption}` : undefined}
          value={manualCode} disabled={indexLoading}
          onFocus={() => setSuggestionsOpen(true)} onBlur={() => setSuggestionsOpen(false)}
          onChange={(event) => { setManualCode(event.target.value); setActiveOption(-1); setSuggestionsOpen(true) }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setSuggestionsOpen(false); setActiveOption(-1) }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setSuggestionsOpen(true)
              setActiveOption((current) => suggestions.length ? (current + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1) + suggestions.length) % suggestions.length : -1)
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              submitManualCode(suggestionsOpen && activeOption >= 0 ? suggestions[activeOption]?.equipmentId : undefined)
            }
          }} placeholder="Tìm mã hoặc tên thiết bị…" autoCapitalize="off" autoComplete="off" />
        <button type="button" onClick={() => submitManualCode()} disabled={!manualCode.trim() || indexLoading}>Mở</button>
      </div>
      {suggestionsOpen ? <div className="qr-suggestions" id="qr-equipment-options" role="listbox" aria-label="Thiết bị gợi ý">
        {suggestions.length ? suggestions.map((item, position) => <div
          key={item.equipmentId} id={`qr-option-${position}`} role="option" aria-selected={position === activeOption}
          onPointerDown={(event) => event.preventDefault()} onClick={() => submitManualCode(item.equipmentId)}
        ><strong>{item.equipmentId}</strong><span>{item.equipmentName}</span></div>)
          : <div role="status">Không tìm thấy thiết bị. Thử mã hoặc tên khác.</div>}
      </div> : null}
    </section>
  </div>
}
