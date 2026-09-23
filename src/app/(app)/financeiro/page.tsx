'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3, Calendar, ChartPie, Clock, DollarSign, Download, Filter, Layers, MoreHorizontal, Pencil, Plus, Search, Trash2, TrendingDown, TrendingUp,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { EmptyState, LoadError, Loading } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { PAYMENT_METHODS, TransactionDialog } from '@/components/TransactionDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { keys, useInvalidate, useTransactions } from '@/hooks/queries'
import { useDialog } from '@/hooks/useDialog'
import { api, errorMessage } from '@/lib/api'
import { formatDate, todayISO } from '@/lib/dates'
import { downloadCsv } from '@/lib/download'
import {
  computeTotals, effectiveDate, expensesByCategory, filterByPeriod, formatCurrency, monthlySeries, PERIOD_LABELS, type Period,
} from '@/lib/financeStats'
import { TRANSACTION_STATUS } from '@/lib/statusStyles'
import { cn } from '@/lib/utils'
import type { Transaction, TransactionStatus } from '@/lib/types'

const CHART_COLORS = [
  'oklch(0.52 0.14 190)', 'oklch(0.65 0.18 20)', 'oklch(0.75 0.12 80)', 'oklch(0.45 0.1 220)',
  'oklch(0.55 0.12 260)', 'oklch(0.6 0.15 160)', 'oklch(0.5 0.17 40)', 'oklch(0.4 0.13 280)',
]
const tooltipStyle = { borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-popover)', fontSize: 12 }

