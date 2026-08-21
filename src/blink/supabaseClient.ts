/**
 * Data + auth layer backed by Supabase (Postgres + Auth). Keeps the same call
 * surface the routes already use (`blink.auth.*`, `blink.db.table(name).list/
 * get/create/update/delete`) so page code doesn't need to change when the
 * storage backend changes.
 */
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { sanitize } from './sanitize'

export interface LocalUser {
  id: string
  email: string
  displayName: string
}

interface AuthState {
  user: LocalUser | null
  isLoading: boolean
  isPasswordRecovery: boolean
}

type AuthListener = (state: AuthState) => void

function toLocalUser(user: User | null): LocalUser | null {
  if (!user) return null
  return {
    id: user.id,
    email: user.email || '',
    displayName: (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'Usuario',
  }
}

class SupabaseAuth {
  private listeners = new Set<AuthListener>()
  private state: AuthState = { user: null, isLoading: true, isPasswordRecovery: false }

  constructor() {
    supabase.auth.getSession().then(({ data }) => {
      this.state = { ...this.state, user: toLocalUser(data.session?.user ?? null), isLoading: false }
      this.emit()
    })
    supabase.auth.onAuthStateChange((event, session) => {
      this.state = {
        user: toLocalUser(session?.user ?? null),
        isLoading: false,
        isPasswordRecovery: event === 'PASSWORD_RECOVERY' ? true : this.state.isPasswordRecovery,
      }
      this.emit()
    })
  }

  onAuthStateChanged(callback: AuthListener) {
    this.listeners.add(callback)
    queueMicrotask(() => callback(this.state))
    return () => {
      this.listeners.delete(callback)
    }
  }

  private emit() {
    this.listeners.forEach((callback) => callback(this.state))
  }

  currentUserId(): string | null {
    return this.state.user?.id ?? null
  }

  async signUp(email: string, password: string, name: string): Promise<{ needsEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
    if (error) throw error
    return { needsEmailConfirmation: !data.session }
  }

  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async requestPasswordReset(email: string) {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  async setNewPassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    this.state = { ...this.state, isPasswordRecovery: false }
    this.emit()
  }

  async logout() {
    await supabase.auth.signOut()
  }

  async updateProfile(profile: { name: string; email: string }) {
    const { error } = await supabase.auth.updateUser({
      email: profile.email || undefined,
      data: { display_name: profile.name },
    })
    if (error) throw error
  }
}

const auth = new SupabaseAuth()

type OrderBy = Record<string, 'asc' | 'desc'>

interface ListOptions {
  orderBy?: OrderBy
}

function table<T extends { id?: string }>(name: string) {
  return {
    async list(options?: ListOptions): Promise<T[]> {
      let query = supabase.from(name).select('*')
      if (options?.orderBy) {
        for (const [field, direction] of Object.entries(options.orderBy)) {
          query = query.order(field, { ascending: direction !== 'desc' })
        }
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as T[]
    },
    async get(id: string): Promise<T | null> {
      const { data, error } = await supabase.from(name).select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data as T | null
    },
    async create(data: Partial<T>): Promise<T> {
      const payload = sanitize({ ...data, user_id: auth.currentUserId() })
      const { data: row, error } = await supabase.from(name).insert(payload).select().single()
      if (error) throw error
      return row as T
    },
    /** Bulk insert — one round trip instead of one request per row. */
    async createMany(rows: Partial<T>[]): Promise<T[]> {
      const userId = auth.currentUserId()
      const payload = rows.map((row) => sanitize({ ...row, user_id: userId }))
      const { data, error } = await supabase.from(name).insert(payload as never).select()
      if (error) throw error
      return (data ?? []) as T[]
    },
    async update(id: string, data: Partial<T>): Promise<T> {
      const payload = sanitize(data)
      const { data: row, error } = await supabase.from(name).update(payload as never).eq('id', id).select().single()
      if (error) throw error
      return row as T
    },
    async delete(id: string): Promise<void> {
      const { error } = await supabase.from(name).delete().eq('id', id)
      if (error) throw error
    },
  }
}

const BACKUP_TABLES = ['patients', 'appointments', 'transactions', 'medical_records']

export async function exportAllData(): Promise<string> {
  const dump: Record<string, unknown[]> = {}
  for (const name of BACKUP_TABLES) {
    const { data, error } = await supabase.from(name).select('*')
    if (error) throw error
    dump[name] = data ?? []
  }
  return JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2)
}

export async function importAllData(json: string) {
  const parsed = JSON.parse(json) as { tables?: Record<string, Record<string, unknown>[]> }
  if (!parsed.tables) throw new Error('Arquivo invalido: nenhuma tabela encontrada')
  const userId = auth.currentUserId()
  for (const [name, rows] of Object.entries(parsed.tables)) {
    if (!rows.length) continue
    const payload = rows.map((row) => ({ ...row, user_id: userId }))
    const { error } = await supabase.from(name).upsert(payload)
    if (error) throw error
  }
}

export async function clearAllData() {
  for (const name of BACKUP_TABLES) {
    const { error } = await supabase.from(name).delete().not('id', 'is', null)
    if (error) throw error
  }
}

export const blink = {
  auth,
  db: { table },
}
