import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = process.cwd()
const srcRoot = resolve(root, 'src')
const equipmentRoot = resolve(srcRoot, 'equipment')
const dataRoot = resolve(srcRoot, 'data')
const violations = []

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function text(path) {
  return readFileSync(path, 'utf8')
}

function report(path, message) {
  violations.push(`${relative(root, path)}: ${message}`)
}

function importsSegment(body, segment) {
  return body.includes(`/${segment}/`) || body.includes(`\\${segment}\\`)
}

function isTestSource(path) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path.replaceAll('\\', '/'))
}

const sourceFiles = walk(srcRoot).filter((path) => ['.ts', '.tsx', '.js', '.jsx', '.css'].includes(extname(path)))
const productionSourceFiles = sourceFiles.filter((path) => !isTestSource(path))
const equipmentFiles = productionSourceFiles.filter((path) => path.startsWith(equipmentRoot))
const dataFiles = productionSourceFiles.filter((path) => path.startsWith(dataRoot))
const retiredRootStyles = ['Equipment.css', 'EquipmentSheetView.css', 'EquipmentRegistration.css']

for (const path of productionSourceFiles) {
  const body = text(path)
  if (body.includes('LiveEquipmentPanel')) report(path, 'legacy mixed LiveEquipmentPanel reference is forbidden')

  for (const file of retiredRootStyles) {
    if (body.includes(`'./${file}'`) || body.includes(`"./${file}"`) || body.includes(`'../${file}'`) || body.includes(`"../${file}"`) || body.includes(`'../../${file}'`) || body.includes(`"../../${file}"`)) {
      report(path, `${file} is retired; import equipment-owned styles directly`)
    }
  }
}

for (const path of equipmentFiles) {
  const body = text(path)
  const normalized = path.replaceAll('\\', '/')

  if (normalized.includes('/equipment/desktop/') && importsSegment(body, 'mobile')) {
    report(path, 'desktop must not import mobile code')
  }

  if (normalized.includes('/equipment/mobile/') && importsSegment(body, 'desktop')) {
    report(path, 'mobile must not import desktop code')
  }

  if (normalized.includes('/equipment/shared/')) {
    if (importsSegment(body, 'desktop') || importsSegment(body, 'mobile')) {
      report(path, 'shared layer must not import platform presentation')
    }
    if (body.includes('supabaseClient') || body.includes('@supabase/supabase-js')) {
      report(path, 'shared UI/controller must use repositories/services instead of importing Supabase client directly')
    }
    if (extname(path) === '.css' && body.includes('@media')) {
      report(path, 'shared CSS must not contain viewport media queries')
    }
  }
}

for (const path of dataFiles) {
  const normalized = path.replaceAll('\\', '/')
  if (normalized.endsWith('/dataGateway.ts') || normalized.endsWith('/supabaseClient.ts')) continue
  const body = text(path)
  if (body.includes('supabaseClient') || body.includes('@supabase/supabase-js')) {
    report(path, 'data repository must use dataGateway instead of importing Supabase client directly')
  }
}

for (const retired of retiredRootStyles) {
  const absolute = resolve(srcRoot, retired)
  if (existsSync(absolute)) violations.push(`src/${retired}: retired compatibility stylesheet must be deleted`)
}

const registrationPanel = resolve(root, 'src/LiveEquipmentRegistrationPanel.tsx')
if (existsSync(registrationPanel)) {
  const body = text(registrationPanel)
  if (!body.includes("./equipment/shared/styles/EquipmentPrimitives.css") || !body.includes("./equipment/shared/styles/EquipmentRegistrationPrimitives.css")) {
    report(registrationPanel, 'registration must consume Equipment shared primitive styles directly')
  }
}

const required = [
  'src/equipment/EquipmentWorkspace.tsx',
  'src/equipment/desktop/EquipmentDesktopWorkspace.tsx',
  'src/equipment/desktop/EquipmentDesktopPanel.tsx',
  'src/equipment/mobile/EquipmentMobileWorkspace.tsx',
  'src/equipment/mobile/EquipmentMobilePanel.tsx',
  'src/equipment/shared/styles/EquipmentPrimitives.css',
  'src/equipment/shared/styles/EquipmentSheetPrimitives.css',
  'src/equipment/shared/styles/EquipmentRegistrationPrimitives.css',
]

for (const requiredPath of required) {
  if (!existsSync(resolve(root, requiredPath))) violations.push(`${requiredPath}: required architecture file is missing`)
}

if (violations.length) {
  console.error('\nPlatform architecture violations:\n')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('Platform architecture check passed.')
