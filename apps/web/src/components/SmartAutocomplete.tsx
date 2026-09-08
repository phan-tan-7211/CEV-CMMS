import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { InputHTMLAttributes, KeyboardEvent } from 'react'
import './SmartAutocomplete.css'

type SmartAutocompleteProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'list'> & {
  value: string
  options: readonly string[]
  onChange: (value: string) => void
  onBlur?: () => void
  maxOptions?: number
}

type Placement = {
  openUp: boolean
  maxHeight: number
}

const MENU_GAP = 6
const DESIRED_MENU_HEIGHT = 240
const MAX_MENU_HEIGHT = 320

function measurePlacement(input: HTMLInputElement): Placement {
  const rect = input.getBoundingClientRect()
  const viewport = window.visualViewport
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
  const spaceBelow = Math.max(0, viewportBottom - rect.bottom - MENU_GAP)
  const spaceAbove = Math.max(0, rect.top - viewportTop - MENU_GAP)
  const openUp = spaceBelow < DESIRED_MENU_HEIGHT && spaceAbove > spaceBelow
  const available = openUp ? spaceAbove : spaceBelow

  return {
    openUp,
    maxHeight: Math.max(0, Math.min(MAX_MENU_HEIGHT, available)),
  }
}

export function SmartAutocomplete({
  value,
  options,
  onChange,
  onBlur,
  maxOptions = 50,
  ...inputProps
}: SmartAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [placement, setPlacement] = useState<Placement>({ openUp: false, maxHeight: MAX_MENU_HEIGHT })
  const reactId = useId()
  const menuId = `smart-autocomplete-${reactId.replaceAll(':', '')}`

  const filteredOptions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase('vi-VN')
    const source = query
      ? options.filter((option) => option.toLocaleLowerCase('vi-VN').includes(query))
      : options
    return source.slice(0, maxOptions)
  }, [maxOptions, options, value])

  const updatePlacement = useCallback(() => {
    if (!inputRef.current) return
    setPlacement(measurePlacement(inputRef.current))
  }, [])

  useEffect(() => {
    if (!open) return

    const viewport = window.visualViewport
    const update = () => requestAnimationFrame(updatePlacement)

    updatePlacement()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
    }
  }, [open, updatePlacement])

  function selectOption(option: string) {
    onChange(option)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    inputProps.onKeyDown?.(event)
    if (event.defaultPrevented) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && open && activeIndex >= 0 && filteredOptions[activeIndex]) {
      event.preventDefault()
      selectOption(filteredOptions[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const showMenu = open && filteredOptions.length > 0 && placement.maxHeight >= 44

  return <div className="smart-autocomplete">
    <input
      {...inputProps}
      ref={inputRef}
      value={value}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={showMenu}
      aria-controls={showMenu ? menuId : undefined}
      aria-activedescendant={showMenu && activeIndex >= 0 ? `${menuId}-${activeIndex}` : undefined}
      onFocus={(event) => {
        inputProps.onFocus?.(event)
        setActiveIndex(-1)
        setOpen(true)
        requestAnimationFrame(updatePlacement)
      }}
      onChange={(event) => {
        setActiveIndex(-1)
        onChange(event.target.value)
        setOpen(true)
      }}
      onBlur={() => {
        setOpen(false)
        setActiveIndex(-1)
        onBlur?.()
      }}
      onKeyDown={handleKeyDown}
    />
    {showMenu ? <div
      id={menuId}
      className={`smart-autocomplete-menu ${placement.openUp ? 'open-up' : 'open-down'}`}
      role="listbox"
      style={{ maxHeight: placement.maxHeight }}
    >
      {filteredOptions.map((option, index) => <button
        id={`${menuId}-${index}`}
        key={option}
        type="button"
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? 'is-active' : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => selectOption(option)}
      >{option}</button>)}
    </div> : null}
  </div>
}
