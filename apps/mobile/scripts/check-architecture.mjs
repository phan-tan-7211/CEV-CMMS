import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const screensRoot = path.join(root, 'src', 'screens')
const navigationRoot = path.join(root, 'src', 'navigation')
const violations = []

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const filesToCheck = [
  ...walk(screensRoot).filter((value) => /\.(ts|tsx)$/.test(value)),
  ...walk(navigationRoot).filter((value) => /\.(ts|tsx)$/.test(value)),
  path.join(root, 'App.tsx'),
].filter((value) => fs.existsSync(value))

for (const file of filesToCheck) {
  const relative = path.normalize(path.relative(root, file))
  const source = fs.readFileSync(file, 'utf8')

  const directSupabase = /from\s+['"][^'"]*(?:supabase|lib\/supabase\/client)['"]/.test(source)
  if (directSupabase) {
    violations.push(`${relative}: route/entry UI must not import Supabase directly`)
  }

  const directEquipmentImplementation = /from\s+['"][^'"]*(?:services\/(?:equipmentService|equipmentImageService|equipmentStatusService)|components\/EquipmentPhoto|equipmentSuggestions|SuggestField|features\/equipment\/(?:api|model|ui)\/)[^'"]*['"]/.test(source)
  if (directEquipmentImplementation) {
    violations.push(`${relative}: import Equipment capabilities from features/equipment public API only`)
  }

  const directAuthImplementation = /from\s+['"][^'"]*(?:services\/authService|features\/auth\/api\/)[^'"]*['"]/.test(source)
  if (directAuthImplementation) {
    violations.push(`${relative}: import Auth capabilities from features/auth public API only`)
  }

  const directSettingsImplementation = /from\s+['"][^'"]*features\/settings\/api\/[^'"]*['"]/.test(source)
  if (directSettingsImplementation) {
    violations.push(`${relative}: import Settings capabilities from features/settings public API only`)
  }
}

if (violations.length) {
  console.error('\nMobile architecture boundary violations:\n')
  for (const violation of violations) console.error(`- ${violation}`)
  console.error('\nSee BULLETPROOF_ARCHITECTURE_PLAN.md for the migration rules.\n')
  process.exit(1)
}

console.log('Mobile architecture boundary check passed.')
