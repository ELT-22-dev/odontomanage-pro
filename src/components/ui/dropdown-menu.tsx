'use client'

import * as React from "react"
import { cn } from "@/lib/utils"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

function DropdownMenuTrigger({
  children,
  asChild,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger> & { asChild?: boolean }) {
  return (
    <DropdownMenuPrimitive.Trigger asChild={asChild} className={cn(className)} {...props}>
      {children}
    </DropdownMenuPrimitive.Trigger>
  )
}

function DropdownMenuContent({
  children,
  className,
  align = "end",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return (
    <DropdownMenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} />
  )
}

function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <DropdownMenuPrimitive.Label className={cn("px-2 py-1.5 text-sm font-semibold", className)}>
      {children}
    </DropdownMenuPrimitive.Label>
  )
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  return <DropdownMenuPrimitive.Root>{children}</DropdownMenuPrimitive.Root>
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
}
