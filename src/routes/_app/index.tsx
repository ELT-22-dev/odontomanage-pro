import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useAuth } from '@/hooks/useAuth'
import {
  Users, CalendarDays, DollarSign, Search, Upload, UserPlus, Clock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/StatusBadge'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts'
import { computeTotals, type Transaction } from '@/lib/financeStats'

interface Patient { id: string; name: string; status: string; created_at: string }
interface Appointment {
  id: string; patient_name: string; dentist_name: string | null
  date: string; time: string; type: string; status: string
}

export const Route = createFileRoute('/_app/')({
  head: () => ({
    meta: [
      { title: 'Dashboard · OdontoManage Pro' },
      { name: 'description', content: 'Dashboard da clinica odontologica' },
    ],
  }),
  component: Dashboard,
})

function Dashboard() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: () => blink.db.table<Patient>('patients').list(),
  })

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => blink.db.table<Appointment>('appointments').list(),
  })

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => blink.db.table<Transaction>('transactions').list(),
  })

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 7) + '-01'
  const todayAppts = appointments.filter((a) => a.date === today)
  const monthlyRevenue = useMemo(() => {
    const monthTx = transactions.filter((t) => (t.paid_date || t.created_at).slice(0, 10) >= monthStart)
    return computeTotals(monthTx).income
  }, [transactions, monthStart])

  const stats = useMemo(() => [
    { label: 'Pacientes Totais', value: String(patients.length), icon: Users, highlight: true },
    { label: 'Consultas Hoje', value: String(todayAppts.length), icon: CalendarDays, highlight: false },
    {
      label: 'Faturamento Mensal',
      value: monthlyRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
      icon: DollarSign,
      highlight: false,
    },
  ], [patients, todayAppts, monthlyRevenue])

  const trend = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      return d.toISOString().slice(0, 10)
    })
    return days.map((date) => ({
      date,
      label: new Date(date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      consultas: appointments.filter((a) => a.date === date).length,
    }))
  }, [appointments])

  const upcoming = appointments
    .filter((a) => a.status === 'scheduled' || a.status === 'confirmed')
    .filter((a) => !search.trim() || a.patient_name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 8)

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bem-vindo{user?.displayName ? `, ${user.displayName}` : ''} · Visao geral da clinica
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente..."
              className="pl-8 w-44 md:w-56"
            />
          </div>
          <Link to="/configuracoes">
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="size-4" />
              Importar CSV
            </Button>
          </Link>
          <Link to="/pacientes/novo">
            <Button variant="outline" size="sm" className="gap-2">
              <UserPlus className="size-4" />
              Adicionar Paciente
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              'rounded-2xl p-4 flex flex-col gap-3 border bg-card/70 backdrop-blur-md',
              s.highlight ? 'border-primary/50 glow-primary' : 'border-border/60'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary shrink-0">
                <s.icon className="size-4" />
              </div>
            </div>
            <p className="text-3xl font-bold leading-none text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart + upcoming appointments */}
      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Crescimento da Clinica</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <RechartsTooltip
                  contentStyle={{
                    background: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="consultas"
                  name="Consultas"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--color-primary)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proximas Consultas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                <Clock className="size-8 mx-auto mb-2 opacity-30" />
                Nenhuma consulta agendada
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="font-medium px-4 pb-2">Paciente</th>
                    <th className="font-medium px-4 pb-2">Horario</th>
                    <th className="font-medium px-4 pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {upcoming.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium truncate max-w-[140px]">{a.patient_name}</td>
                      <td className="px-4 py-2.5 font-mono text-primary">{a.time}</td>
                      <td className="px-4 py-2.5 text-right"><StatusBadge map={APPOINTMENT_STATUS} status={a.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
