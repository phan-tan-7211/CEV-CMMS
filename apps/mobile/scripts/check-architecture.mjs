import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const screensRoot = path.join(root, 'src', 'screens')

// Existing debt is explicitly baselined so the guard prevents new violations
// without breaking CI before the planned migration phases are completed.
const legacyDirectEquipmentImports = new Set([
  path.normalize('src/screens/EquipmentListScreen.tsx'),
  path.normalize('src/screens/EquipmentDetailScreen.tsx'),
])

const legacyDirectSupabaseImports = new Set([
  path.normalize('src/screens/settings/ProfileSettingsScreen.tsx'),
  path.normalize('src/screens/settings/SecuritySettingsScreen.tsx'),
])

const violations = []

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

for (const file of walk(screensRoot).filter((value) => /\.(ts|tsx)$/.test(value))) {
  const relative = path.normalize(path.relative(root, file))
  const source = fs.readFileSync(file, 'utf8')

  const directSupabase = /from\s+['"][^'"]*supabase['"]/.test(source)
  if (directSupabase && !legacyDirectSupabaseImports.has(relative)) {
    violations.push(`${relative}: route screens must not import Supabase directly`)
  }

  const directEquipmentService = /from\s+['"][^'"]*services\/equipment(?:Service|ImageService|StatusService)['"]/.test(source)
  if (directEquipmentService && !legacyDirectEquipmentImports.has(relative)) {
    violations.push(`${relative}: import Equipment capabilities from features/equipment public API`)
  }
}

if (violations.length) {
  console.error('\nMobile architecture boundary violations:\n')
  for (const violation of violations) console.error(`- ${violation}`)
  console.error('\nSee BULLETPROOF_ARCHITECTURE_PLAN.md for the migration rules.\n')
  process.exit(1)
}

console.log('Mobile architecture boundary check passed.')
