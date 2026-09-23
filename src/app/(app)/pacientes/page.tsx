'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Edit, Mail, MapPin, MoreHorizontal, Phone, Plus, Search, Upload, Users } from 'lucide-react'
import { EmptyState, LoadError, Loading } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { usePatients } from '@/hooks/queries'
import { PATIENT_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function PatientsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active')
  const { data: patients = [], isLoading, error, refetch } = usePatients()

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    const qDigits = search.replace(/\D/g, '')
    return patients.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!q) return true
      return (
        normalize(p.name).includes(q) ||
        (!!qDigits && ((p.cpf ?? '').replace(/\D/g, '').includes(qDigits) || (p.phone ?? '').replace(/\D/g, '').includes(qDigits) || (p.whatsapp ?? '').replace(/\D/g, '').includes(qDigits))) ||
        (p.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [patients, search, statusFilter])

  const counts = {
    active: patients.filter((p) => p.status === 'active').length,
    inactive: patients.filter((p) => p.status === 'inactive').length,
    all: patients.length,
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Pacientes · OdontoManage Pro</title>
      <PageHeader
        title="Pacientes"
        subtitle={`${counts.active} ativo${counts.active !== 1 ? 's' : ''} · ${counts.all} no total`}
        actions={
          <>
            <Link href="/configuracoes#importar">
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="size-4" /> Importar CSV
              </Button>
            </Link>
            <Link href="/pacientes/novo">
              <Button size="sm" className="gap-2">
                <Plus className="size-4" /> Novo paciente
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, telefone ou email..."
            className="pl-9 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5 self-start">
          {(['active', 'inactive', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                statusFilter === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'active' ? 'Ativos' : s === 'inactive' ? 'Inativos' : 'Todos'} ({counts[s]})
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
          hint={search ? 'Tente outro termo de busca' : 'Clique em "Novo paciente" ou importe uma planilha'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="border-border/60 hover:border-border hover:shadow-sm transition-all group">
              <CardContent className="p-0 flex items-center">
                <Link href={`/pacientes/${p.id}`} className="flex-1 min-w-0 flex items-center gap-4 p-4">
                  <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-sm font-semibold">
                      {p.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <StatusBadge map={PATIENT_STATUS} status={p.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {p.cpf && <span>CPF: {p.cpf}</span>}
                      {(p.whatsapp || p.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3" /> {p.whatsapp || p.phone}
                        </span>
                      )}
                      {p.email && (
                        <span className="hidden sm:flex items-center gap-1">
                          <Mail className="size-3" /> {p.email}
                        </span>
                      )}
                      {p.city && (
                        <span className="hidden md:flex items-center gap-1">
                          <MapPin className="size-3" /> {p.city}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-1 pr-3 shrink-0">
                  <div className="row-actions">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8" aria-label="Acoes">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/pacientes/${p.id}/editar`)}>
                          <Edit className="size-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/pacientes/${p.id}`)}>
                          <ChevronRight className="size-4 mr-2" /> Abrir ficha
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors hidden sm:block" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
