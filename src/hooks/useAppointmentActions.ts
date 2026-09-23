'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { api, errorMessage } from '@/lib/api'
import { deleteEvent as deleteGoogleEvent } from '@/lib/googleCalendar'
import { buildAppointmentReminderMessage, openWhatsApp } from '@/lib/whatsapp'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import type { Appointment, AppointmentStatus } from '@/lib/types'
import { keys, useInvalidate } from './queries'

/**
 * Acoes sobre uma consulta, compartilhadas por Agenda, Consultas e ficha do
 * paciente: mudar status, excluir, lembrete por WhatsApp. O Google Calendar
 * e sempre "melhor esforco" — se falhar, a acao no sistema continua valendo.
 */
export function useAppointmentActions() {
  const invalidate = useInvalidate()

  const updateStatus = useCallback(
    async (appt: Appointment, status: AppointmentStatus) => {
      try {
        await api.patch(`/api/appointments/${appt.id}`, { status })
        await invalidate(keys.appointments)
        toast.success(`Status: ${APPOINTMENT_STATUS[status]?.label ?? status}`)
        if ((status === 'cancelled' || status === 'no_show') && appt.google_event_id) {
          deleteGoogleEvent(appt.google_event_id)
        }
      } catch (err) {
        toast.error(errorMessage(err))
      }
    },
    [invalidate],
  )

  const remove = useCallback(
    async (appt: Appointment) => {
      if (!confirm(`Excluir a consulta de ${appt.patient_name}? Para manter historico, prefira "Cancelar".`)) return
      try {
        await api.del(`/api/appointments/${appt.id}`)
        await invalidate(keys.appointments)
        toast.success('Consulta excluida')
        if (appt.google_event_id) deleteGoogleEvent(appt.google_event_id)
      } catch (err) {
        toast.error(errorMessage(err))
      }
    },
    [invalidate],
  )

  const sendReminder = useCallback((appt: Appointment) => {
    const contact = appt.patient_whatsapp || appt.patient_phone
    if (!contact) {
      toast.error('Este paciente nao tem telefone ou WhatsApp cadastrado')
      return
    }
    try {
      openWhatsApp(
        contact,
        buildAppointmentReminderMessage({
          patientName: appt.patient_name,
          date: appt.date,
          time: appt.time,
          dentistName: appt.dentist_name,
          type: appt.type,
        }),
      )
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }, [])

  return { updateStatus, remove, sendReminder }
}
