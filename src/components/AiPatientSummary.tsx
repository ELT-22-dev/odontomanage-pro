'use client'

import { useState } from 'react'
import { AlertTriangle, ListChecks, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAiEnabled } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import type { AiPatientSummary as Summary } from '@/lib/types'

/**
 * Resumo do historico do paciente gerado pela IA, sob demanda (botao).
 * Nao e salvo em lugar nenhum: fica so na tela, para leitura rapida antes
 * do atendimento. Some quando a IA esta desligada.
 */
export function AiPatientSummary({ patientId }: { patientId: string }) {
  const enabled = useAiEnabled()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  if (!enabled) return null

  const generate = async () => {
    setLoading(true)
    try {
      setSummary(await api.post<Summary>('/api/ai/patient-summary', { patient_id: patientId }))
    } catch (err) {
      toast.error(errorMessage(err, 'Nao foi possivel gerar o resumo'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Resumo do historico (IA)
          </p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={generate} disabled={loading}>
            <Sparkles className="size-3.5" /> {loading ? 'Gerando...' : summary ? 'Gerar de novo' : 'Gerar resumo'}
          </Button>
        </div>
        {!summary && !loading && (
          <p className="text-xs text-muted-foreground">Resume prontuarios e consultas para leitura rapida antes do atendimento.</p>
        )}
        {loading && <p className="text-xs text-muted-foreground animate-pulse">Lendo o historico do paciente...</p>}
        {summary && (
          <div className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap">{summary.summary}</p>
            {summary.alerts.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="size-3.5" /> Alertas
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {summary.alerts.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.pending.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                  <ListChecks className="size-3.5" /> Em andamento / pendente
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {summary.pending.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.last_visit && <p className="text-xs text-muted-foreground">Ultima visita: {summary.last_visit}</p>}
            <p className="text-[11px] text-muted-foreground">Gerado por IA a partir dos registros — pode conter erros. Confira no prontuario.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
