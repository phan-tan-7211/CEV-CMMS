import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const readRepoFile = (path: string) => readFileSync(resolve(root, '../..', path), 'utf8')

function filesUnder(path: string): string[] {
  const absolute = resolve(root, path)
  if (!existsSync(absolute)) return []
  return readdirSync(absolute).flatMap((name) => {
    const child = `${path}/${name}`
    return statSync(resolve(root, child)).isDirectory() ? filesUnder(child) : [child]
  })
}
function sourceFiles(path: string) { return filesUnder(path).filter((file) => /\.(ts|tsx|css)$/.test(file)) }

describe('Equipment platform architecture', () => {
  it('routes Equipment through the viewport workspace instead of the legacy mixed panel', () => {
    const app = read('src/App.tsx')
    expect(app).toContain("./equipment/EquipmentWorkspace")
    expect(app).not.toContain("./LiveEquipmentPanel")
    expect(existsSync(resolve(root, 'src/LiveEquipmentPanel.tsx'))).toBe(false)
  })

  it('keeps desktop and mobile composition independent', () => {
    const desktop = read('src/equipment/desktop/EquipmentDesktopWorkspace.tsx')
    const mobile = read('src/equipment/mobile/EquipmentMobileWorkspace.tsx')
    expect(desktop).toContain('EquipmentDesktopPanel')
    expect(desktop).not.toContain('EquipmentMobile')
    expect(desktop).not.toContain('LiveEquipmentPanel')
    expect(mobile).toContain('EquipmentMobilePanel')
    expect(mobile).not.toContain('EquipmentDesktop')
    expect(mobile).not.toContain('LiveEquipmentPanel')
  })

  it('forbids cross-platform imports anywhere under desktop/mobile', () => {
    for (const file of sourceFiles('src/equipment/desktop')) expect(read(file), `${file} must not reference mobile presentation`).not.toMatch(/(?:from\s+['"][^'"]*\/mobile\/|EquipmentMobile)/)
    for (const file of sourceFiles('src/equipment/mobile')) expect(read(file), `${file} must not reference desktop presentation`).not.toMatch(/(?:from\s+['"][^'"]*\/desktop\/|EquipmentDesktop)/)
  })

  it('keeps shared code free of platform presentation imports and names', () => {
    for (const file of sourceFiles('src/equipment/shared')) {
      const content = read(file)
      expect(content, `${file} must not import desktop presentation`).not.toMatch(/\/desktop\/|EquipmentDesktop/)
      expect(content, `${file} must not import mobile presentation`).not.toMatch(/\/mobile\/|EquipmentMobile/)
    }
  })

  it('keeps shared primitive styles viewport-neutral', () => {
    for (const file of [
      'src/equipment/shared/styles/EquipmentPrimitives.css',
      'src/equipment/shared/styles/EquipmentSheetPrimitives.css',
      'src/equipment/shared/styles/EquipmentRegistrationPrimitives.css',
    ]) expect(read(file), `${file} must not own viewport layout`).not.toMatch(/@media\s*\(/)
  })

  it('makes platform panels consume equipment-owned primitives directly', () => {
    for (const file of ['src/equipment/desktop/EquipmentDesktopPanel.tsx', 'src/equipment/mobile/EquipmentMobilePanel.tsx']) {
      const content = read(file)
      expect(content).toContain("../shared/styles/EquipmentPrimitives.css")
      expect(content).toContain("../shared/styles/EquipmentSheetPrimitives.css")
      expect(content).toContain('EquipmentTableHeaderCell')
      expect(content).toContain('EquipmentTableValue')
      expect(content).toContain('EquipmentEditFormContent')
    }
  })

  it('keeps registration on equipment-owned styles', () => {
    const registration = read('src/LiveEquipmentRegistrationPanel.tsx')
    expect(registration).toContain("./equipment/shared/styles/EquipmentPrimitives.css")
    expect(registration).toContain("./equipment/shared/styles/EquipmentRegistrationPrimitives.css")
  })

  it('removes retired root Equipment compatibility styles', () => {
    for (const file of ['src/Equipment.css','src/EquipmentSheetView.css','src/EquipmentRegistration.css']) {
      expect(existsSync(resolve(root, file)), `${file} must stay deleted`).toBe(false)
    }
  })

  it('keeps the panel controller as an orchestrator of focused shared hooks', () => {
    const controller = read('src/equipment/shared/useEquipmentPanelController.ts')
    for (const hook of ['useEquipmentData','useEquipmentTableState','useEquipmentPhotos','useEquipmentBulkEdit','useEquipmentEditing']) expect(controller).toContain(hook)
    expect(controller).not.toContain('loadLiveEquipment')
    expect(controller).not.toContain('getEquipmentCacheSnapshot')
  })

  it('renders normal mobile equipment as cards while preserving spreadsheet bulk editing', () => {
    const mobile = read('src/equipment/mobile/EquipmentMobilePanel.tsx')
    const mobileCss = read('src/equipment/mobile/EquipmentMobile.css')
    expect(mobile).toContain('equipment-mobile-card-list')
    expect(mobile).toContain('MobileBulkTable')
    expect(mobile).toContain('MobileFilterFields')
    expect(mobileCss).toContain('.equipment-mobile-card')
    expect(mobileCss).toContain('.equipment-mobile-filter-fields')
  })

  it('keeps mobile registration to one scroll owner and above bottom navigation', () => {
    const mobileForms = read('src/equipment/mobile/EquipmentMobileForms.css')
    expect(mobileForms).toContain('body:has(.equipment-register-drawer){overflow:hidden}')
    expect(mobileForms).toContain('.equipment-drawer-backdrop:has(.equipment-register-drawer){bottom:calc(64px + env(safe-area-inset-bottom))')
    expect(mobileForms).toContain('.equipment-register-scroll{min-height:0;padding-bottom:12px;overscroll-behavior:contain')
  })

  it('uses one explicit 901px platform boundary', () => {
    expect(read('src/equipment/EquipmentWorkspace.tsx')).toContain('(min-width: 901px)')
    expect(read('src/equipment/desktop/EquipmentDesktop.css')).toContain('(min-width:901px)')
    expect(read('src/equipment/mobile/EquipmentMobile.css')).toContain('(max-width:900px)')
  })

  it('documents the same platform contract in project rules', () => {
    for (const content of [readRepoFile('AGENTS.md'), readRepoFile('docs/FRONTEND_PLATFORM_ARCHITECTURE.md'), readRepoFile('.agents/skills/platform-ui-architecture/SKILL.md')]) {
      expect(content).toContain('901px')
      expect(content).toContain('desktop')
      expect(content).toContain('mobile')
    }
  })
})
