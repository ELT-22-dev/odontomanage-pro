import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useState, useMemo, useEffect } from 'react'
import {
  ClipboardList, Search, Plus, FileText, Stethoscope,
  Pill, Trash2, ChevronRight, Clock, Printer, Pencil,
  CalendarDays, BarChart3, Users, Sparkles, Loader2
} from 'lucide-react'
import { summarizeRecord } from '@/lib/ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/StatusBadge'
import { RECORD_TYPE_STATUS } from '@/lib/statusStyles'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface MedicalRecord {
  id: string; patient_id: string; patient_name: string
  record_type: string; title: string; content: string | null
  diagnosis: string | null; treatment_plan: string | null
  prescriptions: string | null; created_at: string; updated_at?: string
}

interface Patient { id: string; name: string }

const blankForm = {
  patient_id: '', patient_name: '', record_type: 'note',
  title: '', content: '', diagnosis: '', treatment_plan: '', prescriptions: '',
}

export const Route = createFileRoute('/_app/prontuarios')({
  head: () => ({ meta: [{ title: 'Prontuarios · OdontoManage Pro' }] }),
  component: ProntuariosPage,
})

function ProntuariosPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [patientFilter, setPatientFilter] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null)
  const [editingRecord, setEditingRecord] = useState<MedicalRecord | null>(null)
  const [form, setForm] = useState({ ...blankForm })
  const [summarizing, setSummarizing] = useState(false)

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients'],
    queryFn: () => blink.db.table<Patient>('patients').list({ orderBy: { name: 'asc' } }),
  })

  const { data: records = [] } = useQuery<MedicalRecord[]>({
    queryKey: ['medicalRecords'],
    queryFn: () => blink.db.table<MedicalRecord>('medical_records').list(),
  })

  // Pre-fill form when editing
  useEffect(() => {
    if (editingRecord && newOpen) {
      setForm({
        patient_id: editingRecord.patient_id,
        patient_name: editingRecord.patient_name,
        record_type: editingRecord.record_type,
        title: editingRecord.title,
        content: editingRecord.content || '',
        diagnosis: editingRecord.diagnosis || '',
        treatment_plan: editingRecord.treatment_plan || '',
        prescriptions: editingRecord.prescriptions || '',
      })
    }
  }, [editingRecord, newOpen])

  const handleDialogClose = (open: boolean) => {
    setNewOpen(open)
    if (!open) {
      setEditingRecord(null)
      setForm({ ...blankForm })
    }
  }

  // --- Filtering ---
  const filtered = useMemo(() => {
    let list = records
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((r) =>
        r.patient_name.toLowerCase().includes(s) ||
        r.title.toLowerCase().includes(s) ||
        (r.content && r.content.toLowerCase().includes(s))
      )
    }
    if (typeFilter !== 'all') {
      list = list.filter((r) => r.record_type === typeFilter)
    }
    if (patientFilter) {
      list = list.filter((r) => r.patient_id === patientFilter)
    }
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [records, search, typeFilter, patientFilter])

  // --- Statistics ---
  const stats = useMemo(() => {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const thisMonthRecords = records.filter((r) => r.created_at.startsWith(thisMonth))
    const typeCounts: Record<string, number> = {}
    for (const r of records) {
      typeCounts[r.record_type] = (typeCounts[r.record_type] || 0) + 1
    }
    return { total: records.length, thisMonth: thisMonthRecords.length, typeCounts }
  }, [records])

  // --- Type filter pills ---
  const typeFilters = [
    { value: 'all', label: 'Todos', count: stats.total },
    { value: 'note', label: 'Evolucao', count: stats.typeCounts.note || 0 },
    { value: 'diagnosis', label: 'Diagnostico', count: stats.typeCounts.diagnosis || 0 },
    { value: 'prescription', label: 'Receita', count: stats.typeCounts.prescription || 0 },
    { value: 'treatment', label: 'Tratamento', count: stats.typeCounts.treatment || 0 },
  ]

  // --- CRUD ---
  const handleSave = async () => {
    if (!form.patient_name.trim() || !form.title.trim()) {
      toast.error('Paciente e titulo obrigatorios')
      return
    }
    try {
      if (editingRecord) {
        await blink.db.table('medical_records').update(editingRecord.id, {
          ...form,
          updated_at: new Date().toISOString(),
        } as any)
        toast.success('Prontuario atualizado')
      } else {
        await blink.db.table('medical_records').create({
          ...form,
          user_id: 'user',
        } as any)
        toast.success('Prontuario registrado')
      }
      queryClient.invalidateQueries({ queryKey: ['medicalRecords'] })
      setNewOpen(false)
      setEditingRecord(null)
      setForm({ ...blankForm })
    } catch (err: any) {
      toast.error(err?.message || 'Erro')
    }
  }

  const handleSummarize = async () => {
    if (!form.content.trim()) {
      toast.error('Escreva algumas anotacoes na Evolucao/Anamnese primeiro')
      return
    }
    setSummarizing(true)
    try {
      const summary = await summarizeRecord({
        rawNotes: form.content,
        patientName: form.patient_name,
        recordType: form.record_type,
      })
      setForm((f) => ({
        ...f,
        content: summary.content || f.content,
        diagnosis: summary.diagnosis || f.diagnosis,
        treatment_plan: summary.treatment_plan || f.treatment_plan,
        prescriptions: summary.prescriptions || f.prescriptions,
      }))
      toast.success('Rascunho gerado pela IA — revise os campos antes de salvar')
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar resumo com IA')
    } finally {
      setSummarizing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este registro?')) return
    try {
      await blink.db.table('medical_records').delete(id)
      queryClient.invalidateQueries({ queryKey: ['medicalRecords'] })
      setSelectedRecord(null)
      toast.success('Registro excluido')
    } catch (err: any) {
      toast.error(err?.message || 'Erro')
    }
  }

  const openEdit = (record: MedicalRecord) => {
    setEditingRecord(record)
    setNewOpen(true)
  }

  // --- Helpers ---
  const recordTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      note: <FileText className="size-4" />,
      diagnosis: <Stethoscope className="size-4" />,
      prescription: <Pill className="size-4" />,
      treatment: <ClipboardList className="size-4" />,
    }
    return icons[type] || <FileText className="size-4" />
  }

  const recordTypeLabel = (type: string) => RECORD_TYPE_STATUS[type]?.label ?? type

  const recordTypeColors = (type: string) => RECORD_TYPE_STATUS[type]?.className ?? ''

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  const formatDateShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })

  // --- Detail View ---
  const DetailView = () => {
    if (!selectedRecord) return null
    return (
      <Card className="border-border/60 print:shadow-none print:border print:border-gray-200">
        <CardContent className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge map={RECORD_TYPE_STATUS} status={selectedRecord.record_type} className="text-[10px] px-1.5" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{selectedRecord.title}</h2>
              <p className="text-sm text-muted-foreground">
                Paciente:{' '}
                <Link
                  to="/pacientes/$id"
                  params={{ id: selectedRecord.patient_id }}
                  className="text-primary hover:underline"
                >
                  {selectedRecord.patient_name}
                </Link>
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(selectedRecord.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-1 print:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => window.print()}
                title="Imprimir"
              >
                <Printer className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-primary"
                onClick={() => openEdit(selectedRecord)}
                title="Editar"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(selectedRecord.id)}
                title="Excluir"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          {/* Content sections */}
          {selectedRecord.content && (
            <div className="bg-muted/50 rounded-lg p-4 print:bg-gray-50 print:border print:border-gray-200">
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                Evolucao / Anamnese
              </p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{selectedRecord.content}</p>
            </div>
          )}

          {selectedRecord.diagnosis && (
            <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/30 print:bg-amber-50 print:border-amber-200">
              <p className="text-xs font-medium text-amber-400 mb-1 uppercase tracking-wider print:text-amber-700">
                Diagnostico
              </p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{selectedRecord.diagnosis}</p>
            </div>
          )}

          {selectedRecord.treatment_plan && (
            <div className="bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30 print:bg-emerald-50 print:border-emerald-200">
              <p className="text-xs font-medium text-emerald-400 mb-1 uppercase tracking-wider print:text-emerald-700">
                Plano de Tratamento
              </p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{selectedRecord.treatment_plan}</p>
            </div>
          )}

          {selectedRecord.prescriptions && (
            <div className="bg-purple-500/10 rounded-lg p-4 border border-purple-500/30 print:bg-purple-50 print:border-purple-200">
              <p className="text-xs font-medium text-purple-400 mb-1 uppercase tracking-wider print:text-purple-700">
                Receitas / Prescricoes
              </p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{selectedRecord.prescriptions}</p>
            </div>
          )}

          {!selectedRecord.content && !selectedRecord.diagnosis &&
            !selectedRecord.treatment_plan && !selectedRecord.prescriptions && (
            <div className="bg-muted/30 rounded-lg p-6 text-center">
              <p className="text-sm text-muted-foreground">Nenhum conteudo adicional neste registro.</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // --- List Item ---
  const ListItem = ({ record }: { record: MedicalRecord }) => {
    const isSelected = selectedRecord?.id === record.id
    return (
      <Card
        className={cn(
          'border-border/60 hover:border-border hover:shadow-sm transition-all cursor-pointer group',
          isSelected && 'border-primary/50 ring-1 ring-primary/20 bg-primary/5',
        )}
        onClick={() => setSelectedRecord(record)}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn(
            'flex items-center justify-center size-10 rounded-lg shrink-0',
            recordTypeColors(record.record_type),
          )}>
            {recordTypeIcon(record.record_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold truncate">{record.title}</p>
              <StatusBadge map={RECORD_TYPE_STATUS} status={record.record_type} className="text-[10px] px-1.5" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{record.patient_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="size-3" />
              {formatDateShort(record.created_at)}
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
        </CardContent>
      </Card>
    )
  }

  // --- Empty states ---
  const EmptyList = () => (
    <Card className="border-dashed border-border/60">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <ClipboardList className="size-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          {search || typeFilter !== 'all' || patientFilter
            ? 'Nenhum registro encontrado'
            : 'Nenhum prontuario registrado'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {search || typeFilter !== 'all' || patientFilter
            ? 'Tente mudar os filtros'
            : 'Clique em Novo Registro para comecar'}
        </p>
      </CardContent>
    </Card>
  )

  const EmptyDetail = () => (
    <Card className="border-dashed border-border/60 h-full">
      <CardContent className="flex flex-col items-center justify-center py-24 text-center">
        <ClipboardList className="size-12 text-muted-foreground/20 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">Selecione um registro</p>
        <p className="text-xs text-muted-foreground mt-1">
          Clique em um prontuario na lista para ver os detalhes
        </p>
      </CardContent>
    </Card>
  )

  // --- Render ---
  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Prontuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {records.length} registro{records.length !== 1 ? 's' : ''} clinico{records.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" /> Novo Registro
        </Button>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/50 glow-primary">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary shrink-0">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total de registros</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.thisMonth}</p>
              <p className="text-xs text-muted-foreground">Este mes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-purple-500/15 text-purple-400 shrink-0">
              <BarChart3 className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                {typeFilters.slice(1).filter((f) => f.count > 0).map((f) => (
                  <span key={f.value} className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{f.count}</span> {f.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Por tipo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {typeFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setTypeFilter(f.value)
              setSelectedRecord(null)
            }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
              typeFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Search + Patient filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou titulo..."
            className="pl-9 h-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setSelectedRecord(null)
            }}
          />
        </div>
        <div className="relative sm:w-56">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          <select
            value={patientFilter}
            onChange={(e) => {
              setPatientFilter(e.target.value)
              setSelectedRecord(null)
            }}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 appearance-none cursor-pointer"
          >
            <option value="">Todos os pacientes</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop: Split layout */}
      <div className="hidden md:flex gap-6 items-start">
        <div className="w-2/5 lg:w-[38%] flex flex-col gap-2">
          {filtered.length === 0 ? (
            <EmptyList />
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-440px)] overflow-y-auto pr-1">
              {filtered.map((r) => (
                <ListItem key={r.id} record={r} />
              ))}
            </div>
          )}
        </div>
        <div className="w-3/5 lg:w-[62%] sticky top-24">
          {selectedRecord ? <DetailView /> : <EmptyDetail />}
        </div>
      </div>

      {/* Mobile: Toggle layout */}
      <div className="md:hidden">
        {selectedRecord ? (
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedRecord(null)}
              className="print:hidden"
            >
              ← Voltar para lista
            </Button>
            <DetailView />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyList />
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <ListItem key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={newOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar Registro Clinico' : 'Novo Registro Clinico'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <div className="flex gap-2">
                {(['note', 'diagnosis', 'prescription', 'treatment'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, record_type: t }))}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                      form.record_type === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {recordTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient */}
            <div className="space-y-1.5">
              <Label>Paciente *</Label>
              <Input
                value={form.patient_name}
                onChange={(e) => {
                  setForm((f) => ({ ...f, patient_name: e.target.value }))
                  const match = patients.find(
                    (p) => p.name.toLowerCase() === e.target.value.toLowerCase(),
                  )
                  if (match) setForm((f) => ({ ...f, patient_id: match.id }))
                }}
                placeholder="Nome do paciente"
                list="patient-list"
              />
              <datalist id="patient-list">
                {patients.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Titulo *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Titulo do registro"
              />
            </div>

            {/* Content fields */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Evolucao / Anamnese</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-primary"
                  onClick={handleSummarize}
                  disabled={summarizing || !form.content.trim()}
                  title="Organiza o texto acima e sugere diagnostico, plano de tratamento e prescricoes. Revise antes de salvar."
                >
                  {summarizing ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {summarizing ? 'Gerando...' : 'Resumir com IA'}
                </Button>
              </div>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Descreva a evolucao ou anamnese do paciente..."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Diagnostico</Label>
              <Textarea
                value={form.diagnosis}
                onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))}
                placeholder="Diagnostico clinico..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plano de Tratamento</Label>
              <Textarea
                value={form.treatment_plan}
                onChange={(e) => setForm((f) => ({ ...f, treatment_plan: e.target.value }))}
                placeholder="Plano de tratamento proposto..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Receitas / Prescricoes</Label>
              <Textarea
                value={form.prescriptions}
                onChange={(e) => setForm((f) => ({ ...f, prescriptions: e.target.value }))}
                placeholder="Medicamentos e prescricoes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingRecord ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
