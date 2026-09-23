'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, ClipboardList, Clock, FileText, Pencil, Pill, Plus, Printer, Search, Stethoscope, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState, Loading } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { RecordDialog } from '@/components/RecordDialog'
import { useIsAdmin } from '@/components/SessionProvider'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { keys, useInvalidate, usePatients, useRecords, useSettings } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { api, errorMessage } from '@/lib/api'
import { formatDateTime, formatTimestampDate, toISODate, todayISO } from '@/lib/dates'
import { RECORD_TYPE_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import type { MedicalRecord, RecordType } from '@/lib/types'

const TYPE_ICONS: Record<RecordType, typeof FileText> = {
  note: FileText,
  diagnosis: Stethoscope,
  prescription: Pill,
  treatment: ClipboardList,
}

export default function ProntuariosPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Prontuarios />
    </Suspense>
  )
}

function Prontuarios() {
  const router = useRouter()
  const params = useSearchParams()
  const isAdmin = useIsAdmin()
  const invalidate = useInvalidate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | RecordType>('all')
  const patientFilter = params.get('paciente') ?? ''
  const selectedId = params.get('registro')
  const dialog = useDialog<MedicalRecord>()

  const { data: patients = [] } = usePatients()
  const { data: records = [], isLoading } = useRecords()

  // Filtros ficam na URL: da para mandar o link de um registro para um colega.
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`/prontuarios${next.toString() ? `?${next}` : ''}`, { scroll: false })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter(
      (r) =>
        (typeFilter === 'all' || r.record_type === typeFilter) &&
        (!patientFilter || r.patient_id === patientFilter) &&
        (!q ||
          r.patient_name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          [r.content, r.diagnosis, r.treatment_plan, r.prescriptions].some((f) => (f ?? '').toLowerCase().includes(q))),
    )
  }, [records, search, typeFilter, patientFilter])

  const selected = records.find((r) => r.id === selectedId) ?? null
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: records.length }
    for (const r of records) c[r.record_type] = (c[r.record_type] || 0) + 1
    return c
  }, [records])
  const thisMonth = records.filter((r) => toISODate(new Date(r.created_at)).slice(0, 7) === todayISO().slice(0, 7)).length

  const remove = async (r: MedicalRecord) => {
    if (!confirm(`Excluir o registro "${r.title}" de ${r.patient_name}? Prontuario e documento clinico — esta acao fica registrada na auditoria.`)) return
    try {
      await api.del(`/api/medical-records/${r.id}`)
      await invalidate(keys.records, keys.patients)
      setParam('registro', null)
      toast.success('Registro excluido')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const detail = selected ? (
    <RecordDetail record={selected} canDelete={isAdmin} onEdit={() => dialog.open(selected)} onDelete={() => remove(selected)} />
  ) : null

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Prontuarios · OdontoManage Pro</title>
      <div className="print:hidden space-y-6">
        <PageHeader
          title="Prontuarios"
          subtitle={`${records.length} registro${records.length !== 1 ? 's' : ''} · ${thisMonth} este mes`}
          actions={
            <Button size="sm" className="gap-2" onClick={() => dialog.open()}>
              <Plus className="size-4" /> Novo registro
            </Button>
          }
        />

        <div className="flex flex-wrap gap-2">
          {(['all', 'note', 'diagnosis', 'prescription', 'treatment'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {t === 'all' ? 'Todos' : RECORD_TYPE_STATUS[t].label} ({counts[t] || 0})
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Buscar por paciente, titulo ou conteudo..." className="pl-9 h-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative sm:w-64">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
            <Select value={patientFilter} onChange={(e) => setParam('paciente', e.target.value || null)} className="h-10 pl-9">
              <option value="">Todos os pacientes</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          {/* Desktop: lista + detalhe lado a lado */}
          <div className="hidden md:flex gap-6 items-start print:block">
            <div className="w-2/5 lg:w-[38%] space-y-2 max-h-[calc(100dvh-340px)] overflow-y-auto pr-1 print:hidden">
              {filtered.length === 0 ? (
                <EmptyState icon={ClipboardList} title="Nenhum registro encontrado" hint="Mude os filtros ou crie um novo registro" />
              ) : (
                filtered.map((r) => <RecordListItem key={r.id} record={r} selected={r.id === selectedId} onSelect={() => setParam('registro', r.id)} />)
              )}
            </div>
            <div className="w-3/5 lg:w-[62%] sticky top-4 print:w-full print:static">
              {detail ?? <EmptyState icon={ClipboardList} title="Selecione um registro" hint="Clique em um item da lista para ver os detalhes" />}
            </div>
          </div>

          {/* Celular: lista OU detalhe */}
          <div className="md:hidden">
            {selected ? (
              <div className="space-y-3">
                <Button variant="ghost" size="sm" onClick={() => setParam('registro', null)} className="print:hidden">
                  ← Voltar para a lista
                </Button>
                {detail}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Nenhum registro encontrado" />
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <RecordListItem key={r.id} record={r} selected={false} onSelect={() => setParam('registro', r.id)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <RecordDialog
        key={dialog.key}
        open={dialog.isOpen}
        onOpenChange={dialog.setOpen}
        record={dialog.item}
        defaultPatientId={patientFilter || undefined}
        onSaved={(r) => setParam('registro', r.id)}
      />
    </div>
  )
}

function RecordListItem({ record, selected, onSelect }: { record: MedicalRecord; selected: boolean; onSelect: () => void }) {
  const Icon = TYPE_ICONS[record.record_type] ?? FileText
  return (
    <Card
      className={cn(
        'border-border/60 hover:border-border hover:shadow-sm transition-all cursor-pointer group',
        selected && 'border-primary/50 ring-1 ring-primary/20 bg-primary/5',
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn('flex items-center justify-center size-10 rounded-lg shrink-0 border', RECORD_TYPE_STATUS[record.record_type]?.className)}>
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{record.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{record.patient_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <Clock className="size-3" />
            {formatTimestampDate(record.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
      </CardContent>
    </Card>
  )
}

const SECTIONS: { key: keyof MedicalRecord; label: string; cls: string }[] = [
  { key: 'content', label: 'Evolucao / Anamnese', cls: 'bg-muted/50' },
  { key: 'diagnosis', label: 'Diagnostico', cls: 'bg-amber-500/10 border border-amber-500/30' },
  { key: 'treatment_plan', label: 'Plano de tratamento', cls: 'bg-emerald-500/10 border border-emerald-500/30' },
  { key: 'prescriptions', label: 'Receita / Prescricoes', cls: 'bg-purple-500/10 border border-purple-500/30' },
]

function RecordDetail({ record, canDelete, onEdit, onDelete }: { record: MedicalRecord; canDelete: boolean; onEdit: () => void; onDelete: () => void }) {
  const { data: clinic } = useSettings()
  const hasContent = SECTIONS.some((s) => record[s.key])

  return (
    <Card className="border-border/60 print-area print:border-0 print:shadow-none">
      <CardContent className="p-6 space-y-5 print:p-0">
        {/* Cabecalho que so aparece na impressao */}
        <div className="hidden print:block border-b border-gray-300 pb-3 mb-2">
          <p className="text-lg font-bold">{clinic?.clinic_name}</p>
          {(clinic?.address || clinic?.phone) && <p className="text-xs">{[clinic?.address, clinic?.phone].filter(Boolean).join(' · ')}</p>}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <StatusBadge map={RECORD_TYPE_STATUS} status={record.record_type} className="text-[10px] px-1.5 print:hidden" />
            <h2 className="text-lg font-semibold text-foreground">{record.title}</h2>
            <p className="text-sm text-muted-foreground">
              Paciente:{' '}
              <Link href={`/pacientes/${record.patient_id}`} className="text-primary hover:underline print:text-black print:no-underline">
                {record.patient_name}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(record.created_at)}
              {record.created_by_name ? ` · por ${record.created_by_name}` : ''}
              {record.updated_at && record.updated_at !== record.created_at && record.updated_by_name
                ? ` · editado por ${record.updated_by_name} em ${formatDateTime(record.updated_at)}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 print:hidden shrink-0">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => window.print()} title="Imprimir" aria-label="Imprimir">
              <Printer className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} title="Editar" aria-label="Editar">
              <Pencil className="size-4" />
            </Button>
            {canDelete && (
              <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" onClick={onDelete} title="Excluir" aria-label="Excluir">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>

        {SECTIONS.map((s) =>
          record[s.key] ? (
            <div key={s.key} className={cn('rounded-lg p-4 print:bg-transparent print:border print:border-gray-300', s.cls)}>
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{record[s.key] as string}</p>
            </div>
          ) : null,
        )}

        {!hasContent && (
          <div className="bg-muted/30 rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">Nenhum conteudo adicional neste registro.</p>
          </div>
        )}

        {/* Assinatura, so na impressao */}
        <div className="hidden print:block pt-16">
          <div className="mx-auto w-72 border-t border-black pt-1 text-center text-xs">{record.created_by_name ?? 'Cirurgiao-dentista'}</div>
        </div>
      </CardContent>
    </Card>
  )
}
