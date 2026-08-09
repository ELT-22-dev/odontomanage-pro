import { useState, useCallback } from 'react'
import { blink, type LocalUser } from '@/blink/client'
import { Link, useLocation } from '@tanstack/react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  DollarSign,
  ClipboardList,
  Settings,
  LogOut,
  PanelLeft,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useClinicBranding } from '@/hooks/useClinicBranding'

const SIDEBAR_KEY = 'odonto_sidebar'

interface NavItemDef {
  href: string
  icon: React.ReactNode
  label: string
}

const NAV_ITEMS: NavItemDef[] = [
  { href: '/', icon: <LayoutDashboard className="size-4" />, label: 'Dashboard' },
  { href: '/pacientes', icon: <Users className="size-4" />, label: 'Pacientes' },
  { href: '/agenda', icon: <CalendarDays className="size-4" />, label: 'Agenda' },
  { href: '/consultas', icon: <Stethoscope className="size-4" />, label: 'Consultas' },
  { href: '/financeiro', icon: <DollarSign className="size-4" />, label: 'Financeiro' },
  { href: '/prontuarios', icon: <ClipboardList className="size-4" />, label: 'Prontuarios' },
  { href: '/assistente', icon: <Sparkles className="size-4" />, label: 'Assistente IA' },
]

const BOTTOM_ITEMS: NavItemDef[] = [
  { href: '/configuracoes', icon: <Settings className="size-4" />, label: 'Configuracoes' },
]

interface AppSidebarProps {
  user: LocalUser | null
  onNavigate?: () => void
}

export function AppSidebar({ user, onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  })
  const location = useLocation()
  const { clinicName, logoDataUrl } = useClinicBranding()

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v
      localStorage.setItem(SIDEBAR_KEY, String(next))
      return next
    })
  }, [])

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Usuario'
  const email = user?.email || ''
  const initials = (displayName || 'U').slice(0, 2).toUpperCase()

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden',
          'transition-[width] duration-200 ease-linear shrink-0',
          collapsed ? 'w-[3rem]' : 'w-[15rem]'
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center gap-2 shrink-0 border-b border-sidebar-border h-[52px] px-3',
            collapsed && 'justify-center px-2'
          )}
        >
          {!collapsed && (
            <>
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="" className="size-7 rounded-md object-cover shrink-0" />
              ) : (
                <div className="flex items-center justify-center size-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shrink-0">
                  {clinicName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 font-semibold text-sm truncate text-sidebar-foreground">
                {clinicName}
              </span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onClick={toggle}
              >
                <PanelLeft
                  className={cn(
                    'size-4 transition-transform duration-200',
                    collapsed && 'rotate-180'
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expandir menu' : 'Recolher menu'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Nav items */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
          {!collapsed && (
            <p className="px-3 pt-1 pb-1 text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Modulos
            </p>
          )}
          {NAV_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={location.pathname === item.href}
              onClick={onNavigate}
            />
          ))}
        </div>

        {/* Bottom items */}
        <div className="shrink-0 border-t border-sidebar-border px-2 py-2 space-y-0.5">
          {!collapsed && (
            <p className="px-3 pt-1 pb-1 text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Sistema
            </p>
          )}
          {BOTTOM_ITEMS.map((item) => (
            <SidebarNavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={location.pathname === item.href}
              onClick={onNavigate}
            />
          ))}
        </div>

        {/* Footer — user + logout */}
        <div
          className={cn(
            'shrink-0 border-t border-sidebar-border',
            collapsed ? 'flex flex-col items-center gap-1 p-2' : 'p-3 space-y-1'
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center justify-center size-8 rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer">
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {displayName} · {email}
              </TooltipContent>
            </Tooltip>
          ) : (
            <button className="flex items-center gap-2 rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer w-full px-2 py-1.5">
              <Avatar className="size-6 shrink-0">
                <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium leading-tight truncate text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50 leading-tight truncate">
                  {email}
                </p>
              </div>
            </button>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                  onClick={() => blink.auth.logout()}
                >
                  <LogOut className="size-4 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground"
              onClick={() => blink.auth.logout()}
            >
              <LogOut className="size-4 shrink-0" />
              Sair
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

function SidebarNavItem({
  item,
  collapsed,
  active,
  onClick,
}: {
  item: NavItemDef
  collapsed: boolean
  active: boolean
  onClick?: () => void
}) {
  const link = (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm transition-colors cursor-pointer border',
        collapsed ? 'justify-center w-8 h-8 mx-auto' : 'px-3 py-2 w-full',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-primary/50 glow-primary'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-transparent'
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}
