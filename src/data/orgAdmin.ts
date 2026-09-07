import { dataGateway } from './dataGateway'

export type OrgUnit = { unit_code:string; unit_name:string; unit_type:string; parent_unit_code:string|null; active:boolean; sort_order:number }
export type OrgPerson = { person_code:string; display_name:string; unit_code:string|null; job_title:string|null; auth_email:string|null; active:boolean }
export type OrgRole = { role_code:string; role_name:string; unit_code:string|null; active:boolean }
export type OrgRoleAssignment = { assignment_id:number; role_code:string; person_code:string; valid_from:string; valid_to:string|null; active:boolean }

export async function loadOrgAdminData(){
  const [units,people,roles,assignments]=await Promise.all([
    dataGateway.readRows('org_units',{columns:'unit_code,unit_name,unit_type,parent_unit_code,active,sort_order',orders:[{column:'sort_order'},{column:'unit_name'}]}),
    dataGateway.readRows('org_people',{columns:'person_code,display_name,unit_code,job_title,auth_email,active',order:{column:'display_name'}}),
    dataGateway.readRows('org_roles',{columns:'role_code,role_name,unit_code,active',order:{column:'role_name'}}),
    dataGateway.readRows('org_role_assignments',{columns:'assignment_id,role_code,person_code,valid_from,valid_to,active',order:{column:'assignment_id'}}),
  ])
  const error=units.error||people.error||roles.error||assignments.error
  if(error) throw error
  return {units:units.data as unknown as OrgUnit[],people:people.data as unknown as OrgPerson[],roles:roles.data as unknown as OrgRole[],assignments:assignments.data as unknown as OrgRoleAssignment[]}
}

export async function saveOrgPerson(person:OrgPerson){
  const authEmail=person.auth_email?.trim().toLowerCase()||null
  const {error}=await dataGateway.upsertRows('org_people',{...person,auth_email:authEmail,updated_at:new Date().toISOString()},{onConflict:'person_code'})
  if(error) throw error
}

export async function setPersonActive(personCode:string,active:boolean){
  const {error}=await dataGateway.updateRows('org_people',{active,updated_at:new Date().toISOString()},[{column:'person_code',value:personCode}])
  if(error) throw error
}

export async function saveOrgUnit(unit:OrgUnit){
  const {error}=await dataGateway.upsertRows('org_units',{...unit,updated_at:new Date().toISOString()},{onConflict:'unit_code'})
  if(error) throw error
}

export async function saveOrgRole(role:OrgRole){
  const {error}=await dataGateway.upsertRows('org_roles',{...role,updated_at:new Date().toISOString()},{onConflict:'role_code'})
  if(error) throw error
}

export async function appointRole(roleCode:string,personCode:string,validFrom:string){
  const today=validFrom||new Date().toISOString().slice(0,10)
  const {error:closeError}=await dataGateway.updateRows('org_role_assignments',{active:false,valid_to:today},[{column:'role_code',value:roleCode},{column:'active',value:true}])
  if(closeError) throw closeError
  const {error}=await dataGateway.insertRows('org_role_assignments',{role_code:roleCode,person_code:personCode,valid_from:today,valid_to:null,active:true})
  if(error) throw error
}
