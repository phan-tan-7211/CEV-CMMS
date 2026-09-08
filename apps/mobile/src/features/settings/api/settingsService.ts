import { supabase } from '../../../lib/supabase/client'

export type OrganizationSettings = {
  languageCode: string
  dateFormat: string
  currencyCode: string
  timezoneName: string
  automationEnabled: boolean
  multiSiteEnabled: boolean
}

export type ModuleSettings = {
  assetsEnabled: boolean
  partsInventoryEnabled: boolean
  requestsEnabled: boolean
  workOrdersEnabled: boolean
  purchaseOrdersEnabled: boolean
  metersEnabled: boolean
  tagsEnabled: boolean
}

export type WorkOrderSettings = {
  feedbackEnabled: boolean
  completionNoteRequired: boolean
  numberStartCount: number
  formsEnabled: boolean
  customStatusesEnabled: boolean
  customFieldsEnabled: boolean
  categoriesEnabled: boolean
}

export type DashboardPreference = { visibleCards: string[]; cardOrder: string[] }
export type SettingsBundle = { organization: OrganizationSettings; modules: ModuleSettings; workOrders: WorkOrderSettings; dashboard: DashboardPreference }

function bool(value: unknown, fallback = false) { return typeof value === 'boolean' ? value : fallback }
function str(value: unknown, fallback = '') { return typeof value === 'string' && value ? value : fallback }
function arr(value: unknown, fallback: string[] = []) { return Array.isArray(value) ? value.map(String) : fallback }

export async function loadSettingsBundle(): Promise<SettingsBundle> {
  const { data, error } = await supabase.rpc('rpc_cmms_settings_bundle')
  if (error) throw new Error(error.message || 'Không tải được cài đặt CMMS.')
  const row = (data || {}) as Record<string, any>
  const organization = row.organization || {}
  const modules = row.modules || {}
  const workOrders = row.workOrders || {}
  const dashboard = row.dashboard || {}
  return {
    organization: {
      languageCode: str(organization.language_code, 'vi'),
      dateFormat: str(organization.date_format, 'DD/MM/YYYY'),
      currencyCode: str(organization.currency_code, 'VND'),
      timezoneName: str(organization.timezone_name, 'Asia/Ho_Chi_Minh'),
      automationEnabled: bool(organization.automation_enabled, true),
      multiSiteEnabled: bool(organization.multi_site_enabled, false),
    },
    modules: {
      assetsEnabled: bool(modules.assets_enabled, true),
      partsInventoryEnabled: bool(modules.parts_inventory_enabled, true),
      requestsEnabled: bool(modules.requests_enabled, true),
      workOrdersEnabled: bool(modules.work_orders_enabled, true),
      purchaseOrdersEnabled: bool(modules.purchase_orders_enabled, true),
      metersEnabled: bool(modules.meters_enabled, true),
      tagsEnabled: bool(modules.tags_enabled, true),
    },
    workOrders: {
      feedbackEnabled: bool(workOrders.feedback_enabled, true),
      completionNoteRequired: bool(workOrders.completion_note_required, false),
      numberStartCount: Number(workOrders.number_start_count || 1),
      formsEnabled: bool(workOrders.forms_enabled, true),
      customStatusesEnabled: bool(workOrders.custom_statuses_enabled, true),
      customFieldsEnabled: bool(workOrders.custom_fields_enabled, true),
      categoriesEnabled: bool(workOrders.categories_enabled, true),
    },
    dashboard: {
      visibleCards: arr(dashboard.visible_cards, ['due-today','high-priority','overdue','open','in-progress','pm','completed','all']),
      cardOrder: arr(dashboard.card_order, ['due-today','high-priority','overdue','open','in-progress','pm','completed','all']),
    },
  }
}

async function rpc(name: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || 'Không lưu được cài đặt.')
  return data
}

export function saveOrganizationSettings(input: Partial<OrganizationSettings>) {
  return rpc('rpc_cmms_update_organization_settings', { p_input: input })
}
export function saveModuleSettings(input: Partial<ModuleSettings>) {
  return rpc('rpc_cmms_update_module_settings', { p_input: input })
}
export function saveWorkOrderSettings(input: Partial<WorkOrderSettings>) {
  return rpc('rpc_cmms_update_work_order_settings', { p_input: input })
}
export function saveDashboardPreference(visibleCards: string[], cardOrder?: string[]) {
  return rpc('rpc_cmms_save_dashboard_preference', { p_visible_cards: visibleCards, p_card_order: cardOrder || null, p_extra: {} })
}
