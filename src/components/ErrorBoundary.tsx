import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Top-level safety net. Without this, an uncaught render error anywhere in the
 * tree (a bad API response, a null field from a stale record) unmounts the
 * whole React tree and the user sees a blank white page mid-appointment or
 * mid-charting, with no way back except a manual refresh they may not think
 * to try. Class component because React error boundaries require the
 * componentDidCatch lifecycle — there is no hook equivalent.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Erro nao tratado na interface:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center bg-background">
          <div className="flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <p className="font-semibold text-foreground">Algo deu errado</p>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado nesta tela. Nenhum dado foi perdido no banco —
              tente recarregar a pagina.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>Recarregar pagina</Button>
        </div>
      )
    }
    return this.props.children
  }
}
