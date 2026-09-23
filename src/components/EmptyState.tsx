import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed border-border/60">
      <CardContent className="flex flex-col items-center justify-center py-14 text-center">
        <Icon className="size-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  )
}

/** Indicador de carregamento padrao. */
export function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )
}

/** Mensagem de erro de carregamento com botao de tentar de novo. */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardContent className="py-10 text-center space-y-3">
        <p className="text-sm text-destructive">{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="text-sm text-primary hover:underline cursor-pointer">
            Tentar novamente
          </button>
        )}
      </CardContent>
    </Card>
  )
}
