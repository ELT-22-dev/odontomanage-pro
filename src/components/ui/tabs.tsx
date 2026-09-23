'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext<{ value: string; onValueChange: (v: string) => void } | null>(null)

function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string
  value?: string
  onValueChange?: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  const [internal, setInternal] = React.useState(defaultValue || "")
  const value = controlledValue ?? internal
  const setValue = onValueChange ?? setInternal
  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={cn(className)}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="tablist" className={cn("inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}>
      {children}
    </div>
  )
}

function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsTrigger must be used inside Tabs")
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md cursor-pointer px-3 py-1.5 text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        active ? "bg-background text-foreground shadow-sm dark:bg-primary/15 dark:text-primary" : "hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsContent must be used inside Tabs")
  if (ctx.value !== value) return null
  return <div role="tabpanel" className={cn(className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
