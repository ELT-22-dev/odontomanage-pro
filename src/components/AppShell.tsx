'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { AppSidebar } from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { useClinicName } from '@/hooks/queries'

/** Moldura das telas logadas: menu lateral (desktop) / gaveta (celular). */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const clinicName = useClinicName()

  return (
    <div className="flex h-dvh overflow-hidden print:block print:h-auto print:overflow-visible">
      <aside className="hidden md:block shrink-0 print:hidden">
        <AppSidebar />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex print:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative z-10 h-full">
            <AppSidebar mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex flex-1 min-w-0 flex-col print:block">
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background sticky top-0 z-30 print:hidden">
          <Button variant="ghost" size="icon" className="-ml-2" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold text-sm truncate">{clinicName}</span>
        </div>
        <div className="flex-1 overflow-y-auto print:overflow-visible">{children}</div>
      </main>
    </div>
  )
}
