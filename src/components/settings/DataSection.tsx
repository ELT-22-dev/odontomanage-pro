'use client'

import { useRef, useState } from 'react'
import { CalendarClock, Database, Download, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { useIsAdmin } from '@/components/SessionProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { keys, useInvalidate, usePatients } from '@/hooks/queries'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { api, errorMessage } from '@/lib/api'
import { todayISO } from '@/lib/dates'
import { downloadCsv } from '@/lib/download'
import { createEvent } from '@/lib/googleCalendar'
import { detectColumnMapping, mapRowToPatient, parseCsv, PATIENT_FIELD_LABELS, type ParsedCsv, type PatientField } from '@/lib/patientImport'
import type { Appointment } from '@/lib/types'

export function IntegrationsSection() {
  const google = useGoogleCalendar()
  const invalidate = useInvalidate()
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    setBusy(true)
    try {
      await google.connect()
      toast.success('Google Calendar conectado! Novas consultas serao enviadas para sua agenda.')
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao conectar com o Google'))
    } finally {
      setBusy(false)
    }
  }

  const syncPending = async () => {
    setBusy(true)
    try {
      const upcoming = await api.get<Appointment[]>(`/api/appointments?from=${todayISO()}`)
      const pending = upcoming.filter((a) => !a.google_event_id && (a.status === 'scheduled' || a.status === 'confirmed'))
      let ok = 0
      for (const a of pending) {
        try {
          const eventId = await createEvent({
            patientName: a.patient_name,
            type: a.type,
            date: a.date,
            time: a.time,
            dentistName: a.dentist_name,
            room: a.room,
            notes: a.notes,
            durationMinutes: a.duration_minutes,
          })
          await api.patch(`/api/appointments/${a.id}`, { google_event_id: eventId })
          ok++
        } catch {
          // segue com as demais
        }
      }
      await invalidate(keys.appointments)
      toast.success(pending.length ? `${ok} de ${pending.length} consulta(s) enviadas ao Google Calendar` : 'Nenhuma consulta pendente de sincronizacao')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="size-4" /> Integracoes
        </CardTitle>
        <CardDescription>Envia as consultas agendadas para o seu Google Calendar (conexao por navegador, dura ~1h).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="text-xs text-muted-foreground">
              {!google.configured ? 'Nao configurado neste servidor (ver documentacao).' : google.connected ? 'Conectado neste navegador.' : 'Nao conectado.'}
            </p>
          </div>
          {google.configured &&
            (google.connected ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={syncPending} disabled={busy}>
                  {busy ? 'Sincronizando...' : 'Enviar consultas futuras'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={google.disconnect}>
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={connect} disabled={busy}>
                {busy ? 'Conectando...' : 'Conectar'}
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function DataSection() {
  const isAdmin = useIsAdmin()
  const invalidate = useInvalidate()
  const { data: patients = [] } = usePatients()
  const csvInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<Partial<Record<PatientField, string>>>({})
  const [importing, setImporting] = useState(false)

  const readCsv = async (file: File) => {
    try {
      const parsed = parseCsv(await file.text())
      if (parsed.rows.length === 0) return toast.error('Nenhuma linha encontrada no arquivo')
      if (parsed.rows.length > 5000) return toast.error(`O arquivo tem ${parsed.rows.length} linhas — o limite e 5000 por importacao. Divida em partes.`)
      const detected = detectColumnMapping(parsed.headers)
      if (!detected.name) return toast.error('Nao encontrei uma coluna com o nome do paciente (ex: "Nome")')
      setMapping(detected)
      setPreview(parsed)
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao ler o CSV'))
    }
  }

  const confirmImport = async () => {
    if (!preview) return
    setImporting(true)
    try {
      const rows = preview.rows.map((r) => mapRowToPatient(r, mapping)).filter((p) => p.name)
      const result = await api.post<{ inserted: number; skipped: number }>('/api/patients/import', { rows })
      await invalidate(keys.patients)
      toast.success(`${result.inserted} paciente(s) importado(s)${result.skipped ? `, ${result.skipped} ignorado(s) por CPF ja cadastrado` : ''}`)
      setPreview(null)
    } catch (err) {
      toast.error(errorMessage(err, 'Erro ao importar'))
    } finally {
      setImporting(false)
    }
  }

  const exportPatients = () =>
    downloadCsv(
      `pacientes-${todayISO()}.csv`,
      patients.map((p) => ({
        Nome: p.name, CPF: p.cpf ?? '', RG: p.rg ?? '', Nascimento: p.birth_date ?? '', Sexo: p.sex ?? '',
        Telefone: p.phone ?? '', WhatsApp: p.whatsapp ?? '', Email: p.email ?? '', Endereco: p.address ?? '',
        Cidade: p.city ?? '', UF: p.state ?? '', CEP: p.zip ?? '', Convenio: p.insurance ?? '',
        Carteirinha: p.insurance_number ?? '', Situacao: p.status === 'active' ? 'Ativo' : 'Inativo',
      })),
    )

  return (
    <Card className="border-border/60" id="importar">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="size-4" /> Dados
        </CardTitle>
        <CardDescription>
          Os dados ficam no banco de dados da clinica, com backup automatico do provedor. Aqui voce importa pacientes de outro sistema ou exporta copias.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Migrar pacientes de outro sistema (.csv)</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => csvInput.current?.click()}>
              <FileSpreadsheet className="size-4" /> Importar pacientes (CSV)
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={exportPatients} disabled={patients.length === 0}>
              <Download className="size-4" /> Exportar pacientes (CSV)
            </Button>
            <input
              ref={csvInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) readCsv(f)
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            No Excel/Google Planilhas: Arquivo → Salvar como/Fazer download → CSV. Colunas como &quot;Nome&quot;, &quot;CPF&quot;, &quot;Telefone&quot;, &quot;Email&quot;,
            &quot;Nascimento&quot; (DD/MM/AAAA) sao detectadas automaticamente. Pacientes com CPF ja cadastrado sao ignorados.
          </p>
        </div>

        {isAdmin && (
          <div className="pt-4 border-t border-border/60">
            <p className="text-xs font-medium text-muted-foreground mb-2">Copia completa (JSON) — pacientes, agenda, financeiro e prontuarios</p>
            <a href="/api/backup" download>
              <Button type="button" variant="outline" size="sm" className="gap-2">
                <Download className="size-4" /> Baixar backup completo
              </Button>
            </a>
            <p className="text-xs text-muted-foreground mt-2">Contem dados de saude: guarde o arquivo em local seguro. O download fica registrado na auditoria.</p>
          </div>
        )}
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar importacao de pacientes</DialogTitle>
            <DialogDescription>{preview ? `${preview.rows.length} linha(s) encontrada(s) no arquivo.` : ''}</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Colunas reconhecidas</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(mapping) as PatientField[]).map((field) => (
                    <span key={field} className="text-xs bg-muted rounded-full px-2.5 py-1">
                      {PATIENT_FIELD_LABELS[field]} <span className="text-muted-foreground">← {mapping[field]}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Previa</p>
                <div className="rounded-md border border-border/60 divide-y divide-border max-h-40 overflow-y-auto">
                  {preview.rows.slice(0, 5).map((row, i) => {
                    const p = mapRowToPatient(row, mapping)
                    return (
                      <div key={i} className="px-3 py-2 text-sm">
                        <span className="font-medium">{p.name || '(sem nome — sera ignorado)'}</span>
                        {p.phone && <span className="text-muted-foreground"> · {p.phone}</span>}
                        {p.email && <span className="text-muted-foreground"> · {p.email}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={importing}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmImport} disabled={importing}>
              {importing ? 'Importando...' : `Importar ${preview?.rows.length ?? 0} paciente(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
