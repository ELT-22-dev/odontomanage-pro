/**
 * Shared status → { label, className } maps for the premium dark/teal design
 * (see src/routes/_app/index.tsx dashboard, first page restyled). Centralized
 * here so every page's badges use the same palette instead of each page
 * inventing its own light-mode-first colors.
 */

export interface StatusStyle {
  label: string
  className: string
}

export const APPOINTMENT_STATUS: Record<string, StatusStyle> = {
  scheduled: { label: 'Agendada', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  in_progress: { label: 'Em atendimento', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  completed: { label: 'Finalizada', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelada', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  no_show: { label: 'Faltou', className: 'bg-muted text-muted-foreground border-border' },
}

export const PATIENT_STATUS: Record<string, StatusStyle> = {
  active: { label: 'Ativo', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  inactive: { label: 'Inativo', className: 'bg-muted text-muted-foreground border-border' },
}

export const TRANSACTION_STATUS: Record<string, StatusStyle> = {
  paid: { label: 'Pago', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  pending: { label: 'Pendente', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export const RECORD_TYPE_STATUS: Record<string, StatusStyle> = {
  note: { label: 'Evolucao', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  diagnosis: { label: 'Diagnostico', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  prescription: { label: 'Receita', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  treatment: { label: 'Tratamento', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
}
