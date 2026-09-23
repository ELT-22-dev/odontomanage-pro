'use client'

import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAudit } from '@/hooks/queries'
import { formatDateTime } from '@/lib/dates'

const ACTIONS: Record<string, string> = {
  create: 'criou',
  update: 'alterou',
  delete: 'excluiu',
  import: 'importou',
  export: 'exportou',
  login: 'entrou no sistema',
  login_failed: 'tentativa de login falhou',
  logout: 'saiu do sistema',
  setup: 'configurou o sistema',
  change_password: 'trocou a propria senha',
  reset_password: 'redefiniu a senha de',
}

const ENTITIES: Record<string, string> = {
  patient: 'paciente',
  appointment: 'consulta',
  transaction: 'lancamento financeiro',
  medical_record: 'prontuario',
  user: 'usuario',
  profile: 'perfil',
  clinic_settings: 'dados da clinica',
  backup: 'backup completo',
}

function describe(details: Record<string, unknown> | null): string {
  if (!details) return ''
  const d = details as Record<string, string | number | undefined>
  return [d.name, d.patient, d.title, d.email, d.date && `${d.date} ${d.time ?? ''}`, d.status, d.amount && `R$ ${d.amount}`]
    .filter(Boolean)
    .join(' · ')
}

/** Trilha de auditoria (LGPD): ultimas acoes de todos os usuarios. Somente admin. */
export function AuditSection() {
  const { data = [], isFetching, refetch } = useAudit()
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4 flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="size-4" /> Auditoria
          </CardTitle>
          <CardDescription>Quem fez o que no sistema (ultimas 300 acoes).</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="p-0 border-t border-border/60 max-h-96 overflow-y-auto divide-y divide-border">
        {data.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground text-center">Nenhuma acao registrada ainda.</p>
        ) : (
          data.map((e) => (
            <div key={e.id} className="px-6 py-2.5 text-sm">
              <p>
                <span className="font-medium">{e.user_name ?? 'Anonimo'}</span> {ACTIONS[e.action] ?? e.action}{' '}
                {e.entity && <span className="text-muted-foreground">{ENTITIES[e.entity] ?? e.entity}</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(e.created_at)}
                {e.ip ? ` · IP ${e.ip}` : ''}
                {describe(e.details) ? ` · ${describe(e.details)}` : ''}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
