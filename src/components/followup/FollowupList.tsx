'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { toast } from 'sonner'
import { AppointmentDialog } from '@/components/AppointmentDialog'
import { EmptyState } from '@/components/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { useDialog } from '@/hooks/useDialog'
import { keys, useClinicName, useFollowupSettings, useInvalidate } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { formatDate } from '@/lib/dates'
import { DEFAULT_TEMPLATES, firstName, renderTemplate } from '@/lib/followup'
import { openWhatsApp } from '@/lib/whatsapp'
import type { Followup } from '@/lib/types'
import { FollowupContactDialog } from './FollowupContactDialog'
import { FollowupRow } from './FollowupRow'

/**
 * Lista de follow-ups com todas as acoes (contatar, resultado, agendar).
 * Usada na tela Follow-up e na ficha do paciente.
 */
export function FollowupList({
  followups,
  hidePatient = false,
  emptyTitle = 'Nenhum follow-up aqui',
  emptyHint,
}: {
  followups: Followup[]
  hidePatient?: boolean
  emptyTitle?: string
  emptyHint?: string
}) {
  const [contact, setContact] = useState<{ followup: Followup; startAt: 'message' | 'outcome'; key: number } | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const schedule = useDialog<string>()
  const clinicName = useClinicName()
  const { data: settings } = useFollowupSettings()
  const invalidate = useInvalidate()

  const openContact = (followup: Followup, startAt: 'message' | 'outcome') =>
    setContact((c) => ({ followup, startAt, key: (c?.key ?? 0) + 1 }))

  /** Envia a mensagem-modelo com um clique, sem passar pelo dialogo de edicao. */
  const quickSend = async (f: Followup) => {
    const contactInfo = f.patient_whatsapp || f.patient_phone
    if (!contactInfo) {
      toast.error('Este paciente nao tem telefone/WhatsApp cadastrado')
      return
    }
    const template = settings?.templates?.[f.kind] || DEFAULT_TEMPLATES[f.kind]
    const message = renderTemplate(template, {
      nome: firstName(f.patient_name),
      clinica: clinicName,
      motivo: f.reason,
      data: f.appointment_date ? formatDate(f.appointment_date) : '',
    })
    try {
      openWhatsApp(contactInfo, message)
    } catch (err) {
      toast.error(errorMessage(err))
      return
    }
    setSendingId(f.id)
    try {
      await api.post(`/api/followups/${f.id}/contact`)
      await invalidate(keys.followups)
    } catch {
      // Tentativa nao contabilizada nao impede o contato.
    } finally {
      setSendingId(null)
    }
  }

  if (followups.length === 0) return <EmptyState icon={BellRing} title={emptyTitle} hint={emptyHint} />

  return (
    <>
      <Card className="border-border/60">
        <CardContent className="p-0 divide-y divide-border">
          {followups.map((f) => (
            <FollowupRow
              key={f.id}
              followup={f}
              hidePatient={hidePatient}
              onQuickSend={() => quickSend(f)}
              sending={sendingId === f.id}
              onContact={() => openContact(f, 'message')}
              onOutcome={() => openContact(f, 'outcome')}
              onSchedule={() => schedule.open(f.patient_id)}
            />
          ))}
        </CardContent>
      </Card>

      {contact && (
        <FollowupContactDialog
          key={contact.key}
          followup={contact.followup}
          startAt={contact.startAt}
          open
          onOpenChange={(o) => !o && setContact(null)}
          onSchedule={(patientId) => schedule.open(patientId)}
        />
      )}
      <AppointmentDialog key={`s${schedule.key}`} open={schedule.isOpen} onOpenChange={schedule.setOpen} defaultPatientId={schedule.item ?? undefined} />
    </>
  )
}
