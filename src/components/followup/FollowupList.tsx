'use client'

import { useState } from 'react'
import { BellRing } from 'lucide-react'
import { AppointmentDialog } from '@/components/AppointmentDialog'
import { EmptyState } from '@/components/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { useDialog } from '@/hooks/useDialog'
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
  const schedule = useDialog<string>()

  const openContact = (followup: Followup, startAt: 'message' | 'outcome') =>
    setContact((c) => ({ followup, startAt, key: (c?.key ?? 0) + 1 }))

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
