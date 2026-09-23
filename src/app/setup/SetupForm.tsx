'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AuthShell } from '@/components/AuthShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/api'

export function SetupForm() {
  const router = useRouter()
  const [form, setForm] = useState({ clinic_name: '', name: '', email: '', password: '', confirm: '' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('As senhas nao coincidem')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/api/auth/setup', { clinic_name: form.clinic_name, name: form.name, email: form.email, password: form.password })
      toast.success('Clinica configurada! Bem-vindo(a).')
      router.replace('/')
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell subtitle="Configuracao inicial — crie a conta do administrador da clinica.">
      <form className="w-full max-w-sm space-y-3 text-left" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="clinic_name">Nome da clinica</Label>
          <Input id="clinic_name" value={form.clinic_name} onChange={set('clinic_name')} placeholder="Clinica Sorriso" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" value={form.name} onChange={set('name')} placeholder="Dra. Ana Souza" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email (sera seu login)</Label>
          <Input id="email" type="email" autoComplete="username" value={form.email} onChange={set('email')} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set('password')} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar</Label>
            <Input id="confirm" type="password" autoComplete="new-password" minLength={8} value={form.confirm} onChange={set('confirm')} required />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Minimo de 8 caracteres. Outros usuarios da equipe sao criados depois, em Configuracoes.</p>
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Configurando...' : 'Criar conta e entrar'}
        </Button>
      </form>
    </AuthShell>
  )
}
