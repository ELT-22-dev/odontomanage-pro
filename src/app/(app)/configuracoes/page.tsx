'use client'

import { PageHeader } from '@/components/PageHeader'
import { useIsAdmin } from '@/components/SessionProvider'
import { AuditSection } from '@/components/settings/AuditSection'
import { ClinicSection } from '@/components/settings/ClinicSection'
import { DataSection, IntegrationsSection } from '@/components/settings/DataSection'
import { AppearanceSection, ProfileSection } from '@/components/settings/ProfileSection'
import { TeamSection } from '@/components/settings/TeamSection'
import { useSettings } from '@/hooks/queries'

export default function SettingsPage() {
  const isAdmin = useIsAdmin()
  const { data: settings } = useSettings()

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-3xl">
      <title>Configuracoes · OdontoManage Pro</title>
      <PageHeader title="Configuracoes" subtitle={isAdmin ? 'Perfil, clinica, equipe, integracoes e dados' : 'Perfil, aparencia e dados'} />
      <ProfileSection />
      {isAdmin && settings && <ClinicSection key={JSON.stringify(settings)} settings={settings} />}
      {isAdmin && <TeamSection />}
      <AppearanceSection />
      <IntegrationsSection />
      <DataSection />
      {isAdmin && <AuditSection />}
    </div>
  )
}
