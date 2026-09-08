import { supabase } from '../../../lib/supabase/client'

async function rpc(name: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message || 'Không lưu được dữ liệu danh mục.')
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
