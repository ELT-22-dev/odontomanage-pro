'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { keys, useDentists, useInvalidate, usePatients } from '@/hooks/queries'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { ApiError, api, errorMessage } from '@/lib/api'
import { todayISO } from '@/lib/dates'
import { createEvent, updateEvent } from '@/lib/googleCalendar'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import type { Appointment } from '@/lib/types'

export const APPOINTMENT_TYPES = ['Consulta', 'Avaliacao', 'Limpeza', 'Restauracao', 'Canal', 'Extracao', 'Ortodontia', 'Clareamento', 'Implante', 'Retorno']
const DURATIONS = [15, 20, 30, 40, 45, 60, 90, 120]

interface FormState {
  patient_id: string
  date: string
  time: string
  duration_minutes: string
  type: string
  dentist_name: string
  room: string
  notes: string
  status: string
}

function initialForm(appt?: Appointment | null, defaults?: { date?: string; patientId?: string }): FormState {
  return {
    patient_id: appt?.patient_id ?? defaults?.patientId ?? '',
    date: appt?.date ?? defaults?.date ?? todayISO(),
    time: appt?.time ?? '',
    duration_minutes: String(appt?.duration_minutes ?? 30),
    type: appt?.type ?? 'Consulta',
    dentist_name: appt?.dentist_name ?? '',
    room: appt?.room ?? '',
    notes: appt?.notes ?? '',
    status: appt?.status ?? 'scheduled',
  }
}

/**
 * Criar/editar consulta. Detecta conflito de horario do mesmo dentista (a API
 * responde 409) e pergunta se quer encaixar mesmo assim.
 * Monte com `key` diferente a cada abertura para o formulario reiniciar.
 */
export function AppointmentDialog({
  open,
  onOpenChange,
  appointment,
  defaultDate,
  defaultPatientId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: Appointment | null
  defaultDate?: string
  defaultPatientId?: string
}) {
  const editing = !!appointment
  const [form, setForm] = useState<FormState>(() => initialForm(appointment, { date: defaultDate, patientId: defaultPatientId }))
  const [saving, setSaving] = useState(false)
  const { data: patients = [] } = usePatients()
  const { data: dentists = [] } = useDentists()
  const google = useGoogleCalendar()
  const invalidate = useInvalidate()
  const activePatients = patients.filter((p) => p.status === 'active' || p.id === form.patient_id)

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (force = false): Promise<Appointment | null> => {
    const body = { ...form, duration_minutes: Number(form.duration_minutes), force }
    try {
      return editing
        ? await api.patch<Appointment>(`/api/appointments/${appointment!.id}`, body)
        : await api.post<Appointment>('/api/appointments', body)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.body.conflict) {
        if (confirm(`${err.message}\n\nAgendar mesmo assim (encaixe)?`)) return save(true)
        return null
      }
      throw err
    }
  }

  const syncGoogle = async (saved: Appointment) => {
    if (!google.connected) return
    const input = {
      patientName: saved.patient_name,
      type: saved.type,
      date: saved.date,
      time: saved.time,
      dentistName: saved.dentist_name,
      room: saved.room,
      notes: saved.notes,
      durationMinutes: saved.duration_minutes,
    }
    try {
      if (saved.google_event_id) {
        await updateEvent(saved.google_event_id, input)
      } else {
        const eventId = await createEvent(input)
        await api.patch(`/api/appointments/${saved.id}`, { google_event_id: eventId })
      }
    } catch (err) {
      toast.error(`Consulta salva, mas nao sincronizou com o Google Calendar: ${errorMessage(err)}`)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.patient_id || !form.date || !form.time) {
      toast.error('Paciente, data e horario sao obrigatorios')
      return
    }
    setSaving(true)
    try {
      const saved = await save()
      if (!saved) return
      await syncGoogle(saved)
      await invalidate(keys.appointments, keys.dentists, keys.patients)
      toast.success(editing ? 'Consulta atualizada' : 'Consulta agendada')
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao salvar consulta'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar consulta' : 'Nova consulta'}</DialogTitle>
        </DialogHeader>
        <form id="appointment-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="appt-patient">Paciente *</Label>
            <Select id="appt-patient" value={form.patient_id} onChange={set('patient_id')} required>
              <option value="">{patients.length === 0 ? 'Nenhum paciente cadastrado' : 'Selecione um paciente'}</option>
              {activePatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Data *</Label>
              <Input id="appt-date" type="date" value={form.date} onChange={set('date')} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Horario *</Label>
              <Input id="appt-time" type="time" value={form.time} onChange={set('time')} required />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="appt-duration">Duracao</Label>
              <Select id="appt-duration" value={form.duration_minutes} onChange={set('duration_minutes')}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-type">Procedimento</Label>
              <Input id="appt-type" list="appt-types" value={form.type} onChange={set('type')} />
              <datalist id="appt-types">
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-room">Sala</Label>
              <Input id="appt-room" value={form.room} onChange={set('room')} placeholder="Ex: 1" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appt-dentist">Dentista</Label>
            <Input id="appt-dentist" list="appt-dentists" value={form.dentist_name} onChange={set('dentist_name')} placeholder="Nome do dentista" />
            <datalist id="appt-dentists">
              {dentists.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <p className="text-[11px] text-muted-foreground">Informe o dentista para o sistema avisar sobre horarios em conflito.</p>
          </div>
          {editing && (
            <div className="space-y-1.5">
              <Label htmlFor="appt-status">Status</Label>
              <Select id="appt-status" value={form.status} onChange={set('status')}>
                {Object.entries(APPOINTMENT_STATUS).map(([value, s]) => (
                  <option key={value} value={value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">Observacoes</Label>
            <Textarea id="appt-notes" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          {google.configured && !google.connected && (
            <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
              Google Calendar nao conectado neste navegador — a consulta fica so no sistema. Conecte em Configuracoes.
            </p>
          )}
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="appointment-form" disabled={saving}>
            {saving ? 'Salvando...' : editing ? 'Salvar' : 'Agendar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
