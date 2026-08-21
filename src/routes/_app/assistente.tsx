import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { blink, IS_DEMO_MODE } from '@/blink/client'
import { askAssistant, type ChatMessage } from '@/lib/ai'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Send, Loader2, Bot, User, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Patient { id: string; name: string; status: string }
interface Appointment {
  id: string; patient_name: string; date: string; time: string; type: string; status: string
}
interface Transaction {
  id: string; type: string; category: string; amount: string; status: string
  due_date: string | null; created_at: string
}
interface MedicalRecord { id: string }

export const Route = createFileRoute('/_app/assistente')({
  head: () => ({ meta: [{ title: 'Assistente IA · OdontoManage Pro' }] }),
  component: AssistentePage,
})

const SUGGESTIONS = [
  'Quantos pacientes ativos temos?',
  'Quais consultas estao agendadas para os proximos 7 dias?',
  'Como esta o financeiro deste mes?',
  'Existem pagamentos em atraso?',
]

/** Compact JSON snapshot of the clinic's current data, sent as context on every question. */
async function buildContext(): Promise<string> {
  const [patients, appointments, transactions, records] = await Promise.all([
    blink.db.table<Patient>('patients').list({ orderBy: { name: 'asc' } }),
    blink.db.table<Appointment>('appointments').list({ orderBy: { date: 'desc' } }),
    blink.db.table<Transaction>('transactions').list({ orderBy: { due_date: 'desc' } }),
    blink.db.table<MedicalRecord>('medical_records').list(),
  ])

  const now = new Date()
  const from = new Date(now.getTime() - 60 * 86400000)
  const to = new Date(now.getTime() + 30 * 86400000)
  const relevantAppointments = appointments
    .filter((a) => {
      const d = new Date(a.date)
      return d >= from && d <= to
    })
    .map((a) => ({ paciente: a.patient_name, data: a.date, hora: a.time, tipo: a.type, status: a.status }))

  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthTransactions = transactions
    .filter((t) => (t.due_date || t.created_at || '').startsWith(thisMonthKey))
    .map((t) => ({ tipo: t.type, categoria: t.category, valor: t.amount, status: t.status, vencimento: t.due_date }))

  return JSON.stringify({
    hoje: now.toISOString().slice(0, 10),
    total_pacientes: patients.length,
    pacientes_ativos: patients.filter((p) => p.status === 'active').length,
    consultas_ultimos_60_dias_e_proximos_30: relevantAppointments,
    transacoes_deste_mes: monthTransactions,
    total_registros_prontuario: records.length,
  })
}

function AssistentePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    data: context,
    isLoading: loadingContext,
    refetch: loadContext,
  } = useQuery({
    queryKey: ['ai-context'],
    queryFn: buildContext,
    staleTime: 0,
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = async (question: string) => {
    const q = question.trim()
    if (!q || sending) return
    if (IS_DEMO_MODE) {
      toast.error('Assistente de IA nao esta disponivel no modo demonstracao (depende de uma Edge Function paga com chave de API propria).')
      return
    }
    if (!context) {
      toast.error('Aguarde os dados da clinica carregarem')
      return
    }
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    try {
      const answer = await askAssistant(q, context, messages)
      setMessages([...nextMessages, { role: 'assistant', content: answer }])
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar o assistente')
      setMessages(messages)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Assistente IA
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pergunte sobre pacientes, agenda e financeiro. Nao substitui julgamento clinico.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => loadContext()}
          disabled={loadingContext}
        >
          {loadingContext ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Atualizar dados
        </Button>
      </div>

      <Card className="border-border/60 flex-1 min-h-0 flex flex-col">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary">
                  <Bot className="size-6" />
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Sou o assistente do OdontoManage Pro. Posso responder perguntas sobre os dados atuais
                  da clinica — pacientes, agenda e financeiro.
                </p>
                {IS_DEMO_MODE && (
                  <p className="text-xs text-primary max-w-sm">
                    Modo demonstracao — este recurso depende de uma chave de API paga e nao esta
                    ativo aqui.
                  </p>
                )}
                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex items-center justify-center size-7 rounded-full shrink-0',
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {m.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div
                  className={cn(
                    'rounded-lg px-3.5 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3">
                <div className="flex items-center justify-center size-7 rounded-full bg-muted text-muted-foreground shrink-0">
                  <Bot className="size-3.5" />
                </div>
                <div className="rounded-lg px-3.5 py-2.5 bg-muted flex items-center gap-2">
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 p-3 shrink-0 flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo sobre a clinica..."
              rows={1}
              className="min-h-10 max-h-32 resize-none"
              disabled={sending || loadingContext}
            />
            <Button
              size="icon"
              className="shrink-0"
              onClick={() => send(input)}
              disabled={sending || loadingContext || !input.trim()}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
