import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AppShell } from '@/components/AppShell'
import { SessionProvider } from '@/components/SessionProvider'
import { getSession } from '@/server/auth'

// Toda tela dentro de (app) exige login. A checagem acontece AQUI, no
// servidor, a cada carregamento — e de novo em cada rota da API.
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSession()
  if (!user) redirect('/login')
  return (
    <SessionProvider user={user}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  )
}
