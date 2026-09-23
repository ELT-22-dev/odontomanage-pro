'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, CalendarDays, CalendarRange, Percent, Plus, Search, Stethoscope, TrendingUp } from 'lucide-react'
import { AppointmentDialog } from '@/components/AppointmentDialog'
import { AppointmentRow } from '@/components/AppointmentRow'
import { EmptyState, LoadError, Loading } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAppointments } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { addDays, monthEnd, monthStart, mondayOf, todayISO } from '@/lib/dates'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import type { Appointment } from '@/lib/types'

type DateFilter = 'today' | 'week' | 'month' | 'upcoming' | 'all'

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'week', label: 'Esta semana' },
  { value: 'month', label: 'Este mes' },
  { value: 'upcoming', label: 'Proximas' },
  { value: 'all', label: 'Todas' },
]

function rangeFor(filter: DateFilter, today: string): { from?: string; to?: string } {
  switch (filter) {
    case 'today':
      return { from: today, to: today }
    case 'week':
      return { from: mondayOf(today), to: addDays(mondayOf(today), 6) }
    case 'month':
      return { from: monthStart(today), to: monthEnd(today) }
    case 'upcoming':
      return { from: today }
    case 'all':
      return {}
  }
}

export default function ConsultasPage() {
  const today = todayISO()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('month')
  const [dentistFilter, setDentistFilter] = useState('all')
  const [newestFirst, setNewestFirst] = useState(false)
  const dialog = useDialog<Appointment>()

  const { data: appointments = [], isLoading, error, refetch } = useAppointments(rangeFor(dateFilter, today))
  // Base para os indicadores (semana + mes corrente), independente do filtro.
  const statsFrom = mondayOf(today) < monthStart(today) ? mondayOf(today) : monthStart(today)
  const { data: recent = [] } = useAppointments({ from: statsFrom })

  const stats = useMemo(() => {
    const valid = recent.filter((a) => a.status !== 'cancelled')
    const monthList = valid.filter((a) => a.date >= monthStart(today) && a.date <= today)
    const done = monthList.filter((a) => a.status === 'completed').length
    const missed = monthList.filter((a) => a.status === 'no_show').length
    return {
      today: valid.filter((a) => a.date === today).length,
      week: valid.filter((a) => a.date >= mondayOf(today) && a.date <= addDays(mondayOf(today), 6)).length,
      month: valid.filter((a) => a.date >= monthStart(today) && a.date.slice(0, 7) === today.slice(0, 7)).length,
      // Taxa de faltas do mes (sobre consultas ja realizadas ou faltadas).
      noShowRate: done + missed > 0 ? Math.round((missed / (done + missed)) * 100) : 0,
    }
  }, [recent, today])

  const dentists = useMemo(
    () => [...new Set(appointments.map((a) => a.dentist_name).filter((d): d is string => !!d))].sort(),
    [appointments],
  )

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: appointments.length }
    for (const a of appointments) c[a.status] = (c[a.status] || 0) + 1
    return c
  }, [appointments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = appointments.filter(
      (a) =>
        (statusFilter === 'all' || a.status === statusFilter) &&
        (dentistFilter === 'all' || a.dentist_name === dentistFilter) &&
        (!q || a.patient_name.toLowerCase().includes(q) || (a.dentist_name ?? '').toLowerCase().includes(q) || a.type.toLowerCase().includes(q)),
    )
    return [...list].sort((a, b) => {
      const cmp = (a.date + a.time).localeCompare(b.date + b.time)
      return newestFirst ? -cmp : cmp
    })
  }, [appointments, search, statusFilter, dentistFilter, newestFirst])

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Consultas · OdontoManage Pro</title>
      <PageHeader
        title="Consultas"
        subtitle={`${appointments.length} consulta${appointments.length !== 1 ? 's' : ''} no periodo`}
        actions={
          <Button size="sm" className="gap-2" onClick={() => dialog.open()}>
            <Plus className="size-4" /> Nova consulta
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatsCard icon={<CalendarDays className="size-4" />} label="Hoje" value={stats.today} color="text-blue-500 dark:text-blue-400" bg="bg-blue-500/10" />
            <StatsCard icon={<CalendarRange className="size-4" />} label="Semana" value={stats.week} color="text-purple-500 dark:text-purple-400" bg="bg-purple-500/10" />
            <StatsCard icon={<TrendingUp className="size-4" />} label="Mes" value={stats.month} color="text-primary" bg="bg-primary/10" />
            <StatsCard icon={<Percent className="size-4" />} label="Faltas no mes" value={`${stats.noShowRate}%`} color="text-amber-500 dark:text-amber-400" bg="bg-amber-500/10" />
          </div>

          <FilterCard title="Periodo">
            <Pills options={DATE_FILTERS} value={dateFilter} onChange={setDateFilter} />
          </FilterCard>

          <FilterCard title="Dentista">
            <Select value={dentistFilter} onChange={(e) => setDentistFilter(e.target.value)} className="h-8 text-xs">
              <option value="all">Todos</option>
              {dentists.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </FilterCard>

          <FilterCard title="Status">
            <Pills
              options={[
                { value: 'all', label: `Todas (${statusCounts.all || 0})` },
                ...Object.entries(APPOINTMENT_STATUS).map(([value, s]) => ({ value, label: `${s.label} (${statusCounts[value] || 0})` })),
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </FilterCard>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Buscar por paciente, dentista ou procedimento..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => setNewestFirst(!newestFirst)}
              title={newestFirst ? 'Mais recentes primeiro' : 'Mais antigas primeiro'}
              aria-label="Inverter ordem"
            >
              <ArrowUpDown className={cn('size-4', newestFirst && 'rotate-180')} />
            </Button>
          </div>

          {isLoading ? (
            <Loading />
          ) : error ? (
            <LoadError message={error.message} onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={Stethoscope} title="Nenhuma consulta encontrada" hint="Tente mudar os filtros" />
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-0 divide-y divide-border">
                {filtered.map((a) => (
                  <AppointmentRow key={a.id} appointment={a} showDate onEdit={() => dialog.open(a)} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AppointmentDialog key={dialog.key} open={dialog.isOpen} onOpenChange={dialog.setOpen} appointment={dialog.item} />
    </div>
  )
}

function FilterCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
    </Card>
  )
}

function Pills<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
            value === o.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StatsCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string | number; color: string; bg: string }) {
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
