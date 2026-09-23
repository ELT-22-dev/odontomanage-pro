'use client'

import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { keys, useInvalidate, usePatients } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { RECORD_TYPE_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import type { MedicalRecord, RecordType } from '@/lib/types'

const TYPES: RecordType[] = ['note', 'diagnosis', 'prescription', 'treatment']

/**
 * Criar/editar registro de prontuario. O paciente e escolhido numa lista
 * (a versao antiga usava texto livre e podia salvar registro sem paciente).
 */
export function RecordDialog({
  open,
  onOpenChange,
  record,
  defaultPatientId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record?: MedicalRecord | null
  defaultPatientId?: string
  onSaved?: (r: MedicalRecord) => void
}) {
  const editing = !!record
  const [form, setForm] = useState({
    patient_id: record?.patient_id ?? defaultPatientId ?? '',
    record_type: (record?.record_type ?? 'note') as RecordType,
    title: record?.title ?? '',
    content: record?.content ?? '',
    diagnosis: record?.diagnosis ?? '',
    treatment_plan: record?.treatment_plan ?? '',
    prescriptions: record?.prescriptions ?? '',
  })
  const [saving, setSaving] = useState(false)
  const { data: patients = [] } = usePatients()
  const invalidate = useInvalidate()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.patient_id || !form.title.trim()) {
      toast.error('Paciente e titulo sao obrigatorios')
      return
    }
    setSaving(true)
    try {
      const saved = editing
        ? await api.patch<MedicalRecord>(`/api/medical-records/${record!.id}`, form)
        : await api.post<MedicalRecord>('/api/medical-records', form)
      await invalidate(keys.records, keys.patients)
      toast.success(editing ? 'Registro atualizado' : 'Registro salvo')
      onSaved?.(saved)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao salvar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar registro clinico' : 'Novo registro clinico'}</DialogTitle>
        </DialogHeader>
        <form id="record-form" onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, record_type: t }))}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                    form.record_type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {RECORD_TYPE_STATUS[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rec-patient">Paciente *</Label>
              <Select id="rec-patient" value={form.patient_id} onChange={set('patient_id')} disabled={editing} required>
                <option value="">Selecione o paciente</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-title">Titulo *</Label>
              <Input id="rec-title" value={form.title} onChange={set('title')} placeholder="Ex: Evolucao - limpeza" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-content">Evolucao / Anamnese</Label>
            <Textarea id="rec-content" rows={4} value={form.content} onChange={set('content')} placeholder="Queixa, historico, procedimento realizado..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-diagnosis">Diagnostico</Label>
            <Textarea id="rec-diagnosis" rows={2} value={form.diagnosis} onChange={set('diagnosis')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-plan">Plano de tratamento</Label>
            <Textarea id="rec-plan" rows={2} value={form.treatment_plan} onChange={set('treatment_plan')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-rx">Receita / Prescricoes</Label>
            <Textarea id="rec-rx" rows={3} value={form.prescriptions} onChange={set('prescriptions')} placeholder="Medicamento, dose, posologia..." />
          </div>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="record-form" disabled={saving}>
            {saving ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Salvar registro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
