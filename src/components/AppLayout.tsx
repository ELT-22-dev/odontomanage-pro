import { type ReactNode, useState } from 'react'
import { blink, IS_DEMO_MODE } from '@/blink/client'
import { useAuth } from '@/hooks/useAuth'
import { AppSidebar } from '@/components/AppSidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Menu } from 'lucide-react'
import { toast } from 'sonner'
import { useClinicBranding } from '@/hooks/useClinicBranding'

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, isPasswordRecovery } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { clinicName } = useClinicBranding()

  if (isPasswordRecovery) {
    return <NewPasswordScreen />
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh overflow-hidden">
        <div className="hidden md:block w-[15rem] shrink-0 border-r border-border bg-sidebar animate-pulse" />
        <div className="flex flex-1 items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen />
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside className="hidden md:block shrink-0">
        <AppSidebar user={user} />
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10">
            <AppSidebar user={user} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex flex-1 min-w-0 flex-col">
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            aria-label="Abrir menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold text-sm">{clinicName}</span>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  )
}

function AuthShell({ children }: { children: ReactNode }) {
  const { clinicName, logoDataUrl } = useClinicBranding()
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center bg-background">
      <div className="space-y-2">
        {logoDataUrl ? (
          <img src={logoDataUrl} alt="" className="mx-auto h-14 w-14 rounded-xl object-cover" />
        ) : (
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-xl bg-primary text-primary-foreground text-2xl font-bold">
            {clinicName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{clinicName}</h1>
        <p className="text-muted-foreground max-w-sm">
          Sistema completo de gestao para sua clinica odontologica.
        </p>
        {IS_DEMO_MODE && (
          <p className="text-xs text-primary max-w-sm">
            Modo demonstracao — dados ficticios, use qualquer email e senha para entrar.
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        const { needsEmailConfirmation } = await blink.auth.signUp(email, password, name)
        if (needsEmailConfirmation) {
          toast.success('Conta criada! Verifique seu email para confirmar antes de entrar.')
          setMode('signin')
        } else {
          toast.success('Conta criada com sucesso!')
        }
      } else if (mode === 'forgot') {
        await blink.auth.requestPasswordReset(email)
        toast.success('Enviamos um link para redefinir sua senha. Verifique seu email.')
        setMode('signin')
      } else {
        await blink.auth.signIn(email, password)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao autenticar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <form className="w-full max-w-xs space-y-3 text-left" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-name">Seu nome</Label>
            <Input
              id="auth-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dra. Ana Souza"
              required
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@clinica.com"
            required
          />
        </div>
        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Senha</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting
            ? 'Aguarde...'
            : mode === 'signup'
              ? 'Criar conta'
              : mode === 'forgot'
                ? 'Enviar link de redefinicao'
                : 'Entrar'}
        </Button>
        {mode === 'signin' && (
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => setMode('forgot')}
          >
            Esqueceu a senha?
          </button>
        )}
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
        >
          {mode === 'signup' ? 'Ja tem uma conta? Entrar' : 'Ainda nao tem conta? Criar conta'}
        </button>
      </form>
    </AuthShell>
  )
}

function NewPasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('As senhas nao coincidem')
      return
    }
    setSubmitting(true)
    try {
      await blink.auth.setNewPassword(password)
      toast.success('Senha atualizada com sucesso!')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar senha')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <form className="w-full max-w-xs space-y-3 text-left" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirme a nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Aguarde...' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthShell>
  )
}
