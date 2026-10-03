'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { keys, useInvalidate, usePatients } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { addDays, todayISO } from '@/lib/dates'
import { FOLLOWUP_KIND } from '@/lib/followup'
import type { FollowupKind } from '@/lib/types'

/** Follow-up manual: "falar com fulano em tal dia sobre tal coisa". */
export function FollowupFormDialog({
  open,
  onOpenChange,
  defaultPatientId,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultPatientId?: string
  defaults?: { kind?: FollowupKind; reason?: string; due_date?: string }
}) {
  const { data: patients = [] } = usePatients()
  const invalidate = useInvalidate()
  const [form, setForm] = useState({
    patient_id: defaultPatientId ?? '',
    kind: defaults?.kind ?? ('recall' as FollowupKind),
    due_date: defaults?.due_date ?? addDays(todayISO(), 7),
    reason: defaults?.reason ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.patient_id || !form.reason.trim()) {
      toast.error('Paciente e motivo sao obrigatorios')
      return
    }
    setSaving(true)
    try {
      await api.post('/api/followups', form)
      await invalidate(keys.followups)
      toast.success('Follow-up criado')
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo follow-up</DialogTitle>
        </DialogHeader>
        <form id="followup-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fu-patient">Paciente *</Label>
            <Select id="fu-patient" value={form.patient_id} onChange={set('patient_id')} disabled={!!defaultPatientId} required>
              <option value="">Selecione o paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fu-kind">Tipo</Label>
              <Select id="fu-kind" value={form.kind} onChange={set('kind')}>
                {(Object.keys(FOLLOWUP_KIND) as FollowupKind[]).map((k) => (
                  <option key={k} value={k}>
                    {FOLLOWUP_KIND[k].label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fu-date">Data do contato</Label>
              <Input id="fu-date" type="date" value={form.due_date} onChange={set('due_date')} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-reason">Motivo *</Label>
            <Input id="fu-reason" value={form.reason} onChange={set('reason')} placeholder="Ex: retorno para avaliar a gengiva" required />
          </div>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="followup-form" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
