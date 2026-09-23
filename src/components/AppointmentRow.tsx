'use client'

import Link from 'next/link'
import { CheckCircle, Edit, MessageCircle, MoreHorizontal, Play, Trash2, UserX, XCircle } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAppointmentActions } from '@/hooks/useAppointmentActions'
import { formatDate } from '@/lib/dates'
import { APPOINTMENT_STATUS } from '@/lib/statusStyles'
import type { Appointment } from '@/lib/types'

/**
 * Uma linha de consulta com todas as acoes (usada na Agenda, em Consultas e
 * na ficha do paciente). As acoes ficam sempre visiveis no celular.
 */
export function AppointmentRow({
  appointment: a,
  showDate = false,
  hidePatient = false,
  onEdit,
}: {
  appointment: Appointment
  showDate?: boolean
  hidePatient?: boolean
  onEdit: () => void
}) {
  const { updateStatus, remove, sendReminder } = useAppointmentActions()
  const closed = a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
      <button type="button" onClick={onEdit} className="w-14 shrink-0 text-center cursor-pointer" title="Editar consulta">
        {showDate && <p className="text-[11px] font-medium text-muted-foreground">{formatDate(a.date, { day: '2-digit', month: 'short' })}</p>}
        <p className="text-sm font-mono font-medium text-primary">{a.time}</p>
      </button>

      <div className="flex-1 min-w-0">
        {hidePatient ? (
          <p className="text-sm font-semibold truncate">{a.type}</p>
        ) : (
          <Link href={`/pacientes/${a.patient_id}`} className="text-sm font-semibold truncate hover:text-primary hover:underline block">
            {a.patient_name}
          </Link>
        )}
        <p className="text-xs text-muted-foreground truncate">
          {!hidePatient && a.type}
          {a.dentist_name ? `${hidePatient ? '' : ' · '}${a.dentist_name}` : ''}
          {a.room ? ` · Sala ${a.room}` : ''}
          {` · ${a.duration_minutes} min`}
        </p>
        {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{a.notes}</p>}
      </div>

      <StatusBadge map={APPOINTMENT_STATUS} status={a.status} className="text-[10px] px-1.5 hidden sm:inline-flex" />

      <div className="row-actions flex items-center gap-0.5 shrink-0">
        {!closed && (
          <Button variant="ghost" size="icon" className="size-8 hidden sm:inline-flex" title="Lembrete por WhatsApp" onClick={() => sendReminder(a)}>
            <MessageCircle className="size-4" />
          </Button>
        )}
        {a.status === 'scheduled' && (
          <Button variant="ghost" size="icon" className="size-8 hidden sm:inline-flex" title="Confirmar" onClick={() => updateStatus(a, 'confirmed')}>
            <CheckCircle className="size-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Acoes da consulta">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="px-2 py-1.5 sm:hidden">
              <StatusBadge map={APPOINTMENT_STATUS} status={a.status} />
            </div>
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="size-3.5 mr-2" /> Editar / remarcar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => sendReminder(a)}>
              <MessageCircle className="size-3.5 mr-2 text-emerald-600" /> Lembrete (WhatsApp)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => updateStatus(a, 'confirmed')}>
              <CheckCircle className="size-3.5 mr-2 text-green-600" /> Confirmar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStatus(a, 'in_progress')}>
              <Play className="size-3.5 mr-2 text-amber-600" /> Em atendimento
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStatus(a, 'completed')}>
              <CheckCircle className="size-3.5 mr-2 text-emerald-600" /> Finalizar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStatus(a, 'no_show')}>
              <UserX className="size-3.5 mr-2" /> Faltou
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => updateStatus(a, 'cancelled')}>
              <XCircle className="size-3.5 mr-2 text-red-600" /> Cancelar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => remove(a)}>
              <Trash2 className="size-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
