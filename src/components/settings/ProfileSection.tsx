'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Monitor, Moon, Sun, User } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, errorMessage } from '@/lib/api'
import { applyTheme, getStoredTheme, type ThemeMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

export function ProfileSection() {
  const user = useSession()
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch('/api/auth/profile', { name, email })
      toast.success('Perfil atualizado')
      router.refresh()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (pwd.new_password !== pwd.confirm) {
      toast.error('A confirmacao nao confere com a nova senha')
      return
    }
    try {
      await api.post('/api/auth/password', { current_password: pwd.current_password, new_password: pwd.new_password })
      setPwd({ current_password: '', new_password: '', confirm: '' })
      toast.success('Senha alterada. Outras sessoes abertas foram encerradas.')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="size-4" /> Meu perfil
        </CardTitle>
        <CardDescription>Seu nome aparece nos prontuarios que voce registra.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Nome</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email (login)</Label>
              <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              Salvar perfil
            </Button>
          </div>
        </form>

        <form onSubmit={changePassword} className="space-y-4 pt-4 border-t border-border/60">
          <p className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="size-4" /> Trocar senha
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input type="password" autoComplete="current-password" placeholder="Senha atual" value={pwd.current_password} onChange={(e) => setPwd((p) => ({ ...p, current_password: e.target.value }))} required />
            <Input type="password" autoComplete="new-password" placeholder="Nova senha (min. 8)" minLength={8} value={pwd.new_password} onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))} required />
            <Input type="password" autoComplete="new-password" placeholder="Confirmar nova senha" minLength={8} value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} required />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="outline">
              Alterar senha
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function AppearanceSection() {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme())
  const choose = (mode: ThemeMode) => {
    setTheme(mode)
    applyTheme(mode)
  }
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Aparencia</CardTitle>
        <CardDescription>Vale so para este navegador.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { mode: 'light', label: 'Claro', icon: Sun },
              { mode: 'dark', label: 'Escuro', icon: Moon },
              { mode: 'system', label: 'Sistema', icon: Monitor },
            ] as const
          ).map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => choose(mode)}
              suppressHydrationWarning
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border py-4 text-sm font-medium transition-colors cursor-pointer',
                theme === mode ? 'border-primary bg-primary/5 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
