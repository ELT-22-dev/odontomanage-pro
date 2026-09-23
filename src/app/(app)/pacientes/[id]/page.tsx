'use client'

import { use, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CalendarDays, CalendarPlus, ClipboardList, DollarSign, Edit, FilePlus, Mail, MessageCircle, Phone, Plus, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { AiPatientSummary } from '@/components/AiPatientSummary'
import { AppointmentDialog } from '@/components/AppointmentDialog'
import { AppointmentRow } from '@/components/AppointmentRow'
import { EmptyState, LoadError, Loading } from '@/components/EmptyState'
import { RecordDialog } from '@/components/RecordDialog'
import { useIsAdmin } from '@/components/SessionProvider'
import { StatusBadge } from '@/components/StatusBadge'
import { TransactionDialog } from '@/components/TransactionDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { keys, useAppointments, useClinicName, useInvalidate, usePatient, useRecords, useTransactions } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { api, errorMessage } from '@/lib/api'
import { ageFrom, formatDate, formatDateTime, todayISO } from '@/lib/dates'
import { computeTotals, formatCurrency } from '@/lib/financeStats'
import { PATIENT_STATUS, RECORD_TYPE_STATUS, TRANSACTION_STATUS } from '@/lib/statusStyles'
import { buildAppointmentReminderMessage, buildGreetingMessage, openWhatsApp } from '@/lib/whatsapp'
import type { Appointment, MedicalRecord, Transaction } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const isAdmin = useIsAdmin()
  const clinicName = useClinicName()
  const invalidate = useInvalidate()
  const today = todayISO()

  const { data: patient, isLoading, error } = usePatient(id)
  const { data: appointments = [] } = useAppointments({ patientId: id })
  const { data: records = [] } = useRecords(id)
  const { data: transactions = [] } = useTransactions(id)

  const apptDialog = useDialog<Appointment>()
  const recordDialog = useDialog<MedicalRecord>()
  const txDialog = useDialog<Transaction>()

  if (isLoading) return <Loading />
  if (error || !patient) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <LoadError message={error?.message ?? 'Paciente nao encontrado'} />
        <Link href="/pacientes" className="text-primary text-sm hover:underline">
          Voltar para pacientes
        </Link>
      </div>
    )
  }

  const age = ageFrom(patient.birth_date, today)
  const contact = patient.whatsapp || patient.phone
  const upcoming = appointments.filter((a) => a.date >= today && (a.status === 'scheduled' || a.status === 'confirmed'))
  const totals = computeTotals(transactions)
  const sortedAppts = [...appointments].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))

  const handleWhatsApp = () => {
    if (!contact) return
    const next = upcoming[0]
    const message = next
      ? buildAppointmentReminderMessage({ patientName: patient.name, date: next.date, time: next.time, dentistName: next.dentist_name, type: next.type })
      : buildGreetingMessage(patient.name, clinicName)
    try {
      openWhatsApp(contact, message)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const handleDelete = async () => {
    const u = patient.usage
    if (u.records > 0) {
      toast.error(`Este paciente tem ${u.records} registro(s) de prontuario e nao pode ser excluido. Marque como inativo em "Editar".`)
      return
    }
    const extra = u.appointments ? `\n\n${u.appointments} consulta(s) dele tambem serao apagadas.` : ''
    if (!confirm(`Excluir o paciente "${patient.name}" definitivamente?${extra}\n\nSe ele so parou de vir, prefira marcar como inativo.`)) return
    try {
      await api.del(`/api/patients/${patient.id}`)
      await invalidate(keys.patients, keys.appointments, keys.transactions)
      toast.success('Paciente excluido')
      router.push('/pacientes')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const info = (label: string, value: ReactNode, className = '') =>
    value ? (
      <div className={className}>
        <span className="text-muted-foreground">{label}:</span> <span className="font-medium">{value}</span>
      </div>
    ) : null

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-5xl">
      <title>{`${patient.name} · OdontoManage Pro`}</title>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/pacientes')} aria-label="Voltar">
            <ArrowLeft className="size-5" />
          </Button>
          <div className="flex items-center justify-center size-11 rounded-full bg-primary/10 text-primary shrink-0">
            <span className="text-sm font-bold">{patient.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground truncate">{patient.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
              <StatusBadge map={PATIENT_STATUS} status={patient.status} />
              {age !== null && <span>{age} anos</span>}
              {patient.insurance && <span>· {patient.insurance}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleWhatsApp}>
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => apptDialog.open()}>
            <CalendarPlus className="size-4" /> Agendar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => recordDialog.open()}>
            <FilePlus className="size-4" /> Prontuario
          </Button>
          <Link href={`/pacientes/${patient.id}/editar`}>
            <Button size="sm" className="gap-2">
              <Edit className="size-4" /> Editar
            </Button>
          </Link>
          {isAdmin && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-2" onClick={handleDelete}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">Informacoes</TabsTrigger>
          <TabsTrigger value="appointments">Consultas ({appointments.length})</TabsTrigger>
          <TabsTrigger value="records">Prontuario ({records.length})</TabsTrigger>
          <TabsTrigger value="finance">Financeiro ({transactions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6 mt-4">
          <AiPatientSummary patientId={patient.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            {patient.phone && <ContactCard icon={<Phone className="size-4 text-muted-foreground" />} label="Telefone" value={patient.phone} />}
            {patient.whatsapp && <ContactCard icon={<MessageCircle className="size-4 text-green-500" />} label="WhatsApp" value={patient.whatsapp} />}
            {patient.email && <ContactCard icon={<Mail className="size-4 text-muted-foreground" />} label="Email" value={patient.email} />}
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dados pessoais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              {info('CPF', patient.cpf)}
              {info('RG', patient.rg)}
              {info('Nascimento', patient.birth_date ? `${formatDate(patient.birth_date)}${age !== null ? ` (${age} anos)` : ''}` : null)}
              {info('Sexo', patient.sex === 'F' ? 'Feminino' : patient.sex === 'M' ? 'Masculino' : patient.sex)}
              {info('Estado civil', patient.marital_status)}
              {info('Profissao', patient.profession)}
              {info('Cadastrado em', formatDateTime(patient.created_at))}
            </CardContent>
          </Card>

          {(patient.address || patient.city) && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Endereco</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                {info('Endereco', patient.address, 'sm:col-span-2')}
                {info('Cidade', [patient.city, patient.state].filter(Boolean).join(' / '))}
                {info('CEP', patient.zip)}
              </CardContent>
            </Card>
          )}

          {(patient.insurance || patient.emergency_contact || patient.notes || patient.financial_guardian) && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Informacoes adicionais</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                {info('Convenio', patient.insurance)}
                {info('Carteirinha', patient.insurance_number)}
                {info('Emergencia', patient.emergency_contact)}
                {info('Resp. financeiro', patient.financial_guardian)}
                {patient.notes && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Observacoes:</span>
                    <p className="font-medium mt-1 whitespace-pre-wrap">{patient.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => apptDialog.open()}>
              <Plus className="size-4" /> Agendar consulta
            </Button>
          </div>
          {sortedAppts.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhuma consulta registrada" />
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-0 divide-y divide-border">
                {sortedAppts.map((a) => (
                  <AppointmentRow key={a.id} appointment={a} showDate hidePatient onEdit={() => apptDialog.open(a)} />
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="records" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" className="gap-2" onClick={() => recordDialog.open()}>
              <Plus className="size-4" /> Novo registro
            </Button>
          </div>
          {records.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhum registro de prontuario" />
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <Link key={r.id} href={`/prontuarios?registro=${r.id}`} className="block">
                  <Card className="border-border/60 hover:border-primary/40 transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{r.title}</p>
                          <StatusBadge map={RECORD_TYPE_STATUS} status={r.record_type} className="text-[10px] px-1.5" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(r.created_at)}
                          {r.created_by_name ? ` · ${r.created_by_name}` : ''}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="finance" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Pago:</span> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.income)}</span>
              </span>
              <span>
                <span className="text-muted-foreground">A receber:</span> <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(totals.pending)}</span>
              </span>
            </div>
            <Button size="sm" className="gap-2" onClick={() => txDialog.open()}>
              <Plus className="size-4" /> Novo lancamento
            </Button>
          </div>
          {transactions.length === 0 ? (
            <EmptyState icon={DollarSign} title="Nenhum lancamento para este paciente" />
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-0 divide-y divide-border">
                {transactions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => txDialog.open(t)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.category}
                        {t.installments > 1 ? ` · parcela ${t.current_installment}/${t.installments}` : ''}
                        {t.due_date ? ` · venc. ${formatDate(t.due_date)}` : ''}
                      </p>
                    </div>
                    <StatusBadge map={TRANSACTION_STATUS} status={t.status} />
                    <span className={cn('text-sm font-semibold', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                      {formatCurrency(t.amount)}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AppointmentDialog key={`a${apptDialog.key}`} open={apptDialog.isOpen} onOpenChange={apptDialog.setOpen} appointment={apptDialog.item} defaultPatientId={patient.id} />
      <RecordDialog key={`r${recordDialog.key}`} open={recordDialog.isOpen} onOpenChange={recordDialog.setOpen} record={recordDialog.item} defaultPatientId={patient.id} />
      <TransactionDialog key={`t${txDialog.key}`} open={txDialog.isOpen} onOpenChange={txDialog.setOpen} transaction={txDialog.item} defaultPatientId={patient.id} />
    </div>
  )
}

function ContactCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-3 flex items-center gap-3">
        <span className="shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
