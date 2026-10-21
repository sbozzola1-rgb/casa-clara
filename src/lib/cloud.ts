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
  if (!data || typeof data !== 'object') return undefined
  const source = data as { routine?: unknown; __routine?: unknown }
  return source.routine ?? source.__routine
}

function readRoutineBlob(payload: unknown): RoutineCloud | null {
  if (!payload || typeof payload !== 'object') return null
  const blob = payload as { revision?: unknown; state?: unknown }
  if (!blob.state || typeof blob.state !== 'object') return null
  const state = blob.state as { profile?: { name?: unknown } }
  if (typeof state.profile?.name !== 'string' || state.profile.name.trim().length === 0) return null
  return { revision: Number(blob.revision) || 0, state: blob.state }
}

export async function pushHousehold(state: AppState, revision: number) {
  if (!supabase) return
  const current = await pullHousehold()
  const routine = routinePayload(current?.data)
  const data = routine ? { ...state, routine } : state
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
  if (!supabase) return null
  const extra = await supabase.from('household').select('data').eq('id', 'rotina').maybeSingle()
  if (!extra.error) {
    const saved = readRoutineBlob(routinePayload(extra.data?.data))
    if (saved) return saved
  }
  const row = await pullHousehold()
  return readRoutineBlob(routinePayload(row?.data))
}

export async function pushRoutine(state: unknown, revision: number) {
  if (!supabase) throw new Error('A casa ainda não está ligada.')
  const blob = { revision, state }
  const stamp = new Date().toISOString()
  const extra = await supabase.from('household').upsert({
    id: 'rotina',
    data: { routine: blob },
    revision,
    updated_at: stamp,
  })
  const row = await pullHousehold()
  if (row?.data && typeof row.data === 'object') {
    const saved = await supabase.from('household').upsert({
      id: 'casa',
      data: { ...(row.data as Record<string, unknown>), routine: blob },
      revision: row.revision,
      updated_at: stamp,
    })
    if (saved.error && extra.error) throw new Error(saved.error.message)
  } else if (extra.error) {
    throw new Error(extra.error.message)
  }
  const check = await pullRoutine()
  if (!check) throw new Error('A casa não guardou a rotina. Tenta de novo.')
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
