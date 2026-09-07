import { supabase } from './supabaseClient'

export type OrgUnit = { unit_code:string; unit_name:string; unit_type:string; parent_unit_code:string|null; active:boolean; sort_order:number }
export type OrgPerson = { person_code:string; display_name:string; unit_code:string|null; job_title:string|null; auth_email:string|null; active:boolean }
export type OrgRole = { role_code:string; role_name:string; unit_code:string|null; active:boolean }
export type OrgRoleAssignment = { assignment_id:number; role_code:string; person_code:string; valid_from:string; valid_to:string|null; active:boolean }

export async function loadOrgAdminData(){
  const [units,people,roles,assignments]=await Promise.all([
    supabase.from('org_units').select('unit_code,unit_name,unit_type,parent_unit_code,active,sort_order').order('sort_order').order('unit_name'),
    supabase.from('org_people').select('person_code,display_name,unit_code,job_title,auth_email,active').order('display_name'),
    supabase.from('org_roles').select('role_code,role_name,unit_code,active').order('role_name'),
    supabase.from('org_role_assignments').select('assignment_id,role_code,person_code,valid_from,valid_to,active').order('assignment_id'),
  ])
  const error=units.error||people.error||roles.error||assignments.error
  if(error) throw error
  return {units:(units.data||[]) as OrgUnit[],people:(people.data||[]) as OrgPerson[],roles:(roles.data||[]) as OrgRole[],assignments:(assignments.data||[]) as OrgRoleAssignment[]}
}

export async function saveOrgPerson(person:OrgPerson){
  const authEmail=person.auth_email?.trim().toLowerCase()||null
  const {error}=await supabase.from('org_people').upsert({...person,auth_email:authEmail,updated_at:new Date().toISOString()},{onConflict:'person_code'})
  if(error) throw error
}

export async function setPersonActive(personCode:string,active:boolean){
  const {error}=await supabase.from('org_people').update({active,updated_at:new Date().toISOString()}).eq('person_code',personCode)
  if(error) throw error
}

export async function saveOrgUnit(unit:OrgUnit){
  const {error}=await supabase.from('org_units').upsert({...unit,updated_at:new Date().toISOString()},{onConflict:'unit_code'})
  if(error) throw error
}

export async function saveOrgRole(role:OrgRole){
  const {error}=await supabase.from('org_roles').upsert({...role,updated_at:new Date().toISOString()},{onConflict:'role_code'})
  if(error) throw error
}

export async function appointRole(roleCode:string,personCode:string,validFrom:string){
  const today=validFrom||new Date().toISOString().slice(0,10)
  const {error:closeError}=await supabase.from('org_role_assignments').update({active:false,valid_to:today}).eq('role_code',roleCode).eq('active',true)
  if(closeError) throw closeError
  const {error}=await supabase.from('org_role_assignments').insert({role_code:roleCode,person_code:personCode,valid_from:today,valid_to:null,active:true})
  if(error) throw error
}
