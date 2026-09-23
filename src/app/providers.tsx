'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  // Um QueryClient por aba. staleTime curto: varias pessoas da clinica usam o
  // sistema ao mesmo tempo, entao os dados sao recarregados ao voltar para a
  // aba e a cada 30s de navegacao.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <Toaster closeButton position="top-right" />
        {children}
      </TooltipProvider>
    </QueryClientProvider>
  )
}
