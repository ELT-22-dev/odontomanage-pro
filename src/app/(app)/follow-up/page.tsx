'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Plus, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { LoadError, Loading } from '@/components/EmptyState'
import { FollowupFormDialog } from '@/components/followup/FollowupFormDialog'
import { FollowupList } from '@/components/followup/FollowupList'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { keys, useFollowups, useInactivePatients, useInvalidate } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { api, errorMessage } from '@/lib/api'
import { addDays, formatDate, todayISO } from '@/lib/dates'
import { FOLLOWUP_KIND } from '@/lib/followup'
import { cn } from '@/lib/utils'
import type { FollowupKind } from '@/lib/types'

type View = 'today' | 'week' | 'pending' | 'done'

const VIEWS: { value: View; label: string }[] = [
  { value: 'today', label: 'Hoje e atrasados' },
  { value: 'week', label: 'Proximos 7 dias' },
  { value: 'pending', label: 'Todos pendentes' },
  { value: 'done', label: 'Concluidos' },
]

export default function FollowupPage() {
  const today = todayISO()
  const [view, setView] = useState<View>('today')
  const [kind, setKind] = useState<'all' | FollowupKind>('all')
  const [showInactive, setShowInactive] = useState(false)
  const form = useDialog<null>()
  const invalidate = useInvalidate()

  const filters =
    view === 'today'
      ? { status: 'pending' as const, to: today }
      : view === 'week'
        ? { status: 'pending' as const, to: addDays(today, 7) }
        : view === 'pending'
          ? { status: 'pending' as const }
          : { status: 'done' as const }
  const { data: followups = [], isLoading, error, refetch } = useFollowups(filters)
  const { data: inactive } = useInactivePatients(showInactive)

  const filtered = useMemo(() => (kind === 'all' ? followups : followups.filter((f) => f.kind === kind)), [followups, kind])
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: followups.length }
    for (const f of followups) c[f.kind] = (c[f.kind] || 0) + 1
    return c
  }, [followups])
  const overdue = followups.filter((f) => f.status === 'pending' && f.due_date < today).length

  const createReactivation = async (p: { id: string; last_visit: string; last_type: string }) => {
    try {
      await api.post('/api/followups', {
        patient_id: p.id,
        kind: 'reactivation',
        due_date: today,
        reason: `Sem consulta desde ${formatDate(p.last_visit)} (${p.last_type})`,
      })
      await invalidate(keys.followups)
      toast.success('Follow-up de reativacao criado para hoje')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Follow-up · OdontoManage Pro</title>
      <PageHeader
        title="Follow-up"
        subtitle={
          view === 'today'
            ? `${followups.length} contato(s) para fazer hoje${overdue ? ` · ${overdue} atrasado(s)` : ''}`
            : `${followups.length} follow-up(s)`
        }
        actions={
          <Button size="sm" className="gap-2" onClick={() => form.open()}>
            <Plus className="size-4" /> Novo follow-up
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setView(v.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border',
              view === v.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary/40',
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', ...(Object.keys(FOLLOWUP_KIND) as FollowupKind[])] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer',
              kind === k ? 'bg-primary/15 text-primary ring-1 ring-primary/40' : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {k === 'all' ? 'Todos' : FOLLOWUP_KIND[k].label} ({counts[k] || 0})
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={() => refetch()} />
      ) : (
        <FollowupList
          followups={filtered}
          emptyTitle={view === 'today' ? 'Nenhum contato pendente para hoje' : 'Nenhum follow-up aqui'}
          emptyHint={
            view === 'today'
              ? 'Follow-ups sao criados ao finalizar consultas (regras em Configuracoes), quando o paciente falta, ou manualmente.'
              : undefined
          }
        />
      )}

      <Card className="border-border/60">
        <CardHeader className={showInactive ? 'pb-3' : 'pb-0'}>
          <button type="button" className="flex items-center justify-between w-full cursor-pointer text-left" onClick={() => setShowInactive((s) => !s)}>
            <CardTitle className="text-base flex items-center gap-2">
              <UserMinus className="size-4" /> Pacientes sem visita
              {inactive && <span className="text-xs font-normal text-muted-foreground">(ha mais de {inactive.months} meses)</span>}
            </CardTitle>
            {showInactive ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        </CardHeader>
        {showInactive && (
          <CardContent className="p-0 border-t border-border/60">
            {!inactive ? (
              <Loading />
            ) : inactive.patients.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground text-center">Nenhum paciente sem visita nesse periodo.</p>
            ) : (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {inactive.patients.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-6 py-2.5">
                    <div className="flex-1 min-w-0">
                      <Link href={`/pacientes/${p.id}`} className="text-sm font-medium hover:text-primary hover:underline truncate block">
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Ultima consulta: {formatDate(p.last_visit)} · {p.last_type}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => createReactivation(p)}>
                      Criar follow-up
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <FollowupFormDialog key={form.key} open={form.isOpen} onOpenChange={form.setOpen} />
    </div>
  )
}
