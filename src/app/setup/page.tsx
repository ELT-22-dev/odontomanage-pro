import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { countUsers } from '@/server/repos/users'
import { SetupForm } from './SetupForm'

export const metadata: Metadata = { title: 'Configuracao inicial' }
export const dynamic = 'force-dynamic'

/** So existe enquanto nao ha nenhum usuario. Depois disso, sempre vai para o login. */
export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect('/login')
  return <SetupForm />
}
