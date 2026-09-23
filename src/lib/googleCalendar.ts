/**
 * Sincronizacao com Google Calendar via Google Identity Services (GIS), feita
 * no navegador de quem conecta. O token do Google dura ~1h e nao ha refresh
 * token neste fluxo, entao a conexao precisa ser renovada periodicamente
 * (Configuracoes → Integracoes). Cada usuario conecta a propria agenda.
 * Falha aqui NUNCA impede salvar a consulta no sistema.
 */
import { CLINIC_TIMEZONE, addDays } from './dates'

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
export const GOOGLE_CALENDAR_CONFIGURED = !!CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN_STORAGE_KEY = 'odonto_google_calendar_token'

// Notifica componentes (useGoogleCalendar) quando conecta/desconecta.
const listeners = new Set<() => void>()
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const notify = () => listeners.forEach((l) => l())

interface StoredToken {
  accessToken: string
  expiresAt: number
}

interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface GisTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: GisTokenResponse) => void
          }) => GisTokenClient
        }
      }
    }
  }
}

let gisLoadPromise: Promise<void> | null = null

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Calendar so funciona no navegador'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoadPromise) return gisLoadPromise
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar o script do Google'))
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

function getStoredToken(): StoredToken | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return null
    const token = JSON.parse(raw) as StoredToken
    if (token.expiresAt <= Date.now()) return null
    return token
  } catch {
    return null
  }
}

function saveToken(accessToken: string, expiresInSeconds: number) {
  const token: StoredToken = { accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 - 30_000 }
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token))
  notify()
}

export function isConnected(): boolean {
  return getStoredToken() !== null
}

export function disconnect() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  notify()
}

export async function connect(): Promise<void> {
  if (!CLIENT_ID) throw new Error('Integracao com Google Calendar nao configurada (NEXT_PUBLIC_GOOGLE_CLIENT_ID)')
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || 'Nao foi possivel conectar ao Google'))
          return
        }
        saveToken(response.access_token, response.expires_in ?? 3600)
        resolve()
      },
    })
    client.requestAccessToken()
  })
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken()
  if (!token) throw new Error('Google Calendar nao conectado')
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Erro do Google Calendar (${res.status}): ${body.slice(0, 200)}`)
  }
  return res
}

export interface CalendarAppointmentInput {
  patientName: string
  type: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  dentistName?: string | null
  room?: string | null
  notes?: string | null
  durationMinutes?: number
}

function endOf(date: string, time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const day = addDays(date, Math.floor(total / 1440))
  const mins = total % 1440
  return `${day}T${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00`
}

function toEventBody(input: CalendarAppointmentInput) {
  const descriptionParts = [
    input.dentistName ? `Dentista: ${input.dentistName}` : null,
    input.room ? `Sala: ${input.room}` : null,
    input.notes || null,
  ].filter(Boolean)
  return {
    summary: `${input.type} - ${input.patientName}`,
    description: descriptionParts.join('\n') || undefined,
    // Horario "de parede" + fuso da clinica: o Google converte certo mesmo se
    // quem conectou estiver com o computador em outro fuso.
    start: { dateTime: `${input.date}T${input.time}:00`, timeZone: CLINIC_TIMEZONE },
    end: { dateTime: endOf(input.date, input.time, input.durationMinutes ?? 30), timeZone: CLINIC_TIMEZONE },
  }
}

export async function createEvent(input: CalendarAppointmentInput): Promise<string> {
  const res = await apiFetch('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(toEventBody(input)),
  })
  const data = await res.json()
  return data.id as string
}

export async function updateEvent(eventId: string, input: CalendarAppointmentInput): Promise<void> {
  await apiFetch(`/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toEventBody(input)),
  })
}

export async function deleteEvent(eventId: string): Promise<void> {
  try {
    await apiFetch(`/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' })
  } catch {
    // O evento pode ja ter sido apagado direto no Google — nao e erro.
  }
}
