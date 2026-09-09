import { supabase } from '../../../lib/supabase/client'

async function rpc<T>(name:string,params:Record<string,unknown>={}){const {data,error}=await supabase.rpc(name,params);if(error)throw new Error(error.message||`Không thực hiện được ${name}.`);return data as T}

export type WorkOrderTemplate={templateId:string;name:string;description:string;reason:string;priority:string;checklistTemplateId?:string;categoryCode?:string}
export type WorkOrderCategory={categoryId:string;code:string;name:string;description:string}
export type CustodyEvent={custodyEventId:string;equipmentId:string;action:'CHECK_OUT'|'CHECK_IN';holderName?:string;holderUserId?:string;note:string;eventAt:string}
export type PortalSettings={settings_id?:string;settingsId?:string;enabled?:boolean;can_create_work_order?:boolean;canCreateWorkOrder?:boolean;can_create_request?:boolean;canCreateRequest?:boolean;portal_name?:string;portalName?:string;instructions?:string;allow_attachments?:boolean;allowAttachments?:boolean;require_contact?:boolean;requireContact?:boolean;updated_at?:string}
export type OperationsSnapshot={portal:PortalSettings;templates:WorkOrderTemplate[];categories:WorkOrderCategory[];custody:CustodyEvent[]}

export function loadOperationsParity(equipmentId?:string){return rpc<OperationsSnapshot>('rpc_cmms_operations_parity_snapshot',{p_equipment_id:equipmentId||null})}
export function saveWorkOrderTemplate(input:{templateId?:string;name:string;description?:string;reason?:string;priority?:string;checklistTemplateId?:string;categoryCode?:string}){return rpc<{templateId:string;name:string}>('rpc_cmms_save_work_order_template',{p_input:input})}
export function createWorkOrderFromTemplate(templateId:string,equipmentId:string,overrides:Record<string,unknown>={}){return rpc<Record<string,unknown>>('rpc_cmms_create_work_order_from_template',{p_template_id:templateId,p_equipment_id:equipmentId,p_overrides:overrides})}
export function saveWorkOrderCategory(input:{categoryId?:string;code:string;name:string;description?:string}){return rpc<{categoryId:string;code:string;name:string}>('rpc_cmms_save_work_order_category',{p_input:input})}
export function setAssetCustody(input:{equipmentId:string;action:'CHECK_OUT'|'CHECK_IN';holderName?:string;holderUserId?:string;note?:string}){return rpc<{custodyEventId:string;equipmentId:string;action:string;eventAt:string}>('rpc_cmms_set_asset_custody',{p_input:input})}
export function saveRequestPortalSettings(input:{settingsId?:string;enabled:boolean;canCreateWorkOrder:boolean;canCreateRequest:boolean;portalName:string;instructions?:string;allowAttachments:boolean;requireContact:boolean}){return rpc<PortalSettings>('rpc_cmms_save_request_portal_settings',{p_input:input})}
