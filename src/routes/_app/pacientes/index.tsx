import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useState } from 'react'
import {
  Users, Plus, Search, Phone, Mail, MapPin,
  ChevronRight, MoreHorizontal, Edit, Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { PATIENT_STATUS } from '@/lib/statusStyles'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface Patient {
  id: string; name: string; cpf: string | null; phone: string | null
  whatsapp: string | null; email: string | null; city: string | null
  status: string; created_at: string
}

export const Route = createFileRoute('/_app/pacientes/')({
  head: () => ({
    meta: [
      { title: 'Pacientes · OdontoManage Pro' },
      { name: 'description', content: 'Cadastro de pacientes' },
    ],
  }),
  component: PatientsPage,
})

function PatientsPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: () => blink.db.table<Patient>('patients').list({ orderBy: { name: 'asc' } }),
  })

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.cpf && p.cpf.includes(search)) ||
    (p.email && p.email.toLowerCase().includes(search.toLowerCase()))
  )

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Excluir paciente "${name}"? Esta acao nao pode ser desfeita.`)) return
    try {
      await blink.db.table('patients').delete(id)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Paciente excluido')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pacientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link to="/pacientes/novo">
          <Button size="sm" className="gap-2">
            <Plus className="size-4" />
            Novo Paciente
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou email..."
          className="pl-9 h-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Patient list */}
      {filtered.length === 0 ? (
        <Card className="border-border/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="size-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Tente outro termo de busca' : 'Clique em "Novo Paciente" para comecar'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to="/pacientes/$id"
              params={{ id: p.id }}
              className="block"
            >
              <Card className="border-border/60 hover:border-border hover:shadow-sm transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary shrink-0">
                    <span className="text-sm font-semibold">
                      {p.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <StatusBadge map={PATIENT_STATUS} status={p.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                      {p.cpf && <span>CPF: {p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</span>}
                      {p.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {p.phone}</span>}
                      {p.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {p.email}</span>}
                      {p.city && <span className="flex items-center gap-1"><MapPin className="size-3" /> {p.city}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/pacientes/$id" params={{ id: p.id }}>
                            <Edit className="size-4 mr-2" /> Editar
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(p.id, p.name)}
                        >
                          <Trash2 className="size-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
