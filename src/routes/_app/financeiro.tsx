import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { blink } from '@/blink/client'
import { useState, useMemo } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Plus,
  Search, Trash2, Filter, Clock, BarChart3, ChartPie,
  Calendar, CheckCircle, AlertCircle, XCircle, Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TRANSACTION_STATUS } from '@/lib/statusStyles'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  type Transaction, type Period, getPeriodRange, computeTotals, computeSummaryCounts,
} from '@/lib/financeStats'

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const CHART_COLORS = [
  'oklch(0.52 0.14 190)',  // chart-1 (teal)
  'oklch(0.65 0.18 20)',   // chart-2 (coral)
  'oklch(0.75 0.12 80)',   // chart-3 (warm)
  'oklch(0.45 0.1 220)',   // chart-4 (blue)
  'oklch(0.55 0.12 260)',  // chart-5 (indigo)
  'oklch(0.6 0.15 160)',
  'oklch(0.5 0.17 40)',
  'oklch(0.4 0.13 280)',
]

const STATUS_ICON: Record<string, typeof CheckCircle> = {
  paid: CheckCircle, pending: AlertCircle, cancelled: XCircle,
}

const NEXT_STATUS: Record<string, string> = {
  paid: 'pending', pending: 'cancelled', cancelled: 'paid',
}

