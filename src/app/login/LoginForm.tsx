'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/api'

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await api.post('/api/auth/login', { email, password })
      const next = params.get('next')
      // So redireciona para caminhos internos (evita "open redirect").
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err, 'Nao foi possivel entrar'))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <form className="w-full max-w-xs space-y-3 text-left" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@clinica.com.br"
            required
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </Button>
        <p className="text-center text-xs text-muted-foreground pt-2">
          Esqueceu a senha? Peca ao administrador da clinica para redefinir em Configuracoes → Equipe.
        </p>
      </form>
    </AuthShell>
  )
}
