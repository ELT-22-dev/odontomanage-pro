'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, errorMessage } from '@/lib/api'
import { isValidCpf, maskCep, maskCpf, maskPhone, UFS } from '@/lib/br'
import type { Patient } from '@/lib/types'

const FIELDS = [
  'name', 'cpf', 'rg', 'birth_date', 'sex', 'marital_status', 'profession', 'phone', 'whatsapp', 'email',
  'address', 'city', 'state', 'zip', 'notes', 'emergency_contact', 'insurance', 'insurance_number',
  'financial_guardian', 'status',
] as const
type Field = (typeof FIELDS)[number]
type FormState = Record<Field, string>

const MASKS: Partial<Record<Field, (v: string) => string>> = {
  cpf: maskCpf,
  phone: maskPhone,
  whatsapp: maskPhone,
  zip: maskCep,
}

function toForm(p?: Patient | null): FormState {
  const f = {} as FormState
  for (const k of FIELDS) f[k] = (p?.[k] as string | null | undefined) ?? ''
  if (!f.status) f.status = 'active'
  return f
}

/**
 * Formulario de paciente — o mesmo para cadastrar e para editar (a versao
 * antiga nao tinha edicao: um erro de digitacao so saia excluindo o paciente).
 */
export function PatientForm({
  patient,
  onSaved,
  onCancel,
}: {
  patient?: Patient | null
  onSaved: (p: Patient) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(() => toForm(patient))
  const [saving, setSaving] = useState(false)
  const editing = !!patient

  const handle = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const name = e.target.name as Field
    const mask = MASKS[name]
    const value = mask ? mask(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [name]: value }))
  }

  const cpfInvalid = form.cpf.replace(/\D/g, '').length > 0 && !isValidCpf(form.cpf)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Nome e obrigatorio')
      return
    }
    if (cpfInvalid && !confirm('O CPF digitado parece invalido. Salvar mesmo assim?')) return
    setSaving(true)
    try {
      const saved = editing
        ? await api.patch<Patient>(`/api/patients/${patient!.id}`, form)
        : await api.post<Patient>('/api/patients', form)
      toast.success(editing ? 'Paciente atualizado' : 'Paciente cadastrado')
      onSaved(saved)
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao salvar paciente'))
      setSaving(false)
    }
  }

  const field = (name: Field, label: string, props: React.ComponentProps<typeof Input> = {}, className = '') => (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} value={form[name]} onChange={handle} {...props} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Dados Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field('name', 'Nome completo *', { required: true, placeholder: 'Nome do paciente', autoFocus: !editing }, 'sm:col-span-2')}
          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" name="cpf" value={form.cpf} onChange={handle} placeholder="000.000.000-00" inputMode="numeric" aria-invalid={cpfInvalid} />
            {cpfInvalid && <p className="text-xs text-destructive">CPF invalido (confira os numeros)</p>}
          </div>
          {field('rg', 'RG')}
          {field('birth_date', 'Data de nascimento', { type: 'date' })}
          <div className="space-y-1.5">
            <Label htmlFor="sex">Sexo</Label>
            <Select id="sex" name="sex" value={form.sex} onChange={handle}>
              <option value="">—</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
              <option value="Outro">Outro</option>
            </Select>
          </div>
          {field('marital_status', 'Estado civil', { placeholder: 'Solteiro(a)' })}
          {field('profession', 'Profissao')}
          {editing && (
            <div className="space-y-1.5">
              <Label htmlFor="status">Situacao</Label>
              <Select id="status" name="status" value={form.status} onChange={handle}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field('phone', 'Telefone', { placeholder: '(00) 0000-0000', inputMode: 'tel' })}
          {field('whatsapp', 'WhatsApp', { placeholder: '(00) 00000-0000', inputMode: 'tel' })}
          {field('email', 'Email', { type: 'email', placeholder: 'email@exemplo.com' }, 'sm:col-span-2')}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Endereco</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {field('address', 'Endereco', { placeholder: 'Rua, numero, bairro' }, 'sm:col-span-4')}
          {field('city', 'Cidade', {}, 'sm:col-span-2')}
          <div className="space-y-1.5">
            <Label htmlFor="state">UF</Label>
            <Select id="state" name="state" value={form.state} onChange={handle}>
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
              {form.state && !UFS.includes(form.state) && <option value={form.state}>{form.state}</option>}
            </Select>
          </div>
          {field('zip', 'CEP', { placeholder: '00000-000', inputMode: 'numeric' })}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Informacoes Adicionais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {field('insurance', 'Convenio', { placeholder: 'Nome do convenio' })}
          {field('insurance_number', 'No. Carteirinha')}
          {field('emergency_contact', 'Contato de emergencia', { placeholder: 'Nome e telefone' })}
          {field('financial_guardian', 'Responsavel financeiro')}
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="notes">Observacoes</Label>
            <Textarea id="notes" name="notes" value={form.notes} onChange={handle} rows={3} placeholder="Alergias, preferencias, observacoes gerais" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="gap-2">
          <Save className="size-4" />
          {saving ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Salvar paciente'}
        </Button>
      </div>
    </form>
  )
}
