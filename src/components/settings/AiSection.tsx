'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useIsAdmin } from '@/components/SessionProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { keys, useAiStatus, useInvalidate } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'

/** Liga/desliga o assistente de IA (admin), com o aviso de LGPD. */
export function AiSection() {
  const isAdmin = useIsAdmin()
  const invalidate = useInvalidate()
  const { data: status } = useAiStatus()
  const [busy, setBusy] = useState(false)

  const toggle = async (enabled: boolean) => {
    setBusy(true)
    try {
      await api.put('/api/ai/status', { enabled })
      await invalidate(keys.ai)
      toast.success(enabled ? 'Assistente de IA ligado' : 'Assistente de IA desligado')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const label = !status ? '...' : !status.configured ? 'Nao configurado no servidor' : status.enabled ? 'Ligado' : 'Desligado'

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4" /> Inteligencia artificial
        </CardTitle>
        <CardDescription>
          Organiza anotacoes livres nos campos do prontuario e resume o historico do paciente antes do atendimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Assistente de IA (Claude)</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          {isAdmin && status?.configured && (
            <Button type="button" size="sm" variant={status.enabled ? 'outline' : 'default'} onClick={() => toggle(!status.enabled)} disabled={busy}>
              {status.enabled ? 'Desligar' : 'Ligar'}
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>
            <b>Privacidade (LGPD):</b> ao usar, o texto clinico e enviado a Anthropic (fornecedora da IA) para processamento. Nome, CPF,
            telefone, email e endereco do paciente <b>nao</b> sao enviados pelo resumo. Pela politica da Anthropic para a API comercial, esses dados nao sao usados para treinar modelos.
          </p>
          <p>A IA so sugere: nada e salvo sem revisao do profissional. Cada uso fica registrado na auditoria.</p>
          {isAdmin && !status?.configured && (
            <p>Para ativar, o responsavel tecnico precisa cadastrar a variavel ANTHROPIC_API_KEY no servidor (ver docs/INFRAESTRUTURA.md).</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
