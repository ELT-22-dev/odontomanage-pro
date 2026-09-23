'use client'

import type { ReactNode } from 'react'
import { useClinicName, useSettings } from '@/hooks/queries'

/** Moldura das telas sem login (entrar / configuracao inicial). */
export function AuthShell({ subtitle, children }: { subtitle?: string; children: ReactNode }) {
  const clinicName = useClinicName()
  const { data } = useSettings()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10 text-center bg-background">
      <div className="space-y-2">
        {data?.logo_data_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo em data URL, vem do banco
          <img src={data.logo_data_url} alt="" className="mx-auto h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-xl bg-primary text-primary-foreground text-2xl font-bold">
            {clinicName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{clinicName}</h1>
        <p className="text-muted-foreground max-w-sm">{subtitle ?? 'Sistema de gestao da clinica odontologica.'}</p>
      </div>
      {children}
    </div>
  )
}
