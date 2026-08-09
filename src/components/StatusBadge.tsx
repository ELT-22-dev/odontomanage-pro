import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { StatusStyle } from '@/lib/statusStyles'

/** Renders a status pill from one of the maps in src/lib/statusStyles.ts. */
export function StatusBadge({
  map,
  status,
  className,
}: {
  map: Record<string, StatusStyle>
  status: string
  className?: string
}) {
  const s = map[status] ?? { label: status, className: '' }
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', s.className, className)}>
      {s.label}
    </Badge>
  )
}
