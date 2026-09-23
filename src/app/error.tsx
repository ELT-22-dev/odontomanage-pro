'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Rede de seguranca: erro inesperado numa tela mostra esta mensagem em vez
 * de uma pagina em branco. Os dados ja salvos no banco nao sao afetados.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error('Erro nao tratado na interface:', error)
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1.5 max-w-sm">
        <p className="font-semibold text-foreground">Algo deu errado nesta tela</p>
        <p className="text-sm text-muted-foreground">
          Nenhum dado salvo foi perdido. Tente novamente; se continuar, avise o suporte
          {error.digest ? ` informando o codigo ${error.digest}` : ''}.
        </p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
