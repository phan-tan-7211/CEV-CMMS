import { supabase } from './supabaseClient'

export type DataRow = Record<string, unknown>

export type DataGatewayResult<T> = {
  data: T
  error: unknown | null
}

type EqualityFilter = {
  column: string
  value: unknown
}

type OrderBy = {
  column: string
  ascending?: boolean
}

export type ReadRowsOptions = {
  columns?: string
  eq?: EqualityFilter[]
  order?: OrderBy
  limit?: number
}

type UploadOptions = {
  upsert?: boolean
  contentType?: string
}

export interface DataGateway {
  readRows(table: string, options?: ReadRowsOptions): Promise<DataGatewayResult<DataRow[]>>
  rpc<T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<DataGatewayResult<T | null>>
  createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<DataGatewayResult<string>>
  upload(bucket: string, path: string, file: File, options?: UploadOptions): Promise<DataGatewayResult<null>>
  remove(bucket: string, paths: string[]): Promise<DataGatewayResult<null>>
}

class SupabaseDataGateway implements DataGateway {
  async readRows(table: string, options: ReadRowsOptions = {}): Promise<DataGatewayResult<DataRow[]>> {
    let query = supabase.from(table).select(options.columns || '*')
    for (const filter of options.eq || []) query = query.eq(filter.column, filter.value)
    if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending ?? true })
    if (typeof options.limit === 'number') query = query.limit(options.limit)

    const { data, error } = await query
    return { data: ((data || []) as unknown) as DataRow[], error }
  }

  async rpc<T = unknown>(functionName: string, params: Record<string, unknown> = {}): Promise<DataGatewayResult<T | null>> {
    const { data, error } = await supabase.rpc(functionName, params)
    return { data: (data ?? null) as T | null, error }
  }

  async createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<DataGatewayResult<string>> {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
    return { data: data?.signedUrl || '', error }
  }

  async upload(bucket: string, path: string, file: File, options: UploadOptions = {}): Promise<DataGatewayResult<null>> {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: options.upsert ?? false,
      contentType: options.contentType,
    })
    return { data: null, error }
  }

  async remove(bucket: string, paths: string[]): Promise<DataGatewayResult<null>> {
    const { error } = await supabase.storage.from(bucket).remove(paths)
    return { data: null, error }
  }
}

// Repositories depend on this gateway rather than Supabase query builders directly.
// Replacing Supabase with a REST adapter later only requires changing this composition root.
export const dataGateway: DataGateway = new SupabaseDataGateway()
