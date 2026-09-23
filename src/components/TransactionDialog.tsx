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
import { todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionType } from '@/lib/types'

export const INCOME_CATEGORIES = ['Consulta', 'Avaliacao', 'Limpeza', 'Restauracao', 'Tratamento de canal', 'Extracao', 'Ortodontia', 'Protese', 'Implante', 'Clareamento', 'Outros']
export const EXPENSE_CATEGORIES = ['Aluguel', 'Material odontologico', 'Laboratorio', 'Salarios', 'Impostos', 'Equipamento', 'Manutencao', 'Energia/Agua/Internet', 'Marketing', 'Outros']
export const PAYMENT_METHODS: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartao de credito',
  cartao_debito: 'Cartao de debito',
  cartao: 'Cartao',
  boleto: 'Boleto',
  transferencia: 'Transferencia',
  convenio: 'Convenio',
}

interface FormState {
  type: TransactionType
  amount: string
  category: string
  description: string
  patient_id: string
  payment_method: string
  status: string
  due_date: string
  paid_date: string
  installments: string
  current_installment: string
}

function initial(t?: Transaction | null, patientId?: string): FormState {
  return {
    type: t?.type ?? 'income',
    amount: t ? String(t.amount) : '',
    category: t?.category ?? 'Consulta',
    description: t?.description ?? '',
    patient_id: t?.patient_id ?? patientId ?? '',
    payment_method: t?.payment_method ?? 'pix',
    status: t?.status ?? 'paid',
    due_date: t?.due_date ?? '',
    paid_date: t?.paid_date ?? todayISO(),
    installments: String(t?.installments ?? 1),
    current_installment: String(t?.current_installment ?? 1),
  }
}

/** Criar/editar lancamento financeiro (receita ou despesa). */
export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultPatientId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  defaultPatientId?: string
}) {
  const editing = !!transaction
  const [form, setForm] = useState<FormState>(() => initial(transaction, defaultPatientId))
  const [saving, setSaving] = useState(false)
  const { data: patients = [] } = usePatients()
  const invalidate = useInvalidate()
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const setType = (type: TransactionType) =>
    setForm((f) => ({ ...f, type, category: type === 'income' ? 'Consulta' : 'Material odontologico', patient_id: type === 'expense' ? '' : f.patient_id }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount.replace(',', '.'))
    if (!amount || amount <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    setSaving(true)
    try {
      const body = {
        ...form,
        amount,
        installments: Number(form.installments) || 1,
        current_installment: Number(form.current_installment) || 1,
        paid_date: form.status === 'paid' ? form.paid_date : '',
      }
      if (editing) await api.patch(`/api/transactions/${transaction!.id}`, body)
      else await api.post('/api/transactions', body)
      await invalidate(keys.transactions)
      toast.success(editing ? 'Lancamento atualizado' : 'Lancamento registrado')
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao salvar'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar lancamento' : 'Novo lancamento'}</DialogTitle>
        </DialogHeader>
        <form id="tx-form" onSubmit={submit} className="space-y-4">
          <div className="flex gap-2">
            {(['income', 'expense'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                  form.type === t
                    ? t === 'income'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40'
                      : 'bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/40'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {t === 'income' ? 'Receita' : 'Despesa'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Valor (R$) *</Label>
              <Input id="tx-amount" inputMode="decimal" placeholder="0,00" value={form.amount} onChange={set('amount')} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-category">Categoria</Label>
              <Input id="tx-category" list="tx-categories" value={form.category} onChange={set('category')} required />
              <datalist id="tx-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tx-description">Descricao</Label>
            <Input id="tx-description" value={form.description} onChange={set('description')} placeholder="Ex: Restauracao dente 26" />
          </div>
          {form.type === 'income' && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-patient">Paciente</Label>
              <Select id="tx-patient" value={form.patient_id} onChange={set('patient_id')}>
                <option value="">— Sem paciente —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-method">Forma de pagamento</Label>
              <Select id="tx-method" value={form.payment_method} onChange={set('payment_method')}>
                {Object.entries(PAYMENT_METHODS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-status">Situacao</Label>
              <Select id="tx-status" value={form.status} onChange={set('status')}>
                <option value="paid">{form.type === 'income' ? 'Recebido' : 'Pago'}</option>
                <option value="pending">{form.type === 'income' ? 'A receber' : 'A pagar'}</option>
                <option value="cancelled">Cancelado</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-due">Vencimento</Label>
              <Input id="tx-due" type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
            {form.status === 'paid' && (
              <div className="space-y-1.5">
                <Label htmlFor="tx-paid">Data do pagamento</Label>
                <Input id="tx-paid" type="date" value={form.paid_date} onChange={set('paid_date')} />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-inst">Parcela</Label>
              <Input id="tx-inst" type="number" min={1} max={120} value={form.current_installment} onChange={set('current_installment')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-inst-total">De (total de parcelas)</Label>
              <Input id="tx-inst-total" type="number" min={1} max={120} value={form.installments} onChange={set('installments')} />
            </div>
          </div>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="tx-form" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
