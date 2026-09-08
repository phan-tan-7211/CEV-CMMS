import { supabase } from '../../../lib/supabase/client'

async function rpc(name: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || 'Không tải/lưu được dữ liệu danh mục.')
  return data
}

export type LocationInput = {
  locationId?: string
  parentLocationId?: string | null
  name: string
  address?: string
  description?: string
}

export type BusinessPartyInput = {
  partyId?: string
  partyKind: 'VENDOR' | 'CUSTOMER' | 'BOTH'
  companyName: string
  address?: string
  phone?: string
  email?: string
  notes?: string
}

export type LocationPickerItem = {
  id: string
  parentId: string | null
  name: string
  address: string
  childCount: number
}

export type PersonPickerItem = {
  id: string
  name: string
  email: string
  jobTitle: string
  roleCode: string
  teamCount: number
}

export type TeamPickerItem = {
  id: string
  name: string
  description: string
  memberCount: number
  leadCount: number
}

export type PartyPickerItem = {
  id: string
  kind: string
  companyName: string
  address: string
  phone: string
  email: string
}

function rows(data: unknown): Array<Record<string, unknown>> {
  return Array.isArray(data) ? data as Array<Record<string, unknown>> : []
}

export function saveLocation(input: LocationInput) {
  return rpc('rpc_cmms_upsert_location', { p_input: input })
}

export function archiveLocation(locationId: string, archived = true) {
  return rpc('rpc_cmms_archive_location', { p_location_id: locationId, p_archived: archived })
}

export function saveBusinessParty(input: BusinessPartyInput) {
  return rpc('rpc_cmms_upsert_business_party', { p_input: input })
}

export function archiveBusinessParty(partyId: string, archived = true) {
  return rpc('rpc_cmms_archive_business_party', { p_party_id: partyId, p_archived: archived })
}

export async function listLocations(input: { search?: string; parentId?: string | null; sort?: string; limit?: number } = {}): Promise<LocationPickerItem[]> {
  const data = await rpc('rpc_cmms_location_picker', {
    p_search: input.search || null,
    p_parent_location_id: input.parentId || null,
    p_sort: input.sort || 'NAME_ASC',
    p_include_archived: false,
    p_limit: input.limit || 200,
    p_offset: 0,
  })
  return rows(data).map((row) => ({
    id: String(row.location_id || ''),
    parentId: row.parent_location_id ? String(row.parent_location_id) : null,
    name: String(row.name || ''),
    address: String(row.address || ''),
    childCount: Number(row.child_count || 0),
  }))
}

export async function listPeople(input: { search?: string; roleCodes?: string[]; limit?: number } = {}): Promise<PersonPickerItem[]> {
  const data = await rpc('rpc_cmms_people_picker', {
    p_search: input.search || null,
    p_role_codes: input.roleCodes?.length ? input.roleCodes : null,
    p_include_archived: false,
    p_sort: 'NAME_ASC',
    p_limit: input.limit || 200,
    p_offset: 0,
  })
  return rows(data).map((row) => ({
    id: String(row.person_id || ''),
    name: String(row.display_name || ''),
    email: String(row.email || ''),
    jobTitle: String(row.job_title || ''),
    roleCode: String(row.role_code || ''),
    teamCount: Number(row.team_count || 0),
  }))
}

export async function listTeams(input: { search?: string; limit?: number } = {}): Promise<TeamPickerItem[]> {
  const data = await rpc('rpc_cmms_team_picker', {
    p_search: input.search || null,
    p_include_archived: false,
    p_sort: 'NAME_ASC',
    p_limit: input.limit || 200,
    p_offset: 0,
  })
  return rows(data).map((row) => ({
    id: String(row.team_id || ''),
    name: String(row.name || ''),
    description: String(row.description || ''),
    memberCount: Number(row.member_count || 0),
    leadCount: Number(row.lead_count || 0),
  }))
}

export async function listParties(kind: 'VENDOR' | 'CUSTOMER' | 'ALL', input: { search?: string; limit?: number } = {}): Promise<PartyPickerItem[]> {
  const data = await rpc('rpc_cmms_party_picker', {
    p_kind: kind,
    p_search: input.search || null,
    p_include_archived: false,
    p_sort: 'NAME_ASC',
    p_limit: input.limit || 200,
    p_offset: 0,
  })
  return rows(data).map((row) => ({
    id: String(row.party_id || ''),
    kind: String(row.party_kind || ''),
    companyName: String(row.company_name || ''),
    address: String(row.address || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
  }))
}
