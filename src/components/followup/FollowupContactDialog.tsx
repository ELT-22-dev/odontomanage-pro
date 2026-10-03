'use client'

import { useState } from 'react'
import { CalendarPlus, MessageCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { keys, useAiEnabled, useClinicName, useFollowupSettings, useInvalidate } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { addDays, formatDate, todayISO } from '@/lib/dates'
import { DEFAULT_TEMPLATES, FOLLOWUP_KIND, FOLLOWUP_OUTCOME, firstName, renderTemplate } from '@/lib/followup'
import { openWhatsApp } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import type { Followup, FollowupOutcome } from '@/lib/types'

/**
 * Contato de um follow-up em dois passos:
 *  1) mensagem (modelo da clinica ou sugerida pela IA, editavel) → abre o WhatsApp
 *  2) resultado (conversou / agendou / nao respondeu / nao quer agora)
 * Monte com `key` diferente a cada abertura.
 */
export function FollowupContactDialog({
  followup: f,
  open,
  onOpenChange,
  startAt = 'message',
  onSchedule,
}: {
  followup: Followup
  open: boolean
  onOpenChange: (open: boolean) => void
  startAt?: 'message' | 'outcome'
  onSchedule: (patientId: string) => void
}) {
  const clinicName = useClinicName()
  const aiEnabled = useAiEnabled()
  const invalidate = useInvalidate()
  const { data: settings } = useFollowupSettings()
  const contact = f.patient_whatsapp || f.patient_phone
  const vars = {
    nome: firstName(f.patient_name),
    clinica: clinicName,
    motivo: f.reason,
    data: f.appointment_date ? formatDate(f.appointment_date) : '',
  }
  const template = settings?.templates?.[f.kind] || DEFAULT_TEMPLATES[f.kind]

  const [step, setStep] = useState<'message' | 'outcome'>(startAt)
  // null = ainda nao editou: acompanha o modelo (que pode chegar depois do carregamento).
  const [edited, setEdited] = useState<string | null>(null)
  const message = edited ?? renderTemplate(template, vars)
  const [aiBusy, setAiBusy] = useState(false)

  const [outcome, setOutcome] = useState<FollowupOutcome>('contacted')
  const [notes, setNotes] = useState('')
  const [retryDays, setRetryDays] = useState('2')
  const [saving, setSaving] = useState(false)

  const suggestWithAi = async () => {
    setAiBusy(true)
    try {
      const r = await api.post<{ message: string }>('/api/ai/followup-message', { followup_id: f.id })
      setEdited(renderTemplate(r.message, vars))
    } catch (err) {
      toast.error(errorMessage(err, 'A IA nao conseguiu sugerir a mensagem'))
    } finally {
      setAiBusy(false)
    }
  }

  const sendWhatsApp = async () => {
    if (!contact) return
    try {
      openWhatsApp(contact, message)
    } catch (err) {
      toast.error(errorMessage(err))
      return
    }
    try {
      await api.post(`/api/followups/${f.id}/contact`)
      await invalidate(keys.followups)
    } catch {
      // A tentativa nao contabilizada nao impede o contato.
    }
    setStep('outcome')
  }

  const saveOutcome = async () => {
    setSaving(true)
    try {
      const retry = outcome === 'no_answer'
      await api.patch(`/api/followups/${f.id}`, {
        outcome,
        notes: notes.trim() ? [f.notes, notes.trim()].filter(Boolean).join('\n') : undefined,
        ...(retry ? { due_date: addDays(todayISO(), Math.max(1, Number(retryDays) || 1)), status: 'pending' } : { status: 'done' }),
      })
      await invalidate(keys.followups)
      toast.success(retry ? `Nova tentativa agendada para ${formatDate(addDays(todayISO(), Number(retryDays) || 1))}` : 'Follow-up concluido')
      onOpenChange(false)
      if (outcome === 'scheduled') onSchedule(f.patient_id)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{f.patient_name}</DialogTitle>
          <DialogDescription>
            {FOLLOWUP_KIND[f.kind].label} · {f.reason}
          </DialogDescription>
        </DialogHeader>

        {step === 'message' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="fu-msg">Mensagem</Label>
              {aiEnabled && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 h-7" onClick={suggestWithAi} disabled={aiBusy}>
                  <Sparkles className="size-3.5" /> {aiBusy ? 'Escrevendo...' : 'Sugerir com IA'}
                </Button>
              )}
            </div>
            <Textarea id="fu-msg" rows={6} value={message} onChange={(e) => setEdited(e.target.value)} />
            {!contact && <p className="text-xs text-destructive">Este paciente nao tem telefone/WhatsApp cadastrado. Ligue ou registre o resultado.</p>}
            {f.attempts > 0 && (
              <p className="text-xs text-muted-foreground">
                {f.attempts} tentativa(s) anterior(es){f.outcome ? ` · ultimo resultado: ${FOLLOWUP_OUTCOME[f.outcome]}` : ''}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FOLLOWUP_OUTCOME) as FollowupOutcome[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                    outcome === o ? 'border-primary bg-primary/10 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {FOLLOWUP_OUTCOME[o]}
                </button>
              ))}
            </div>
            {outcome === 'no_answer' && (
              <div className="flex items-center gap-2 text-sm">
                <span>Tentar de novo em</span>
                <Input type="number" min={1} max={60} value={retryDays} onChange={(e) => setRetryDays(e.target.value)} className="w-20 h-8" />
                <span>dia(s)</span>
              </div>
            )}
            {outcome === 'scheduled' && (
              <p className="text-xs text-muted-foreground">Ao salvar, abre a agenda para marcar a consulta.</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="fu-notes">Observacao (opcional)</Label>
              <Textarea id="fu-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: prefere horario de manha; sem dor." />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'message' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('outcome')}>
                Registrar resultado
              </Button>
              <Button type="button" className="gap-2" onClick={sendWhatsApp} disabled={!contact || !message.trim()}>
                <MessageCircle className="size-4" /> Abrir WhatsApp
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('message')}>
                Voltar
              </Button>
              <Button type="button" className="gap-2" onClick={saveOutcome} disabled={saving}>
                {outcome === 'scheduled' && <CalendarPlus className="size-4" />}
                {saving ? 'Salvando...' : 'Salvar resultado'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
