import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useState, useMemo } from 'react'
import {
  Stethoscope, Search, CheckCircle, XCircle, UserX,
  Play, Trash2, CalendarDays, Clock, ArrowUpDown,
  Activity, TrendingUp, CalendarRange, Percent,
  MoreHorizontal, ChevronDown, Filter, MessageCircle,
} from 'lucide-react'
import { openWhatsApp, buildAppointmentReminderMessage } from '@/lib/whatsapp'
import { deleteEvent as deleteGoogleEvent } from '@/lib/googleCalendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Appointment {
  id: string; patient_id: string; patient_name: string; dentist_name: string | null
  date: string; time: string; type: string; room: string | null
  notes: string | null; status: string; created_at: string; google_event_id: string | null
}

interface Patient {
  id: string; phone: string | null; whatsapp: string | null
}

export const Route = createFileRoute('/_app/consultas')({
  head: () => ({ meta: [{ title: 'Consultas · OdontoManage Pro' }] }),
  component: ConsultasPage,
})

function ConsultasPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [dentistFilter, setDentistFilter] = useState('all')
  const [sortNewest, setSortNewest] = useState(true)

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Week boundaries (Monday-based)
  const weekStart = useMemo(() => {
    const d = new Date(today)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d.toISOString().slice(0, 10)
  }, [])

  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => blink.db.table<Appointment>('appointments').list(),
  })

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: () => blink.db.table<Patient>('patients').list(),
  })

  const sendReminder = (a: Appointment) => {
    const patient = patients.find((p) => p.id === a.patient_id)
    const contact = patient?.whatsapp || patient?.phone
    if (!contact) {
      toast.error('Este paciente nao tem telefone ou WhatsApp cadastrado')
      return
    }
    const message = buildAppointmentReminderMessage({
      patientName: a.patient_name,
      date: a.date,
      time: a.time,
      dentistName: a.dentist_name,
      type: a.type,
    })
    try {
      openWhatsApp(contact, message)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao abrir WhatsApp')
    }
  }

  // Stats
  const stats = useMemo(() => {
    const todayCount = appointments.filter((a) => a.date === todayStr).length
    const weekCount = appointments.filter((a) => a.date >= weekStart).length
    const monthCount = appointments.filter((a) => a.date >= monthStart).length
    const completed = appointments.filter((a) => a.status === 'completed').length
    const rate = appointments.length > 0
      ? Math.round((completed / appointments.length) * 100)
      : 0
    return { todayCount, weekCount, monthCount, rate }
  }, [appointments, todayStr, weekStart, monthStart])

  // Unique dentists for filter dropdown
  const dentists = useMemo(() => {
    const names = new Set<string>()
    for (const a of appointments) {
      if (a.dentist_name) names.add(a.dentist_name)
    }
    return Array.from(names).sort()
  }, [appointments])

  // Filtered & sorted list
  const filtered = useMemo(() => {
    let list = appointments

    // Date range filter
    if (dateFilter === 'today') {
      list = list.filter((a) => a.date === todayStr)
    } else if (dateFilter === 'week') {
      list = list.filter((a) => a.date >= weekStart)
    } else if (dateFilter === 'month') {
      list = list.filter((a) => a.date >= monthStart)
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter)
    }

    // Dentist filter
    if (dentistFilter !== 'all') {
      list = list.filter((a) => a.dentist_name === dentistFilter)
    }

    // Search
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((a) =>
        a.patient_name.toLowerCase().includes(s) ||
        (a.dentist_name && a.dentist_name.toLowerCase().includes(s)) ||
        a.type.toLowerCase().includes(s)
      )
    }

    // Sort
    return list.sort((a, b) => {
      const cmp = (a.date + a.time).localeCompare(b.date + b.time)
      return sortNewest ? -cmp : cmp
    })
  }, [appointments, search, statusFilter, dateFilter, dentistFilter, sortNewest, todayStr, weekStart, monthStart])

  const updateStatus = async (id: string, status: string) => {
    try {
      await blink.db.table('appointments').update(id, { status } as any)
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Status atualizado')
      if (status === 'cancelled' || status === 'no_show') {
        const appt = appointments.find((a) => a.id === id)
        if (appt?.google_event_id) deleteGoogleEvent(appt.google_event_id)
      }
    } catch (err: any) { toast.error(err?.message || 'Erro') }
  }

  const deleteAppt = async (id: string) => {
    if (!confirm('Excluir esta consulta?')) return
    try {
      const appt = appointments.find((a) => a.id === id)
      await blink.db.table('appointments').delete(id)
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      toast.success('Consulta removida')
      if (appt?.google_event_id) deleteGoogleEvent(appt.google_event_id)
    } catch (err: any) { toast.error(err?.message || 'Erro') }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: appointments.length }
    for (const a of appointments) {
      counts[a.status] = (counts[a.status] || 0) + 1
    }
    return counts
  }, [appointments])

  const statusFilters = [
    { value: 'all', label: 'Todas', count: statusCounts.all || 0 },
    { value: 'scheduled', label: 'Agendadas', count: statusCounts.scheduled || 0 },
    { value: 'confirmed', label: 'Confirmadas', count: statusCounts.confirmed || 0 },
    { value: 'in_progress', label: 'Em atend.', count: statusCounts.in_progress || 0 },
    { value: 'completed', label: 'Finalizadas', count: statusCounts.completed || 0 },
    { value: 'cancelled', label: 'Canceladas', count: statusCounts.cancelled || 0 },
    { value: 'no_show', label: 'Faltaram', count: statusCounts.no_show || 0 },
  ]

  const dateFilters = [
    { value: 'all', label: 'Todas' },
    { value: 'today', label: 'Hoje' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mês' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Consultas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {appointments.length} consulta{appointments.length !== 1 ? 's' : ''} registrada{appointments.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* ────── Left sidebar ────── */}
        <div className="space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatsCard
              icon={<CalendarDays className="size-4" />}
              label="Hoje"
              value={stats.todayCount}
              color="text-blue-400"
              bg="bg-blue-500/10"
            />
            <StatsCard
              icon={<CalendarRange className="size-4" />}
              label="Semana"
              value={stats.weekCount}
              color="text-purple-400"
              bg="bg-purple-500/10"
            />
            <StatsCard
              icon={<TrendingUp className="size-4" />}
              label="Mês"
              value={stats.monthCount}
              color="text-primary"
              bg="bg-primary/10"
            />
            <StatsCard
              icon={<Percent className="size-4" />}
              label="Finalizadas"
              value={`${stats.rate}%`}
              color="text-amber-400"
              bg="bg-amber-500/10"
            />
          </div>

          {/* Date range filter */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-3" /> Período
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex flex-wrap gap-1.5">
                {dateFilters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setDateFilter(f.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
                      dateFilter === f.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dentist filter */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Stethoscope className="size-3" /> Dentista
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
                    {dentistFilter === 'all' ? 'Todos' : dentistFilter}
                    <ChevronDown className="size-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-60 overflow-auto">
                  <DropdownMenuItem onClick={() => setDentistFilter('all')}>
                    <span className={dentistFilter === 'all' ? 'font-semibold' : ''}>Todos</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {dentists.map((d) => (
                    <DropdownMenuItem key={d} onClick={() => setDentistFilter(d)}>
                      <span className={dentistFilter === d ? 'font-semibold' : ''}>{d}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>

          {/* Status filter */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Filter className="size-3" /> Status
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="flex flex-wrap gap-1.5">
                {statusFilters.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
                      statusFilter === f.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ────── Right side: list ────── */}
        <div className="space-y-3">
          {/* Search + Sort */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente, dentista ou tipo..."
                className="pl-9 h-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => setSortNewest(!sortNewest)}
              title={sortNewest ? 'Mais recentes primeiro' : 'Mais antigas primeiro'}
            >
              <ArrowUpDown className={cn('size-4', !sortNewest && 'rotate-180')} />
            </Button>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Stethoscope className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma consulta encontrada</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter !== 'all' || dateFilter !== 'all' || dentistFilter !== 'all'
                    ? 'Tente mudar os filtros'
                    : 'Agende consultas na agenda'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filtered.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors group"
                    >
                      {/* Date + Time */}
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-xs font-medium text-muted-foreground">
                          {new Date(a.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
                        <p className="text-sm font-mono font-medium text-primary">{a.time}</p>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <Link
                          to="/pacientes/$id"
                          params={{ id: a.patient_id }}
                          className="text-sm font-semibold truncate hover:text-primary hover:underline transition-colors"
                        >
                          {a.patient_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {a.type}
                          {a.dentist_name ? ` · Dr(a). ${a.dentist_name}` : ''}
                          {a.room ? ` · Sala ${a.room}` : ''}
                        </p>
                        {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{a.notes}</p>}
                      </div>

                      {/* Status badge */}
                      <StatusBadge map={APPOINTMENT_STATUS} status={a.status} className="text-[10px] px-1.5" />

                      {/* Quick actions — visible on row hover */}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 hover:bg-emerald-500/15 hover:text-emerald-400"
                          title="Enviar lembrete (WhatsApp)"
                          onClick={() => sendReminder(a)}
                        >
                          <MessageCircle className="size-3.5" />
                        </Button>
                        {a.status !== 'confirmed' && a.status !== 'in_progress' && a.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:bg-emerald-500/15 hover:text-emerald-400"
                            title="Confirmar"
                            onClick={() => updateStatus(a.id, 'confirmed')}
                          >
                            <CheckCircle className="size-3.5" />
                          </Button>
                        )}
                        {a.status !== 'in_progress' && a.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:bg-amber-500/15 hover:text-amber-400"
                            title="Iniciar atendimento"
                            onClick={() => updateStatus(a.id, 'in_progress')}
                          >
                            <Play className="size-3.5" />
                          </Button>
                        )}
                        {a.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 hover:bg-emerald-500/15 hover:text-emerald-400"
                            title="Finalizar"
                            onClick={() => updateStatus(a.id, 'completed')}
                          >
                            <CheckCircle className="size-3.5" />
                          </Button>
                        )}

                        {/* More actions dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => sendReminder(a)}>
                              <MessageCircle className="size-3.5 mr-2 text-emerald-600" /> Lembrete (WhatsApp)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(a.id, 'confirmed')}>
                              <CheckCircle className="size-3.5 mr-2 text-green-600" /> Confirmar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(a.id, 'in_progress')}>
                              <Play className="size-3.5 mr-2 text-amber-600" /> Em atendimento
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(a.id, 'completed')}>
                              <CheckCircle className="size-3.5 mr-2 text-emerald-600" /> Finalizar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateStatus(a.id, 'cancelled')}>
                              <XCircle className="size-3.5 mr-2 text-red-600" /> Cancelar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(a.id, 'no_show')}>
                              <UserX className="size-3.5 mr-2 text-gray-600" /> Faltou
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteAppt(a.id)}>
                              <Trash2 className="size-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// ──── Stats card sub-component ────

function StatsCard({
  icon,
  label,
  value,
  color,
  bg,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  bg: string
}) {
  return (
    <div className={cn('rounded-xl p-3 flex items-center gap-3', bg)}>
      <div className={cn('shrink-0', color)}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('text-lg font-bold', color)}>{value}</p>
      </div>
    </div>
  )
}
