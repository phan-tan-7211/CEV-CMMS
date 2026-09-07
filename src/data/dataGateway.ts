import { supabase } from './supabaseClient'

export type DataRow = Record<string, unknown>

export type DataGatewayResult<T> = {
  data: T
  error: unknown | null
}

type ValueFilter = {
  column: string
  value: unknown
}

type OrderBy = {
  column: string
  ascending?: boolean
}

export type ReadRowsOptions = {
  columns?: string
  eq?: ValueFilter[]
  ilike?: ValueFilter[]
  lt?: ValueFilter[]
  gte?: ValueFilter[]
  or?: string
  order?: OrderBy
  orders?: OrderBy[]
  limit?: number
}

type ReadOneOptions = ReadRowsOptions & {
  required?: boolean
}

type UploadOptions = {
  upsert?: boolean
  contentType?: string
}

type UpsertOptions = {
  onConflict?: string
}

export type DataGatewayUser = {
  id: string
  email: string
}

export type DataGatewayFile = {
  name: string
}

export interface DataGateway {
  readRows(table: string, options?: ReadRowsOptions): Promise<DataGatewayResult<DataRow[]>>
  readOne(table: string, options?: ReadOneOptions): Promise<DataGatewayResult<DataRow | null>>
  insertRows(table: string, values: DataRow | DataRow[]): Promise<DataGatewayResult<DataRow[]>>
  updateRows(table: string, values: DataRow, eq?: ValueFilter[]): Promise<DataGatewayResult<DataRow[]>>
  upsertRows(table: string, values: DataRow | DataRow[], options?: UpsertOptions): Promise<DataGatewayResult<DataRow[]>>
  deleteRows(table: string, eq?: ValueFilter[]): Promise<DataGatewayResult<DataRow[]>>
  rpc<T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<DataGatewayResult<T | null>>
  getSessionUser(): Promise<DataGatewayResult<DataGatewayUser | null>>
  getCurrentUser(): Promise<DataGatewayResult<DataGatewayUser | null>>
  listFiles(bucket: string, path: string, limit?: number): Promise<DataGatewayResult<DataGatewayFile[]>>
  createSignedUrl(bucket: string, path: string, expiresIn: number): Promise<DataGatewayResult<string>>
  upload(bucket: string, path: string, file: File, options?: UploadOptions): Promise<DataGatewayResult<null>>
  remove(bucket: string, paths: string[]): Promise<DataGatewayResult<null>>
}

function applyReadOptions(query: any, options: ReadRowsOptions) {
  let next = query
  for (const filter of options.eq || []) next = next.eq(filter.column, filter.value)
  for (const filter of options.ilike || []) next = next.ilike(filter.column, filter.value)
  for (const filter of options.lt || []) next = next.lt(filter.column, filter.value)
  for (const filter of options.gte || []) next = next.gte(filter.column, filter.value)
  if (options.or) next = next.or(options.or)
  if (options.order) next = next.order(options.order.column, { ascending: options.order.ascending ?? true })
  for (const order of options.orders || []) next = next.order(order.column, { ascending: order.ascending ?? true })
  if (typeof options.limit === 'number') next = next.limit(options.limit)
  return next
}

function applyEqualityFilters(query: any, filters: ValueFilter[] = []) {
  let next = query
  for (const filter of filters) next = next.eq(filter.column, filter.value)
  return next
}

class SupabaseDataGateway implements DataGateway {
  async readRows(table: string, options: ReadRowsOptions = {}): Promise<DataGatewayResult<DataRow[]>> {
    const query = applyReadOptions(supabase.from(table).select(options.columns || '*'), options)
    const { data, error } = await query
    return { data: ((data || []) as unknown) as DataRow[], error }
  }

  async readOne(table: string, options: ReadOneOptions = {}): Promise<DataGatewayResult<DataRow | null>> {
    const query = applyReadOptions(supabase.from(table).select(options.columns || '*'), options)
    const { data, error } = options.required ? await query.single() : await query.maybeSingle()
    return { data: (data ?? null) as DataRow | null, error }
  }

  async insertRows(table: string, values: DataRow | DataRow[]): Promise<DataGatewayResult<DataRow[]>> {
    const { data, error } = await supabase.from(table).insert(values).select()
    return { data: ((data || []) as unknown) as DataRow[], error }
  }

  async updateRows(table: string, values: DataRow, eq: ValueFilter[] = []): Promise<DataGatewayResult<DataRow[]>> {
    const query = applyEqualityFilters(supabase.from(table).update(values), eq)
    const { data, error } = await query.select()
    return { data: ((data || []) as unknown) as DataRow[], error }
  }

  async upsertRows(table: string, values: DataRow | DataRow[], options: UpsertOptions = {}): Promise<DataGatewayResult<DataRow[]>> {
    const { data, error } = await supabase.from(table).upsert(values, { onConflict: options.onConflict }).select()
    return { data: ((data || []) as unknown) as DataRow[], error }
  }

  async deleteRows(table: string, eq: ValueFilter[] = []): Promise<DataGatewayResult<DataRow[]>> {
    const query = applyEqualityFilters(supabase.from(table).delete(), eq)
    const { data, error } = await query.select()
    return { data: ((data || []) as unknown) as DataRow[], error }
  }

  async rpc<T = unknown>(functionName: string, params: Record<string, unknown> = {}): Promise<DataGatewayResult<T | null>> {
    const { data, error } = await supabase.rpc(functionName, params)
    return { data: (data ?? null) as T | null, error }
  }

  async getSessionUser(): Promise<DataGatewayResult<DataGatewayUser | null>> {
    const { data, error } = await supabase.auth.getSession()
    const user = data.session?.user
    return { data: user ? { id: user.id, email: user.email || '' } : null, error }
  }

  async getCurrentUser(): Promise<DataGatewayResult<DataGatewayUser | null>> {
    const { data, error } = await supabase.auth.getUser()
    const user = data.user
    return { data: user ? { id: user.id, email: user.email || '' } : null, error }
  }

  async listFiles(bucket: string, path: string, limit = 100): Promise<DataGatewayResult<DataGatewayFile[]>> {
    const { data, error } = await supabase.storage.from(bucket).list(path, { limit })
    return { data: (data || []).map((file) => ({ name: file.name })), error }
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
