import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSession } from '@/server/auth'
import { countUsers } from '@/server/repos/users'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Entrar' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await getSession()) redirect('/')
  // Instalacao nova (nenhum usuario ainda): vai para a configuracao inicial.
  if ((await countUsers()) === 0) redirect('/setup')
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