const PERIOD_LABELS: Record<Period, string> = {
  'this-month': 'Este mês',
  'last-month': 'Mês passado',
  'last-3-months': 'Últimos 3 meses',
  'this-year': 'Este ano',
  'all': 'Tudo',
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/* ═══════════════════════════════════════════════════════════════════════════
   Route
   ═══════════════════════════════════════════════════════════════════════════ */

export const Route = createFileRoute('/_app/financeiro')({
  head: () => ({ meta: [{ title: 'Financeiro · OdontoManage Pro' }] }),
  component: FinanceiroPage,
})

/* ═══════════════════════════════════════════════════════════════════════════
   Page component
   ═══════════════════════════════════════════════════════════════════════════ */

function FinanceiroPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [period, setPeriod] = useState<Period>('this-month')
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState({
    patient_name: '', type: 'income', category: 'Consulta', description: '',
    amount: '', payment_method: 'dinheiro', due_date: '',
  })

  /* ── data ── */

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => blink.db.table<Transaction>('transactions').list(),
  })

  /* ── date-range filter ── */

  const range = useMemo(() => getPeriodRange(period), [period])

  const inRange = useMemo(() => {
    if (!range) return transactions
    return transactions.filter((t) => {
      const d = new Date(t.created_at)
      return !isNaN(d.getTime()) && d >= range.start && d <= range.end
    })
  }, [transactions, range])

  /* ── text + type filters ── */

  const filtered = useMemo(() => {
    let list = inRange
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((t) =>
        (t.patient_name && t.patient_name.toLowerCase().includes(s)) ||
        (t.description && t.description.toLowerCase().includes(s)) ||
        t.category.toLowerCase().includes(s)
      )
    }
    if (typeFilter !== 'all') list = list.filter((t) => t.type === typeFilter)
    return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [inRange, search, typeFilter])

  /* ── KPI totals (from in-range, not all) ── */

  const totals = useMemo(() => computeTotals(inRange), [inRange])

  /* ── summary counts ── */

  const summaryCounts = useMemo(() => computeSummaryCounts(inRange), [inRange])

  /* ── chart data: monthly revenue vs expenses (last 6 months) ── */

  const monthlyChartData = useMemo(() => {
    const now = new Date()
    const months: { month: string; receitas: number; despesas: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        month: MONTH_NAMES[d.getMonth()],
        receitas: 0,
        despesas: 0,
      })
    }
    for (const t of transactions) {
      const d = new Date(t.created_at)
      if (isNaN(d.getTime())) continue
      const idx = months.findIndex((m) => m.month === MONTH_NAMES[d.getMonth()])
      if (idx === -1) continue
      const amt = Number(t.amount) || 0
      if (t.type === 'income' && t.status === 'paid') months[idx].receitas += amt
      else if (t.type === 'expense') months[idx].despesas += amt
    }
    return months
  }, [transactions])

  /* ── chart data: expenses by category ── */

  const expensePieData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const t of inRange) {
      if (t.type !== 'expense') continue
      const cat = t.category || 'Outros'
      map[cat] = (map[cat] || 0) + (Number(t.amount) || 0)
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [inRange])

  /* ── CRUD ── */

  const handleNew = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Valor obrigatório')
      return
    }
    try {
      await blink.db.table('transactions').create({
        ...form,
        amount: form.amount,
        status: 'paid',
        user_id: 'user',
      } as any)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setNewOpen(false)
      setForm({ patient_name: '', type: 'income', category: 'Consulta', description: '', amount: '', payment_method: 'dinheiro', due_date: '' })
      toast.success('Transação registrada')
    } catch (err: any) { toast.error(err?.message || 'Erro') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta transação?')) return
    try {
      await blink.db.table('transactions').delete(id)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success('Transação excluída')
    } catch (err: any) { toast.error(err?.message || 'Erro') }
  }

  const handleStatusChange = async (id: string, currentStatus: string) => {
    const next = NEXT_STATUS[currentStatus] || 'paid'
    try {
      await blink.db.table('transactions').update(id, { status: next } as any)
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      toast.success(`Status: ${TRANSACTION_STATUS[next]?.label ?? next}`)
    } catch (err: any) { toast.error(err?.message || 'Erro') }
  }

  /* ── formatters ── */

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  /* ═══════════════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {summaryCounts.total} transação{summaryCounts.total !== 1 ? 'ões' : ''} ·{' '}
            {summaryCounts.incomeCount} receita{summaryCounts.incomeCount !== 1 ? 's' : ''} ·{' '}
            {summaryCounts.expenseCount} despesa{summaryCounts.expenseCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" /> Nova Transação
        </Button>
      </div>

      {/* ── Period filter pills (shared) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="size-4 text-muted-foreground shrink-0" />
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer border',
              period === p
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ── Tabs: Visão Geral | Transações ── */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">
            <BarChart3 className="size-4 mr-1.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <Layers className="size-4 mr-1.5" /> Transações
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════════ VISÃO GERAL ═════════════════════════ */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/60">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center size-10 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(totals.income)}</p>
                  <p className="text-xs text-muted-foreground">Recebido</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center size-10 rounded-lg bg-amber-500/15 text-amber-400 shrink-0">
                  <Clock className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(totals.pending)}</p>
                  <p className="text-xs text-muted-foreground">Pendente</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center justify-center size-10 rounded-lg bg-red-500/15 text-red-400 shrink-0">
                  <TrendingDown className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(totals.expense)}</p>
                  <p className="text-xs text-muted-foreground">Despesas</p>
                </div>
              </CardContent>
            </Card>
            <Card className={cn('border-border/60', totals.balance >= 0 && 'border-primary/50 glow-primary')}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn(
                  'flex items-center justify-center size-10 rounded-lg shrink-0',
                  totals.balance >= 0
                    ? 'bg-primary/10 text-primary'
                    : 'bg-red-500/15 text-red-400'
                )}>
                  <DollarSign className="size-5" />
                </div>
                <div>
                  <p className={cn('text-xl font-bold', totals.balance >= 0 ? 'text-primary' : 'text-destructive')}>
                    {formatCurrency(totals.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">Saldo</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly bar chart */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="size-4" /> Receitas vs Despesas (últimos 6 meses)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyChartData.every((m) => m.receitas === 0 && m.despesas === 0) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BarChart3 className="size-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Sem dados no período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyChartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                      <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-popover)' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="receitas" name="Receitas" fill="oklch(0.52 0.14 190)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="despesas" name="Despesas" fill="oklch(0.65 0.18 20)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Expense pie chart */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ChartPie className="size-4" /> Despesas por Categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expensePieData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ChartPie className="size-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhuma despesa no período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                      >
                        {expensePieData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-popover)' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary counts */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Receitas:</span>
                  <span className="font-semibold text-foreground">{summaryCounts.incomeCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Despesas:</span>
                  <span className="font-semibold text-foreground">{summaryCounts.expenseCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-primary" />
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-semibold text-foreground">{summaryCounts.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════ TRANSAÇÕES ═══════════════════════ */}
        <TabsContent value="transactions" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {(['all', 'income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                    typeFilter === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'all' ? 'Todas' : t === 'income' ? 'Receitas' : 'Despesas'}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Transaction list */}
          {filtered.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                {search || typeFilter !== 'all' ? (
                  <>
                    <Filter className="size-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhum resultado</p>
                    <p className="text-xs text-muted-foreground mt-1">Tente outros filtros ou termos de busca</p>
                  </>
                ) : (
                  <>
                    <DollarSign className="size-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma transação no período</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique em Nova Transação para começar</p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60">
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {filtered.map((t) => {
                    const statusCfg = TRANSACTION_STATUS[t.status] ?? TRANSACTION_STATUS.pending
                    const StatusIcon = STATUS_ICON[t.status] ?? STATUS_ICON.pending
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
                        <div className={cn(
                          'flex items-center justify-center size-9 rounded-lg shrink-0',
                          t.type === 'income'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                        )}>
                          {t.type === 'income' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">
                              {t.patient_name || t.description || t.category}
                            </p>
                            {/* Status badge — click to cycle */}
                            <button
                              onClick={() => handleStatusChange(t.id, t.status)}
                              className="cursor-pointer shrink-0"
                              title="Clique para alterar status"
                            >
                              <Badge variant="outline" className={cn('gap-1 text-[10px] px-1.5 py-0 font-medium', statusCfg.className)}>
                                <StatusIcon className="size-2.5" />
                                {statusCfg.label}
                              </Badge>
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                            <span>{t.category}</span>
                            {t.payment_method && <span className="capitalize">{t.payment_method}</span>}
                            {t.due_date && <span>Venc: {new Date(t.due_date + 'T00:00').toLocaleDateString('pt-BR')}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn(
                            'text-sm font-semibold',
                            t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                          )}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(Number(t.amount))}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(t.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── New transaction dialog ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Transação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {(['income', 'expense'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={cn(
                    'flex-1 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                    form.type === t
                      ? t === 'income'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {t === 'income' ? 'Receita' : 'Despesa'}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Pagamento</Label>
                <Input value={form.payment_method} onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrição da transação" />
            </div>
            <div className="space-y-1.5">
              <Label>Paciente (opcional)</Label>
              <Input value={form.patient_name} onChange={(e) => setForm((f) => ({ ...f, patient_name: e.target.value }))} placeholder="Nome do paciente" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleNew}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
