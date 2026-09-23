'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { SessionUser } from '@/lib/types'

/**
 * Usuario logado, lido no servidor (src/app/(app)/layout.tsx) e repassado
 * para as telas. Depois de mudar o proprio perfil, chame router.refresh().
 */
const SessionContext = createContext<SessionUser | null>(null)

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext)
  if (!user) throw new Error('useSession fora de <SessionProvider>')
  return user
}

export function useIsAdmin() {
  return useSession().role === 'admin'
}
