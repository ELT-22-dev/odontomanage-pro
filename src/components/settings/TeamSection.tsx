'use client'

import { useState, type FormEvent } from 'react'
import { KeyRound, MoreHorizontal, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useSession } from '@/components/SessionProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { keys, useInvalidate, useUsers } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'

/**
 * Equipe da clinica (somente admin). Nao existe cadastro publico: quem
 * cria contas e o administrador. Usuarios sao desativados, nunca excluidos.
 */
export function TeamSection() {
  const me = useSession()
  const invalidate = useInvalidate()
  const { data: users = [] } = useUsers()
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' })

  const patch = async (u: User, body: Record<string, unknown>, msg: string) => {
    try {
      await api.patch(`/api/users/${u.id}`, body)
      await invalidate(keys.users)
      toast.success(msg)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const resetPassword = (u: User) => {
    const password = prompt(`Nova senha para ${u.name} (minimo 8 caracteres). Passe para a pessoa e peca para trocar no primeiro acesso:`)
    if (!password) return
    if (password.length < 8) {
      toast.error('A senha precisa ter pelo menos 8 caracteres')
      return
    }
    patch(u, { password }, 'Senha redefinida. As sessoes abertas dessa pessoa foram encerradas.')
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/api/users', form)
      await invalidate(keys.users)
      toast.success(`Usuario ${form.email} criado`)
      setForm({ name: '', email: '', password: '', role: 'staff' })
      setAddOpen(false)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4 flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> Equipe
          </CardTitle>
          <CardDescription>
            <b>Administrador</b>: tudo, inclusive equipe, dados da clinica, exclusoes e backup. <b>Equipe</b>: uso do dia a dia.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-2 shrink-0" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="p-0 divide-y divide-border border-t border-border/60">
        {users.map((u) => (
          <div key={u.id} className={cn('flex items-center gap-3 px-6 py-3', !u.active && 'opacity-50')}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                {u.name}
                {u.role === 'admin' && <ShieldCheck className="size-3.5 text-primary" aria-label="Administrador" />}
                {u.id === me.id && <span className="text-[10px] text-muted-foreground">(voce)</span>}
                {!u.active && <span className="text-[10px] text-destructive">desativado</span>}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {u.email} · {u.last_login_at ? `ultimo acesso ${formatDateTime(u.last_login_at)}` : 'nunca entrou'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="Acoes do usuario">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => resetPassword(u)}>
                  <KeyRound className="size-3.5 mr-2" /> Redefinir senha
                </DropdownMenuItem>
                {u.role === 'staff' ? (
                  <DropdownMenuItem onClick={() => patch(u, { role: 'admin' }, `${u.name} agora e administrador`)}>
                    <ShieldCheck className="size-3.5 mr-2" /> Tornar administrador
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => patch(u, { role: 'staff' }, `${u.name} agora e equipe`)}>
                    <Users className="size-3.5 mr-2" /> Tornar equipe
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {u.active ? (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => confirm(`Desativar ${u.name}? A pessoa perde o acesso imediatamente.`) && patch(u, { active: false }, 'Usuario desativado')}
                  >
                    Desativar acesso
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => patch(u, { active: true }, 'Usuario reativado')}>Reativar acesso</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar pessoa da equipe</DialogTitle>
          </DialogHeader>
          <form id="user-form" onSubmit={create} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nome</Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email (login)</Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u-pass">Senha inicial</Label>
                <Input id="u-pass" type="text" minLength={8} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Papel</Label>
                <Select id="u-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="staff">Equipe</option>
                  <option value="admin">Administrador</option>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Passe a senha inicial para a pessoa e peca para trocar em Configuracoes → Meu perfil.</p>
          </form>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form">
              Criar usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
