'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Clock, DollarSign, Plus, Search, UserPlus, Users, Wallet } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { AppointmentDialog } from '@/components/AppointmentDialog'
import { PageHeader } from '@/components/PageHeader'
import { useSession } from '@/components/SessionProvider'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppointments, usePatients, useTransactions } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { addDays, formatDate, todayISO } from '@/lib/dates'
import { computeTotals, filterByPeriod, formatCurrency } from '@/lib/financeStats'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import type { Appointment } from '@/lib/types'

export default function DashboardPage() {
  const user = useSession()
  const [search, setSearch] = useState('')
  const today = todayISO()
  const dialog = useDialog<Appointment>()

  const { data: patients = [] } = usePatients()
  const { data: appointments = [] } = useAppointments({ from: addDays(today, -13) })
  const { data: transactions = [] } = useTransactions()

  const todayAppts = appointments.filter((a) => a.date === today && a.status !== 'cancelled')
  const monthTotals = useMemo(() => computeTotals(filterByPeriod(transactions, 'this-month', today)), [transactions, today])

  const stats = [
    { label: 'Pacientes ativos', value: String(patients.filter((p) => p.status === 'active').length), icon: Users, highlight: true },
    { label: 'Consultas hoje', value: String(todayAppts.length), icon: CalendarDays },
    { label: 'Recebido no mes', value: formatCurrency(monthTotals.income), icon: DollarSign },
    { label: 'A receber no mes', value: formatCurrency(monthTotals.pending), icon: Wallet },
  ]

  const trend = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const date = addDays(today, i - 13)
        return {
          label: formatDate(date, { day: '2-digit', month: '2-digit' }),
          consultas: appointments.filter((a) => a.date === date && a.status !== 'cancelled').length,
        }
      }),
    [appointments, today],
  )

  // Proximas consultas: de hoje em diante (a versao antiga misturava consultas
  // passadas nunca finalizadas e mostrava so o horario, sem a data).
  const upcoming = appointments
    .filter((a) => a.date >= today && (a.status === 'scheduled' || a.status === 'confirmed'))
    .filter((a) => !search.trim() || a.patient_name.toLowerCase().includes(search.trim().toLowerCase()))
    .slice(0, 8)

  const firstName = user.name.split(' ').find((w) => !/^(dr|dra|sr|sra)\.?$/i.test(w)) ?? user.name

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Dashboard · OdontoManage Pro</title>
      <PageHeader
        title="Dashboard"
        subtitle={`Bem-vindo(a), ${firstName} · ${formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <>
            <Link href="/pacientes/novo">
              <Button variant="outline" size="sm" className="gap-2">
                <UserPlus className="size-4" /> Novo paciente
              </Button>
            </Link>
            <Button size="sm" className="gap-2" onClick={() => dialog.open()}>
              <Plus className="size-4" /> Nova consulta
            </Button>
          </>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className={cn(
              'rounded-2xl p-4 flex flex-col gap-3 border bg-card/70 backdrop-blur-md',
              s.highlight ? 'border-primary/50 glow-primary' : 'border-border/60',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
              <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary shrink-0">
                <s.icon className="size-4" />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-bold leading-none text-primary truncate">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Consultas nos ultimos 14 dias</CardTitle>
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
                  contentStyle={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="consultas"
                  name="Consultas"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#trendFill)"
                  dot={{ r: 3, fill: 'var(--color-primary)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Proximas consultas</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar paciente..." className="pl-8 h-8 w-40 md:w-52" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                <Clock className="size-8 mx-auto mb-2 opacity-30" />
                Nenhuma consulta agendada
              </div>
            ) : (
              <div className="divide-y divide-border">
                {upcoming.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => dialog.open(a)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="w-16 shrink-0">
                      <p className="text-[11px] text-muted-foreground">{a.date === today ? 'Hoje' : formatDate(a.date, { day: '2-digit', month: 'short' })}</p>
                      <p className="text-sm font-mono text-primary">{a.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.patient_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {a.type}
                        {a.dentist_name ? ` · ${a.dentist_name}` : ''}
                      </p>
                    </div>
                    <StatusBadge map={APPOINTMENT_STATUS} status={a.status} />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AppointmentDialog key={dialog.key} open={dialog.isOpen} onOpenChange={dialog.setOpen} appointment={dialog.item} />
    </div>
  )
}
