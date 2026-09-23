'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { connect, disconnect, isConnected, subscribe, GOOGLE_CALENDAR_CONFIGURED } from '@/lib/googleCalendar'

/** Estado da conexao com o Google Calendar (por navegador/usuario). */
export function useGoogleCalendar() {
  const connected = useSyncExternalStore(subscribe, isConnected, () => false)
  const doConnect = useCallback(() => connect(), [])
  const doDisconnect = useCallback(() => disconnect(), [])
  return { configured: GOOGLE_CALENDAR_CONFIGURED, connected, connect: doConnect, disconnect: doDisconnect }
}
