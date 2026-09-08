import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function EquipmentRegisterShortcut() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      if (!window.matchMedia('(min-width: 901px)').matches) {
        setTarget(null)
        setAvailable(false)
        setOpen(false)
        return
      }
      const nextTarget = document.querySelector<HTMLElement>('.equipment-page-actions')
      const internalToggle = document.querySelector<HTMLButtonElement>('.equipment-register-toggle')
      setTarget(nextTarget)
      setAvailable(Boolean(nextTarget && internalToggle))
      setOpen(Boolean(document.querySelector('.equipment-register-form')))
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [])

  if (!target || !available) return null

  return createPortal(
    <button
      type="button"
      className={`equipment-register-header-action${open ? ' active' : ''}`}
      onClick={() => document.querySelector<HTMLButtonElement>('.equipment-register-toggle')?.click()}
    >
      {open ? 'Thu gọn đăng ký' : '+ Đăng ký'}
    </button>,
    target,
  )
}
