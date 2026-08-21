/**
 * Data + auth layer for this portfolio build — no backend, everything lives in
 * the browser's localStorage. `blink.auth.*` / `blink.db.table(name).list/get/
 * create/update/delete` is a compatibility shim shape kept from an earlier
 * Supabase-backed version of this project (see CLAUDE.md "History").
 */
import { sanitize } from './sanitize'
import { buildDemoSeed, DEMO_USER_ID } from './demoData'

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

const SESSION_KEY = 'odonto_demo_session_v1'
const DB_KEY = 'odonto_demo_db_v1'

function loadSession(): LocalUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as LocalUser) : null
  } catch {
    return null
  }
}

function saveSession(user: LocalUser | null) {
  if (typeof window === 'undefined') return
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user))
  else localStorage.removeItem(SESSION_KEY)
}

class DemoAuth {
  private listeners = new Set<AuthListener>()
  private state: AuthState = { user: null, isLoading: true, isPasswordRecovery: false }

  constructor() {
    queueMicrotask(() => {
      // No login screen in demo mode — auto-create/restore a session so a
      // portfolio visitor lands straight on the dashboard.
      const user = loadSession() ?? { id: DEMO_USER_ID, email: 'demo@odontomanage.pro', displayName: 'Equipe Demo' }
      saveSession(user)
      this.state = { user, isLoading: false, isPasswordRecovery: false }
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

  private setUser(user: LocalUser | null) {
    this.state = { ...this.state, user }
    saveSession(user)
    this.emit()
  }

  currentUserId(): string | null {
    return this.state.user ? DEMO_USER_ID : null
  }

  async signUp(email: string, _password: string, name: string): Promise<{ needsEmailConfirmation: boolean }> {
    this.setUser({ id: DEMO_USER_ID, email, displayName: name || email.split('@')[0] })
    return { needsEmailConfirmation: false }
  }

  async signIn(email: string, _password: string) {
    const existing = loadSession()
    this.setUser({
      id: DEMO_USER_ID,
      email,
      displayName: existing?.email === email ? existing.displayName : email.split('@')[0],
    })
  }

  async requestPasswordReset(_email: string) {
    // No real email in demo mode — the UI already shows a generic success message.
  }

  async setNewPassword(_newPassword: string) {
    this.state = { ...this.state, isPasswordRecovery: false }
    this.emit()
  }

  async logout() {
    this.setUser(null)
  }

  async updateProfile(profile: { name: string; email: string }) {
    if (!this.state.user) return
    this.setUser({ ...this.state.user, email: profile.email || this.state.user.email, displayName: profile.name })
  }
}

const auth = new DemoAuth()

type OrderBy = Record<string, 'asc' | 'desc'>

interface ListOptions {
  orderBy?: OrderBy
}

type Row = Record<string, unknown> & { id?: string }
type Store = Record<string, Row[]>

let cache: Store | null = null

function loadStore(): Store {
  if (cache) return cache
  if (typeof window === 'undefined') {
    cache = { patients: [], appointments: [], transactions: [], medical_records: [], clinic_settings: [] }
    return cache
  }
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      cache = JSON.parse(raw) as Store
      return cache
    }
  } catch {
    // fall through to reseed
  }
  cache = buildDemoSeed() as unknown as Store
  localStorage.setItem(DB_KEY, JSON.stringify(cache))
  return cache
}

function saveStore(store: Store) {
  cache = store
  if (typeof window === 'undefined') return
  localStorage.setItem(DB_KEY, JSON.stringify(store))
}

function compareRows(a: Row, b: Row, orderBy: OrderBy): number {
  for (const [field, direction] of Object.entries(orderBy)) {
    const va = a[field]
    const vb = b[field]
    let cmp: number
    if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
    else cmp = String(va ?? '').localeCompare(String(vb ?? ''))
    if (cmp !== 0) return direction === 'desc' ? -cmp : cmp
  }
  return 0
}

function table<T extends { id?: string }>(name: string) {
  return {
    async list(options?: ListOptions): Promise<T[]> {
      const rows = [...(loadStore()[name] ?? [])]
      if (options?.orderBy) rows.sort((a, b) => compareRows(a, b, options.orderBy!))
      return rows as T[]
    },
    async get(id: string): Promise<T | null> {
      const rows = loadStore()[name] ?? []
      return (rows.find((r) => r.id === id) as T | undefined) ?? null
    },
    async create(data: Partial<T>): Promise<T> {
      const store = loadStore()
      const row = sanitize({ ...data, id: crypto.randomUUID(), user_id: auth.currentUserId(), created_at: new Date().toISOString() }) as Row
      store[name] = [...(store[name] ?? []), row]
      saveStore(store)
      return row as T
    },
    /** Bulk insert — mirrors the Supabase client's createMany signature. */
    async createMany(rows: Partial<T>[]): Promise<T[]> {
      const store = loadStore()
      const userId = auth.currentUserId()
      const created = rows.map(
        (row) => sanitize({ ...row, id: crypto.randomUUID(), user_id: userId, created_at: new Date().toISOString() }) as Row
      )
      store[name] = [...(store[name] ?? []), ...created]
      saveStore(store)
      return created as T[]
    },
    async update(id: string, data: Partial<T>): Promise<T> {
      const store = loadStore()
      const rows = store[name] ?? []
      const idx = rows.findIndex((r) => r.id === id)
      if (idx === -1) throw new Error('Registro nao encontrado')
      const updated = { ...rows[idx], ...sanitize(data) }
      rows[idx] = updated
      store[name] = rows
      saveStore(store)
      return updated as T
    },
    async delete(id: string): Promise<void> {
      const store = loadStore()
      store[name] = (store[name] ?? []).filter((r) => r.id !== id)
      saveStore(store)
    },
  }
}

const BACKUP_TABLES = ['patients', 'appointments', 'transactions', 'medical_records']

export async function exportAllData(): Promise<string> {
  const store = loadStore()
  const dump: Record<string, unknown[]> = {}
  for (const name of BACKUP_TABLES) dump[name] = store[name] ?? []
  return JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2)
}

export async function importAllData(json: string) {
  const parsed = JSON.parse(json) as { tables?: Record<string, Record<string, unknown>[]> }
  if (!parsed.tables) throw new Error('Arquivo invalido: nenhuma tabela encontrada')
  const store = loadStore()
  const userId = auth.currentUserId()
  for (const [name, rows] of Object.entries(parsed.tables)) {
    if (!rows.length) continue
    store[name] = rows.map((row) => ({ ...row, id: (row.id as string) || crypto.randomUUID(), user_id: userId }))
  }
  saveStore(store)
}

export async function clearAllData() {
  const store = loadStore()
  for (const name of BACKUP_TABLES) store[name] = []
  saveStore(store)
}

export const blink = {
  auth,
  db: { table },
}
