import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useState } from 'react'
import {
  ArrowLeft, Edit, Trash2, Phone, Mail, MapPin,
  CalendarDays, Stethoscope, FileText, Clock, ChevronRight, MessageCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/StatusBadge'
import { PATIENT_STATUS, APPOINTMENT_STATUS } from '@/lib/statusStyles'
import { toast } from 'sonner'
import { openWhatsApp, buildAppointmentReminderMessage, buildGreetingMessage } from '@/lib/whatsapp'

interface Patient {
  id: string; name: string; cpf: string | null; rg: string | null
  birth_date: string | null; sex: string | null; marital_status: string | null
  profession: string | null; phone: string | null; whatsapp: string | null
  email: string | null; address: string | null; city: string | null
  state: string | null; zip: string | null; notes: string | null
  emergency_contact: string | null; insurance: string | null
  insurance_number: string | null; financial_guardian: string | null
  status: string; created_at: string
}

interface Appointment {
  id: string; patient_id: string; patient_name: string
  dentist_name: string | null; date: string; time: string
  type: string; room: string | null; notes: string | null; status: string
}

export const Route = createFileRoute('/_app/pacientes/$id')({
  head: () => ({ meta: [{ title: 'Paciente · OdontoManage Pro' }] }),
  component: PatientDetailPage,
})

function PatientDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: patient, isLoading } = useQuery<Patient | null>({
    queryKey: ['patients', id],
    queryFn: () => blink.db.table<Patient>('patients').get(id),
  })

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments', id],
    queryFn: () => blink.db.table<Appointment>('appointments').list(),
    enabled: !!patient,
  })

  const patientAppts = appointments.filter((a) => a.patient_id === id)

  const handleWhatsApp = () => {
    if (!patient) return
    const contact = patient.whatsapp || patient.phone
    if (!contact) {
      toast.error('Este paciente nao tem telefone ou WhatsApp cadastrado')
      return
    }
    const today = new Date().toISOString().slice(0, 10)
    const upcoming = patientAppts
      .filter((a) => a.date >= today && (a.status === 'scheduled' || a.status === 'confirmed'))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]
    const message = upcoming
      ? buildAppointmentReminderMessage({
          patientName: patient.name,
          date: upcoming.date,
          time: upcoming.time,
          dentistName: upcoming.dentist_name,
          type: upcoming.type,
        })
      : buildGreetingMessage(patient.name)
    try {
      openWhatsApp(contact, message)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao abrir WhatsApp')
    }
  }

  const handleDelete = async () => {
    if (!patient) return
    if (!confirm(`Excluir paciente "${patient.name}"?`)) return
    try {
      await blink.db.table('patients').delete(patient.id)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast.success('Paciente excluido')
      navigate({ to: '/pacientes' })
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir')
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="p-4 md:p-6 text-center">
        <p className="text-muted-foreground">Paciente nao encontrado</p>
        <Link to="/pacientes" className="text-primary text-sm hover:underline mt-2 inline-block">
          Voltar para pacientes
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/pacientes' })}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-11 rounded-full bg-primary/10 text-primary shrink-0">
                <span className="text-sm font-bold">
                  {patient.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{patient.name}</h1>
                <div className="flex gap-2 mt-0.5"><StatusBadge map={PATIENT_STATUS} status={patient.status} /></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(patient.whatsapp || patient.phone) && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleWhatsApp}>
              <MessageCircle className="size-4" />
              WhatsApp
            </Button>
          )}
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive gap-2" onClick={handleDelete}>
            <Trash2 className="size-4" />
            Excluir
          </Button>
        </div>
      </div>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Informacoes</TabsTrigger>
          <TabsTrigger value="appointments">Consultas</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6 mt-4">
          {/* Contact info */}
          <div className="grid gap-4 sm:grid-cols-3">
            {patient.phone && (
              <Card className="border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0"><p className="text-xs text-muted-foreground">Telefone</p><p className="text-sm font-medium truncate">{patient.phone}</p></div>
                </CardContent>
              </Card>
            )}
            {patient.whatsapp && (
              <Card className="border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Phone className="size-4 text-green-500 shrink-0" />
                  <div className="min-w-0"><p className="text-xs text-muted-foreground">WhatsApp</p><p className="text-sm font-medium truncate">{patient.whatsapp}</p></div>
                </CardContent>
              </Card>
            )}
            {patient.email && (
              <Card className="border-border/60">
                <CardContent className="p-3 flex items-center gap-3">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0"><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium truncate">{patient.email}</p></div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Personal data */}
          <Card className="border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              {patient.cpf && <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</span></div>}
              {patient.rg && <div><span className="text-muted-foreground">RG:</span> <span className="font-medium">{patient.rg}</span></div>}
              {patient.birth_date && <div><span className="text-muted-foreground">Nascimento:</span> <span className="font-medium">{new Date(patient.birth_date + 'T00:00').toLocaleDateString('pt-BR')}</span></div>}
              {patient.sex && <div><span className="text-muted-foreground">Sexo:</span> <span className="font-medium">{patient.sex}</span></div>}
              {patient.marital_status && <div><span className="text-muted-foreground">Estado civil:</span> <span className="font-medium">{patient.marital_status}</span></div>}
              {patient.profession && <div><span className="text-muted-foreground">Profissao:</span> <span className="font-medium">{patient.profession}</span></div>}
            </CardContent>
          </Card>

          {/* Address */}
          {(patient.address || patient.city) && (
            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-base">Endereco</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                {patient.address && <div className="sm:col-span-2"><span className="text-muted-foreground">Endereco:</span> <span className="font-medium">{patient.address}</span></div>}
                {patient.city && <div><span className="text-muted-foreground">Cidade:</span> <span className="font-medium">{patient.city}</span></div>}
                {patient.state && <div><span className="text-muted-foreground">Estado:</span> <span className="font-medium">{patient.state}</span></div>}
                {patient.zip && <div><span className="text-muted-foreground">CEP:</span> <span className="font-medium">{patient.zip}</span></div>}
              </CardContent>
            </Card>
          )}

          {/* Additional info */}
          {(patient.insurance || patient.emergency_contact || patient.notes) && (
            <Card className="border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-base">Informacoes Adicionais</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                {patient.insurance && <div><span className="text-muted-foreground">Convenio:</span> <span className="font-medium">{patient.insurance}</span></div>}
                {patient.insurance_number && <div><span className="text-muted-foreground">Carteirinha:</span> <span className="font-medium">{patient.insurance_number}</span></div>}
                {patient.emergency_contact && <div><span className="text-muted-foreground">Emergencia:</span> <span className="font-medium">{patient.emergency_contact}</span></div>}
                {patient.financial_guardian && <div><span className="text-muted-foreground">Resp. financeiro:</span> <span className="font-medium">{patient.financial_guardian}</span></div>}
                {patient.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Observacoes:</span> <p className="font-medium mt-1">{patient.notes}</p></div>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          {patientAppts.length === 0 ? (
            <Card className="border-border/60 border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhuma consulta registrada</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {patientAppts.map((a) => (
                <Card key={a.id} className="border-border/60">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="text-center shrink-0 w-14">
                      <p className="text-xs text-muted-foreground">{new Date(a.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                      <p className="text-sm font-mono font-medium text-primary">{a.time}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.type}</p>
                      {a.dentist_name && <p className="text-xs text-muted-foreground">Dr(a). {a.dentist_name}</p>}
                    </div>
                    <StatusBadge map={APPOINTMENT_STATUS} status={a.status} />
                    <ChevronRight className="size-4 text-muted-foreground/30" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
