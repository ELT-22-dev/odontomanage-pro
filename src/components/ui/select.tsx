import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * <select> nativo com o mesmo visual do <Input>. Nativo de proposito: no
 * celular abre o seletor do sistema, que e o mais facil de usar.
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent dark:bg-input/30 px-3 py-1 text-base shadow-xs outline-none md:text-sm cursor-pointer',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-popover [&>option]:text-popover-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

export { Select }
