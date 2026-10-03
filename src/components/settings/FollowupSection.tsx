'use client'

import { useState } from 'react'
import { BellRing, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useIsAdmin } from '@/components/SessionProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { keys, useFollowupRules, useFollowupSettings, useInvalidate } from '@/hooks/queries'
import { api, errorMessage } from '@/lib/api'
import { DEFAULT_TEMPLATES, FOLLOWUP_KIND } from '@/lib/followup'
import { cn } from '@/lib/utils'
import type { FollowupKind, FollowupRule, FollowupSettings } from '@/lib/types'

const RULE_KINDS: FollowupRule['kind'][] = ['post_procedure', 'recall', 'quote']
const TEMPLATE_KINDS: FollowupKind[] = ['post_procedure', 'recall', 'quote', 'reactivation', 'other']

/**
 * Configuracao do follow-up: regras automaticas, textos das mensagens e
 * quando considerar um paciente "sumido". Todos veem; so admin altera.
 */
export function FollowupSection() {
  const isAdmin = useIsAdmin()
  const { data: rules = [] } = useFollowupRules()
  const { data: settings } = useFollowupSettings()
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <BellRing className="size-4" /> Follow-up
        </CardTitle>
        <CardDescription>
          Ao <b>finalizar</b> uma consulta cujo procedimento contem o texto da regra, o sistema cria o follow-up para daqui a N dias.
          Paciente que falta ganha um follow-up de reagendamento na hora.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RulesEditor rules={rules} canEdit={isAdmin} />
        {settings && <SettingsEditor key={JSON.stringify(settings)} settings={settings} canEdit={isAdmin} />}
      </CardContent>
    </Card>
  )
}

function RulesEditor({ rules, canEdit }: { rules: FollowupRule[]; canEdit: boolean }) {
  const invalidate = useInvalidate()
  const [draft, setDraft] = useState({ appointment_type: '', kind: 'post_procedure' as FollowupRule['kind'], days_after: '7', reason: '' })

  const call = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      await invalidate(keys.followupRules)
      toast.success(msg)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const add = () =>
    call(async () => {
      await api.post('/api/followup-rules', { ...draft, days_after: Number(draft.days_after) })
      setDraft({ appointment_type: '', kind: 'post_procedure', days_after: '7', reason: '' })
    }, 'Regra criada')

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Regras automaticas</p>
      <div className="rounded-lg border border-border/60 divide-y divide-border">
        {rules.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Nenhuma regra.</p>}
        {rules.map((r) => (
          <div key={r.id} className={cn('flex items-center gap-3 px-3 py-2 text-sm', !r.active && 'opacity-50')}>
            <div className="flex-1 min-w-0">
              <p className="truncate">
                <span className="font-medium">&quot;{r.appointment_type}&quot;</span> → {FOLLOWUP_KIND[r.kind].label} em <b>{r.days_after}</b> dia(s)
              </p>
              <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
            </div>
            {canEdit && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => call(() => api.patch(`/api/followup-rules/${r.id}`, { active: !r.active }), r.active ? 'Regra pausada' : 'Regra ativada')}
                >
                  {r.active ? 'Pausar' : 'Ativar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:text-destructive"
                  aria-label="Excluir regra"
                  onClick={() => confirm('Excluir esta regra? Follow-ups ja criados continuam.') && call(() => api.del(`/api/followup-rules/${r.id}`), 'Regra excluida')}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-[1fr_9rem_5rem] items-end rounded-lg border border-dashed border-border/60 p-3">
          <div className="space-y-1">
            <Label htmlFor="rule-type" className="text-xs">Procedimento contem</Label>
            <Input id="rule-type" className="h-8" placeholder="ex: implante" value={draft.appointment_type} onChange={(e) => setDraft((d) => ({ ...d, appointment_type: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-kind" className="text-xs">Tipo</Label>
            <Select id="rule-kind" className="h-8" value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as FollowupRule['kind'] }))}>
              {RULE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FOLLOWUP_KIND[k].label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-days" className="text-xs">Dias</Label>
            <Input id="rule-days" className="h-8" type="number" min={0} max={1095} value={draft.days_after} onChange={(e) => setDraft((d) => ({ ...d, days_after: e.target.value }))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="rule-reason" className="text-xs">Motivo (aparece na fila)</Label>
            <Input id="rule-reason" className="h-8" placeholder="ex: Pos-implante: revisao de 30 dias" value={draft.reason} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value }))} />
          </div>
          <Button type="button" size="sm" className="h-8 gap-1" onClick={add} disabled={!draft.appointment_type.trim() || !draft.reason.trim()}>
            <Plus className="size-3.5" /> Regra
          </Button>
        </div>
      )}
    </div>
  )
}

function SettingsEditor({ settings, canEdit }: { settings: FollowupSettings; canEdit: boolean }) {
  const invalidate = useInvalidate()
  const [months, setMonths] = useState(String(settings.inactive_months))
  const [templates, setTemplates] = useState<Record<FollowupKind, string>>(() =>
    Object.fromEntries(TEMPLATE_KINDS.map((k) => [k, settings.templates[k] || DEFAULT_TEMPLATES[k]])) as Record<FollowupKind, string>,
  )
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      // So guarda o que difere do padrao (atualizacoes futuras do texto padrao continuam valendo).
      const custom = Object.fromEntries(TEMPLATE_KINDS.filter((k) => templates[k].trim() !== DEFAULT_TEMPLATES[k]).map((k) => [k, templates[k].trim()]))
      await api.put('/api/followup-settings', { templates: custom, inactive_months: Number(months) })
      await invalidate(keys.followupSettings, keys.followups)
      toast.success('Configuracoes de follow-up salvas')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Considerar &quot;sem visita&quot; o paciente sem consulta ha</span>
        <Input type="number" min={1} max={60} className="w-20 h-8" value={months} onChange={(e) => setMonths(e.target.value)} disabled={!canEdit} />
        <span>meses.</span>
      </div>
      <p className="text-xs font-medium text-muted-foreground">
        Mensagens-modelo (variaveis: {'{nome}'}, {'{clinica}'}, {'{motivo}'}, {'{data}'})
      </p>
      {TEMPLATE_KINDS.map((k) => (
        <div key={k} className="space-y-1">
          <div className="flex items-center justify-between">
            <Label htmlFor={`tpl-${k}`} className="text-xs">{FOLLOWUP_KIND[k].label}</Label>
            {canEdit && templates[k] !== DEFAULT_TEMPLATES[k] && (
              <button type="button" className="text-[11px] text-primary hover:underline cursor-pointer" onClick={() => setTemplates((t) => ({ ...t, [k]: DEFAULT_TEMPLATES[k] }))}>
                restaurar padrao
              </button>
            )}
          </div>
          <Textarea id={`tpl-${k}`} rows={2} value={templates[k]} disabled={!canEdit} onChange={(e) => setTemplates((t) => ({ ...t, [k]: e.target.value }))} />
        </div>
      ))}
      {canEdit && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={save} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar mensagens'}
          </Button>
        </div>
      )}
    </div>
  )
}