export default function FinanceiroPage() {
  const today = todayISO()
  const invalidate = useInvalidate()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all')
  const [period, setPeriod] = useState<Period>('this-month')
  const dialog = useDialog<Transaction>()

  const { data: transactions = [], isLoading, error, refetch } = useTransactions()
  const inRange = useMemo(() => filterByPeriod(transactions, period, today), [transactions, period, today])
  const totals = useMemo(() => computeTotals(inRange), [inRange])
  const monthly = useMemo(() => monthlySeries(transactions, today), [transactions, today])
  const pie = useMemo(() => expensesByCategory(inRange), [inRange])
  const overdue = useMemo(
    () => transactions.filter((t) => t.type === 'income' && t.status === 'pending' && t.due_date && t.due_date < today),
    [transactions, today],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inRange.filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (statusFilter === 'all' || t.status === statusFilter) &&
        (!q || (t.patient_name ?? '').toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
    )
  }, [inRange, search, typeFilter, statusFilter])

  const setStatus = async (t: Transaction, status: TransactionStatus) => {
    try {
      await api.patch(`/api/transactions/${t.id}`, { status })
      await invalidate(keys.transactions)
      toast.success(`Marcado como ${TRANSACTION_STATUS[status].label.toLowerCase()}`)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const remove = async (t: Transaction) => {
    if (!confirm(`Excluir o lancamento "${t.description || t.category}" de ${formatCurrency(t.amount)}?`)) return
    try {
      await api.del(`/api/transactions/${t.id}`)
      await invalidate(keys.transactions)
      toast.success('Lancamento excluido')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const exportCsv = () => {
    downloadCsv(
      `financeiro-${period}-${today}.csv`,
      filtered.map((t) => ({
        Data: formatDate(effectiveDate(t)),
        Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
        Categoria: t.category,
        Descricao: t.description ?? '',
        Paciente: t.patient_name ?? '',
        Valor: t.amount.toFixed(2).replace('.', ','),
        Situacao: TRANSACTION_STATUS[t.status]?.label ?? t.status,
        Pagamento: PAYMENT_METHODS[t.payment_method ?? ''] ?? t.payment_method ?? '',
        Vencimento: formatDate(t.due_date),
        'Pago em': formatDate(t.paid_date),
        Parcela: t.installments > 1 ? `${t.current_installment}/${t.installments}` : '',
      })),
    )
  }

  const kpis = [
    { label: 'Recebido', value: totals.income, icon: TrendingUp, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    { label: 'A receber', value: totals.pending, icon: Clock, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    { label: 'Despesas pagas', value: totals.expense, icon: TrendingDown, cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      <title>Financeiro · OdontoManage Pro</title>
      <PageHeader
        title="Financeiro"
        subtitle={`${inRange.length} lancamento${inRange.length !== 1 ? 's' : ''} em "${PERIOD_LABELS[period].toLowerCase()}"${totals.payable ? ` · ${formatCurrency(totals.payable)} a pagar` : ''}`}
        actions={
          <Button size="sm" className="gap-2" onClick={() => dialog.open()}>
            <Plus className="size-4" /> Novo lancamento
          </Button>
        }
      />

      {overdue.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {overdue.length} recebimento{overdue.length !== 1 ? 's' : ''} em atraso
          </span>{' '}
          <span className="text-muted-foreground">
            ({formatCurrency(overdue.reduce((s, t) => s + t.amount, 0))}). Filtre por &quot;Pendente&quot; na aba Lancamentos.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="size-4 text-muted-foreground shrink-0" />
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border',
              period === p
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary/40',
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <LoadError message={error.message} onRetry={() => refetch()} />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="size-4 mr-1.5" /> Visao geral
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <Layers className="size-4 mr-1.5" /> Lancamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-6">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {kpis.map((k) => (
                <Card key={k.label} className="border-border/60">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn('flex items-center justify-center size-10 rounded-lg shrink-0', k.cls)}>
                      <k.icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg md:text-xl font-bold text-foreground truncate">{formatCurrency(k.value)}</p>
                      <p className="text-xs text-muted-foreground">{k.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Card className={cn('border-border/60', totals.balance >= 0 && 'border-primary/50 glow-primary')}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('flex items-center justify-center size-10 rounded-lg shrink-0', totals.balance >= 0 ? 'bg-primary/10 text-primary' : 'bg-red-500/15 text-red-500')}>
                    <DollarSign className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-lg md:text-xl font-bold truncate', totals.balance >= 0 ? 'text-primary' : 'text-destructive')}>{formatCurrency(totals.balance)}</p>
                    <p className="text-xs text-muted-foreground">Saldo (recebido - pago)</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="size-4" /> Recebido x pago (ultimos 6 meses)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {monthly.every((m) => m.receitas === 0 && m.despesas === 0) ? (
                    <EmptyChart icon={BarChart3} text="Sem dados nos ultimos meses" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={monthly} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                        <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                        <RechartsTooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                        <Bar dataKey="receitas" name="Recebido" fill="oklch(0.6 0.14 165)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesas" name="Pago" fill="oklch(0.65 0.18 20)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ChartPie className="size-4" /> Despesas por categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pie.length === 0 ? (
                    <EmptyChart icon={ChartPie} text="Nenhuma despesa no periodo" />
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie data={pie} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name">
                          {pie.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
                        <Legend formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {(['all', 'income', 'expense'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                      typeFilter === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t === 'all' ? 'Todas' : t === 'income' ? 'Receitas' : 'Despesas'}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {(['all', 'paid', 'pending', 'cancelled'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                      statusFilter === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {s === 'all' ? 'Qualquer' : TRANSACTION_STATUS[s].label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-48 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button variant="outline" size="sm" className="gap-2 ml-auto" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="size-4" /> Exportar CSV
              </Button>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={search || typeFilter !== 'all' || statusFilter !== 'all' ? Filter : DollarSign}
                title={search || typeFilter !== 'all' || statusFilter !== 'all' ? 'Nenhum resultado' : 'Nenhum lancamento no periodo'}
                hint="Clique em Novo lancamento para registrar"
              />
            ) : (
              <Card className="border-border/60">
                <CardContent className="p-0 divide-y divide-border">
                  {filtered.map((t) => {
                    const late = t.status === 'pending' && t.due_date && t.due_date < today
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
                        <div
                          className={cn(
                            'flex items-center justify-center size-9 rounded-lg shrink-0',
                            t.type === 'income' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 text-red-600 dark:text-red-400',
                          )}
                        >
                          {t.type === 'income' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        </div>
                        <button type="button" onClick={() => dialog.open(t)} className="flex-1 min-w-0 text-left cursor-pointer">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{t.description || t.category}</p>
                            <StatusBadge map={TRANSACTION_STATUS} status={t.status} className="text-[10px] px-1.5 py-0" />
                            {late && <span className="text-[10px] font-medium text-red-500">atrasado</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                            <span>{formatDate(effectiveDate(t))}</span>
                            {t.patient_name && <span>{t.patient_name}</span>}
                            <span>{t.category}</span>
                            {t.payment_method && <span>{PAYMENT_METHODS[t.payment_method] ?? t.payment_method}</span>}
                            {t.installments > 1 && <span>Parcela {t.current_installment}/{t.installments}</span>}
                            {t.due_date && t.status !== 'paid' && <span>Venc. {formatDate(t.due_date)}</span>}
                          </div>
                        </button>
                        <p className={cn('text-sm font-semibold shrink-0', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                          {t.type === 'income' ? '+' : '-'}
                          {formatCurrency(t.amount)}
                        </p>
                        <div className="row-actions shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label="Acoes">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => dialog.open(t)}>
                                <Pencil className="size-3.5 mr-2" /> Editar
                              </DropdownMenuItem>
                              {t.status !== 'paid' && (
                                <DropdownMenuItem onClick={() => setStatus(t, 'paid')}>
                                  <TrendingUp className="size-3.5 mr-2 text-emerald-600" /> Marcar como pago
                                </DropdownMenuItem>
                              )}
                              {t.status !== 'pending' && (
                                <DropdownMenuItem onClick={() => setStatus(t, 'pending')}>
                                  <Clock className="size-3.5 mr-2 text-amber-600" /> Marcar como pendente
                                </DropdownMenuItem>
                              )}
                              {t.status !== 'cancelled' && (
                                <DropdownMenuItem onClick={() => setStatus(t, 'cancelled')}>
                                  <Filter className="size-3.5 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => remove(t)}>
                                <Trash2 className="size-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <TransactionDialog key={dialog.key} open={dialog.isOpen} onOpenChange={dialog.setOpen} transaction={dialog.item} />
    </div>
  )
}

function EmptyChart({ icon: Icon, text }: { icon: typeof BarChart3; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="size-10 text-muted-foreground/30 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
