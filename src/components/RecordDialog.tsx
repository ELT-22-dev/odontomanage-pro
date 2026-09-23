'use client'

import { useState, type FormEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { keys, useAiEnabled, useInvalidate, usePatients } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { RECORD_TYPE_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import type { AiStructuredNote, MedicalRecord, RecordType } from '@/lib/types'

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
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const aiEnabled = useAiEnabled()
  const { data: patients = [] } = usePatients()
  const invalidate = useInvalidate()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  /** Manda a anotacao livre para a IA e preenche os campos (nada e salvo ainda). */
  const organizeWithAi = async () => {
    const hasContent = [form.content, form.diagnosis, form.treatment_plan, form.prescriptions].some((v) => v.trim())
    if (hasContent && !confirm('Substituir o conteudo atual dos campos pelo texto organizado pela IA?')) return
    setAiBusy(true)
    try {
      const r = await api.post<AiStructuredNote>('/api/ai/structure-note', { text: aiText })
      setForm((f) => ({
        ...f,
        record_type: r.record_type,
        title: f.title.trim() ? f.title : r.title,
        content: r.content,
        diagnosis: r.diagnosis,
        treatment_plan: r.treatment_plan,
        prescriptions: r.prescriptions,
      }))
      toast.success('Campos preenchidos pela IA. Revise antes de salvar.')
    } catch (err) {
      toast.error(errorMessage(err, 'A IA nao conseguiu organizar o texto'))
    } finally {
      setAiBusy(false)
    }
  }

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
          {aiEnabled && !editing && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <Label htmlFor="rec-ai" className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" /> Anotacao livre — a IA organiza nos campos abaixo
              </Label>
              <Textarea
                id="rec-ai"
                rows={3}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="Ex: pcte relata dor ao mastigar lado esq ha 1 semana. 36 com carie profunda oclusal, teste frio positivo prolongado. Indicado canal 36 em 3 sessoes. Prescrito ibuprofeno 400mg 8/8h por 3 dias."
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">A IA so sugere — revise tudo antes de salvar. Nao precisa escrever nome ou CPF.</p>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={organizeWithAi} disabled={aiBusy || aiText.trim().length < 10}>
                  <Sparkles className="size-3.5" /> {aiBusy ? 'Organizando...' : 'Organizar com IA'}
                </Button>
              </div>
            </div>
          )}
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
