import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppState } from './types.ts'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudReady = Boolean(url && anonKey)

export const HOUSE_EMAIL = 'sbozzola1@gmail.com'

export const supabase: SupabaseClient | null = cloudReady ? createClient(url, anonKey) : null

export async function signIn(password: string) {
  if (!supabase) throw new Error('A casa ainda não está ligada.')
  const { error } = await supabase.auth.signInWithPassword({ email: HOUSE_EMAIL, password })
  if (error) throw error
}

export const FINANCE_OK = 'casa-clara.finance-ok'

export async function signOut() {
  try {
    sessionStorage.removeItem(FINANCE_OK)
  } catch {
    // a guia privada pode bloquear o armazenamento
  }
  if (!supabase) return
  await supabase.auth.signOut()
}

export interface HouseholdRow {
  data: unknown
  revision: number
}

export async function pullHousehold(): Promise<HouseholdRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('household').select('data, revision').eq('id', 'casa').maybeSingle()
  if (error) throw error
  if (!data) return null
  return { data: data.data, revision: Number(data.revision) || 0 }
}

function routinePayload(data: unknown) {
  if (!data || typeof data !== 'object' || !('__routine' in data)) return undefined
  return (data as { __routine?: unknown }).__routine
}

export async function pushHousehold(state: AppState, revision: number) {
  if (!supabase) return
  const current = await pullHousehold()
  const routine = routinePayload(current?.data)
  const data = routine ? { ...state, __routine: routine } : state
  const { error } = await supabase.from('household').upsert({
    id: 'casa',
    data,
    revision,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export interface RoutineCloud {
  revision: number
  state: unknown
}

export async function pullRoutine(): Promise<RoutineCloud | null> {
  const row = await pullHousehold()
  const payload = routinePayload(row?.data)
  if (!payload || typeof payload !== 'object') return null
  const blob = payload as { revision?: unknown; state?: unknown }
  if (!blob.state || typeof blob.state !== 'object') return null
  return { revision: Number(blob.revision) || 0, state: blob.state }
}

export async function pushRoutine(state: unknown, revision: number) {
  if (!supabase) return
  const row = await pullHousehold()
  if (!row || !row.data || typeof row.data !== 'object') throw new Error('casa')
  const { error } = await supabase.from('household').upsert({
    id: 'casa',
    data: { ...(row.data as Record<string, unknown>), __routine: { revision, state } },
    revision: row.revision,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function subscribeHousehold(onChange: (row: HouseholdRow) => void) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('household-casa')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household', filter: 'id=eq.casa' }, (payload) => {
      const row = payload.new as { data?: unknown; revision?: number }
      if (!row || row.revision == null) return
      onChange({ data: row.data, revision: Number(row.revision) || 0 })
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
