import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useState, useMemo } from 'react'
import {
  CalendarDays, Clock, Plus, Search, ChevronLeft, ChevronRight,
  MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, UserX, Play, MessageCircle
} from 'lucide-react'
import { openWhatsApp, buildAppointmentReminderMessage } from '@/lib/whatsapp'
import { createEvent as createGoogleEvent, deleteEvent as deleteGoogleEvent } from '@/lib/googleCalendar'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Appointment {
  id: string; patient_id: string; patient_name: string; dentist_name: string | null
  date: string; time: string; type: string; room: string | null
  notes: string | null; status: string; google_event_id: string | null
}

interface Patient {
  id: string; name: string; phone: string | null; whatsapp: string | null
}

export const Route = createFileRoute('/_app/agenda')({
  head: () => ({ meta: [{ title: 'Agenda · OdontoManage Pro' }] }),
  component: AgendaPage,
})

function AgendaPage() {
  const queryClient = useQueryClient()
  const googleCalendar = useGoogleCalendar()
  const today = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(today)
  const [newApptOpen, setNewApptOpen] = useState(false)
  const [apptForm, setApptForm] = useState({
    patient_id: '', patient_name: '', dentist_name: '', time: '',
    type: 'Consulta', room: '', notes: '',
  })

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments'],
    queryFn: () => blink.db.table<Appointment>('appointments').list(),
  })

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: () => blink.db.table<Patient>('patients').list({ orderBy: { name: 'asc' } }),
  })

  const dayAppts = appointments.filter((a) => a.date === selectedDate)

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

  const weekDates = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00')
    const day = d.getDay()
    const monday = new Date(d)
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      return date.toISOString().slice(0, 10)
    })
  }, [selectedDate])

  const navigateDate = (dir: number) => {
    const d = new Date(selectedDate + 'T00:00')
    d.setDate(d.getDate() + dir * 7)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

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

  const handleNewAppt = async () => {
    if (!apptForm.patient_id || !apptForm.time) {
      toast.error('Paciente e horario sao obrigatorios')
      return
    }
    try {
      const created = await blink.db.table<Appointment>('appointments').create({
        ...apptForm,
        date: selectedDate,
        status: 'scheduled',
        user_id: 'user',
      } as any)
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      setNewApptOpen(false)
      setApptForm({ patient_id: '', patient_name: '', dentist_name: '', time: '', type: 'Consulta', room: '', notes: '' })
      toast.success('Consulta agendada!')

      if (googleCalendar.connected) {
        try {
          const eventId = await createGoogleEvent({
            patientName: created.patient_name,
            type: created.type,
            date: created.date,
            time: created.time,
            dentistName: created.dentist_name,
            room: created.room,
            notes: created.notes,
          })
          await blink.db.table('appointments').update(created.id, { google_event_id: eventId } as any)
          queryClient.invalidateQueries({ queryKey: ['appointments'] })
          toast.success('Sincronizado com o Google Calendar')
        } catch (err: any) {
          toast.error(err?.message || 'Consulta salva, mas nao sincronizou com o Google Calendar')
        }
      }
    } catch (err: any) { toast.error(err?.message || 'Erro') }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">Visualizacao semanal</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setNewApptOpen(true)}>
          <Plus className="size-4" />
          Nova Consulta
        </Button>
      </div>

      {/* Week navigation */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium text-foreground">
              {new Date(weekDates[0] + 'T00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })} —{' '}
              {new Date(weekDates[6] + 'T00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateDate(1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => {
              const d = new Date(date + 'T00:00')
              const isSel = date === selectedDate
              const isToday = date === today
              const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
              const count = appointments.filter((a) => a.date === date).length
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'flex flex-col items-center rounded-lg py-2 text-center transition-colors cursor-pointer',
                    isSel ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    isToday && !isSel && 'ring-1 ring-primary/40'
                  )}
                >
                  <span className="text-[10px] uppercase font-medium">{dayName}</span>
                  <span className="text-lg font-bold">{d.getDate()}</span>
                  {count > 0 && (
                    <span className={cn('text-[10px] mt-0.5', isSel ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                      {count} consulta{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day's appointments */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {new Date(selectedDate + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dayAppts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <CalendarDays className="size-10 mx-auto mb-2 opacity-30" />
              Nenhuma consulta neste dia
            </div>
          ) : (
            <div className="divide-y divide-border">
              {dayAppts.sort((a, b) => a.time.localeCompare(b.time)).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
                  <span className="text-sm font-mono text-primary font-medium w-12 shrink-0">{a.time}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.patient_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.type}{a.dentist_name ? ` · Dr(a). ${a.dentist_name}` : ''}{a.room ? ` · Sala ${a.room}` : ''}
                    </p>
                  </div>
                  <StatusBadge map={APPOINTMENT_STATUS} status={a.status} className="text-[10px] px-1.5" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
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
                      <DropdownMenuItem onClick={() => updateStatus(a.id, 'cancelled')}>
                        <XCircle className="size-3.5 mr-2 text-red-600" /> Cancelar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(a.id, 'no_show')}>
                        <UserX className="size-3.5 mr-2 text-gray-600" /> Faltou
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteAppt(a.id)}>
                        <Trash2 className="size-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New appointment dialog */}
      <Dialog open={newApptOpen} onOpenChange={setNewApptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Consulta</DialogTitle>
          </DialogHeader>
          {!googleCalendar.connected && (
            <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
              Google Calendar nao conectado — esta consulta ficara so no OdontoManage. Conecte em Configuracoes para sincronizar.
            </p>
          )}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <select
                className="file:text-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                value={apptForm.patient_id}
                onChange={(e) => {
                  const patient = patients.find((p) => p.id === e.target.value)
                  setApptForm((f) => ({ ...f, patient_id: e.target.value, patient_name: patient?.name || '' }))
                }}
              >
                <option value="">
                  {patients.length === 0 ? 'Nenhum paciente cadastrado' : 'Selecione um paciente'}
                </option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Horario *</Label>
                <Input type="time" value={apptForm.time} onChange={(e) => setApptForm((f) => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Input value={apptForm.type} onChange={(e) => setApptForm((f) => ({ ...f, type: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Dentista</Label>
                <Input
                  placeholder="Nome do dentista"
                  value={apptForm.dentist_name}
                  onChange={(e) => setApptForm((f) => ({ ...f, dentist_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sala</Label>
                <Input value={apptForm.room} onChange={(e) => setApptForm((f) => ({ ...f, room: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observacoes</Label>
              <Input value={apptForm.notes} onChange={(e) => setApptForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewApptOpen(false)}>Cancelar</Button>
            <Button onClick={handleNewAppt}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
