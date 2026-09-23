'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { AppointmentDialog } from '@/components/AppointmentDialog'
import { AppointmentRow } from '@/components/AppointmentRow'
import { EmptyState, Loading } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAppointments } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { addDays, formatDate, todayISO, weekOf } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Appointment } from '@/lib/types'

export default function AgendaPage() {
  const today = todayISO()
  const [selectedDate, setSelectedDate] = useState(today)
  const dialog = useDialog<Appointment>()
  const week = useMemo(() => weekOf(selectedDate), [selectedDate])

  // So carrega a semana visivel (a versao antiga carregava a agenda inteira).
  const { data: appointments = [], isLoading } = useAppointments({ from: week[0], to: week[6] })

  const dayAppts = appointments.filter((a) => a.date === selectedDate)
  const activeCount = (date: string) => appointments.filter((a) => a.date === date && a.status !== 'cancelled').length

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Agenda · OdontoManage Pro</title>
      <PageHeader
        title="Agenda"
        subtitle="Visualizacao semanal"
        actions={
          <>
            <Input type="date" value={selectedDate} onChange={(e) => e.target.value && setSelectedDate(e.target.value)} className="w-40 h-8" aria-label="Ir para data" />
            {selectedDate !== today && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(today)}>
                Hoje
              </Button>
            )}
            <Button size="sm" className="gap-2" onClick={() => dialog.open()}>
              <Plus className="size-4" /> Nova consulta
            </Button>
          </>
        }
      />

      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedDate(addDays(selectedDate, -7))} aria-label="Semana anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {formatDate(week[0], { day: 'numeric', month: 'long' })} — {formatDate(week[6], { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedDate(addDays(selectedDate, 7))} aria-label="Proxima semana">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {week.map((date) => {
              const isSel = date === selectedDate
              const count = activeCount(date)
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'flex flex-col items-center rounded-lg py-2 text-center transition-colors cursor-pointer',
                    isSel ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    date === today && !isSel && 'ring-1 ring-primary/40',
                  )}
                >
                  <span className="text-[10px] uppercase font-medium">{formatDate(date, { weekday: 'short' }).replace('.', '')}</span>
                  <span className="text-lg font-bold">{Number(date.slice(8))}</span>
                  <span className={cn('text-[10px] mt-0.5 h-3', isSel ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    {count > 0 ? <><span className="sm:hidden">{count}</span><span className="hidden sm:inline">{count} consulta{count !== 1 ? 's' : ''}</span></> : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base first-letter:uppercase">{formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <Loading />
          ) : dayAppts.length === 0 ? (
            <div className="p-4 pt-0">
              <EmptyState
                icon={CalendarDays}
                title="Nenhuma consulta neste dia"
                action={
                  <Button size="sm" variant="outline" onClick={() => dialog.open()}>
                    Agendar neste dia
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dayAppts.map((a) => (
                <AppointmentRow key={a.id} appointment={a} onEdit={() => dialog.open(a)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AppointmentDialog key={dialog.key} open={dialog.isOpen} onOpenChange={dialog.setOpen} appointment={dialog.item} defaultDate={selectedDate} />
    </div>
  )
}
