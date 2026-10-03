'use client'

import Link from 'next/link'
import { CalendarClock, CalendarPlus, CheckCircle, ClipboardCheck, MessageCircle, MoreHorizontal, RotateCcw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { keys, useInvalidate } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { addDays, formatDate, formatDateTime, todayISO } from '@/lib/dates'
import { FOLLOWUP_KIND, FOLLOWUP_OUTCOME } from '@/lib/followup'
import { cn } from '@/lib/utils'
import type { Followup } from '@/lib/types'

/** Quando e o contato, em linguagem da recepcao. */
export function dueLabel(due: string, today: string): { text: string; className: string } {
  if (due === today) return { text: 'Hoje', className: 'text-primary font-semibold' }
  const diff = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
  if (diff < 0) return { text: `Atrasado ${-diff}d`, className: 'text-red-500 font-semibold' }
  if (diff === 1) return { text: 'Amanha', className: 'text-foreground' }
  return { text: formatDate(due, { day: '2-digit', month: 'short' }), className: 'text-muted-foreground' }
}

export function FollowupRow({
  followup: f,
  hidePatient = false,
  onContact,
  onOutcome,
  onSchedule,
}: {
  followup: Followup
  hidePatient?: boolean
  onContact: () => void
  onOutcome: () => void
  onSchedule: () => void
}) {
  const invalidate = useInvalidate()
  const today = todayISO()
  const due = dueLabel(f.due_date, today)
  const pending = f.status === 'pending'

  const patch = async (body: Record<string, unknown>, msg: string) => {
    try {
      await api.patch(`/api/followups/${f.id}`, body)
      await invalidate(keys.followups)
      toast.success(msg)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group', !pending && 'opacity-70')}>
      <div className="w-14 sm:w-20 shrink-0 text-center">
        {pending ? (
          <p className={cn('text-xs', due.className)}>{due.text}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">{f.status === 'done' ? 'Concluido' : 'Dispensado'}</p>
        )}
        {f.attempts > 0 && <p className="text-[10px] text-muted-foreground">{f.attempts} tentativa(s)</p>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
          {!hidePatient && (
            <Link href={`/pacientes/${f.patient_id}`} className="text-sm font-semibold truncate max-w-full hover:text-primary hover:underline">
              {f.patient_name}
            </Link>
          )}
          <Badge variant="outline" className={cn('text-[10px] px-1.5 shrink-0', FOLLOWUP_KIND[f.kind].className)}>
            {FOLLOWUP_KIND[f.kind].label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{f.reason}</p>
        {(f.outcome || f.last_contact_at) && (
          <p className="text-[11px] text-muted-foreground truncate">
            {f.outcome ? FOLLOWUP_OUTCOME[f.outcome] : 'Contato'}
            {f.last_contact_at ? ` · ultimo contato ${formatDateTime(f.last_contact_at)}` : ''}
            {f.completed_by_name && !pending ? ` · por ${f.completed_by_name}` : ''}
          </p>
        )}
        {f.notes && <p className="text-[11px] text-muted-foreground italic truncate">{f.notes}</p>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {pending && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={onContact}>
            <MessageCircle className="size-3.5" /> <span className="hidden sm:inline">Contatar</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="Acoes do follow-up">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {pending ? (
              <>
                <DropdownMenuItem onClick={onOutcome}>
                  <ClipboardCheck className="size-3.5 mr-2" /> Registrar resultado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onSchedule}>
                  <CalendarPlus className="size-3.5 mr-2" /> Agendar consulta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => patch({ due_date: addDays(today, 7) }, 'Adiado para daqui a 7 dias')}>
                  <CalendarClock className="size-3.5 mr-2" /> Adiar 7 dias
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => patch({ status: 'done' }, 'Follow-up concluido')}>
                  <CheckCircle className="size-3.5 mr-2 text-emerald-600" /> Concluir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => patch({ status: 'dismissed' }, 'Follow-up dispensado')}>
                  <XCircle className="size-3.5 mr-2" /> Dispensar
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => patch({ status: 'pending', due_date: today }, 'Follow-up reaberto para hoje')}>
                <RotateCcw className="size-3.5 mr-2" /> Reabrir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
