'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  CalendarDays, ClipboardList, DollarSign, LayoutDashboard, LogOut, PanelLeft, Settings, Stethoscope, Users,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSession } from '@/components/SessionProvider'
import { useClinicName, useSettings } from '@/hooks/queries'
import { useLocalFlag } from '@/hooks/useLocalFlag'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const SIDEBAR_KEY = 'odonto_sidebar_collapsed'

interface NavItemDef {
  href: string
  icon: ReactNode
  label: string
}

const NAV_ITEMS: NavItemDef[] = [
  { href: '/', icon: <LayoutDashboard className="size-4" />, label: 'Dashboard' },
  { href: '/pacientes', icon: <Users className="size-4" />, label: 'Pacientes' },
  { href: '/agenda', icon: <CalendarDays className="size-4" />, label: 'Agenda' },
  { href: '/consultas', icon: <Stethoscope className="size-4" />, label: 'Consultas' },
  { href: '/financeiro', icon: <DollarSign className="size-4" />, label: 'Financeiro' },
  { href: '/prontuarios', icon: <ClipboardList className="size-4" />, label: 'Prontuarios' },
]

const BOTTOM_ITEMS: NavItemDef[] = [{ href: '/configuracoes', icon: <Settings className="size-4" />, label: 'Configuracoes' }]

export function AppSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const user = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const clinicName = useClinicName()
  const { data: settings } = useSettings()
  const [storedCollapsed, setCollapsed] = useLocalFlag(SIDEBAR_KEY)
  const collapsed = !mobile && storedCollapsed
  const toggle = () => setCollapsed(!storedCollapsed)

  const logout = async () => {
    await api.post('/api/auth/logout').catch(() => {})
    router.replace('/login')
    router.refresh()
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'))
  const initials = user.name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || 'U'
  const logo = settings?.logo_data_url

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden transition-[width] duration-200 ease-linear shrink-0',
        collapsed ? 'w-[3rem]' : 'w-[15rem]',
      )}
    >
      <div className={cn('flex items-center gap-2 shrink-0 border-b border-sidebar-border h-[52px] px-3', collapsed && 'justify-center px-2')}>
        {!collapsed && (
          <>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo em data URL, vem do banco
              <img src={logo} alt="" className="size-7 rounded-md object-cover shrink-0" />
            ) : (
              <div className="flex items-center justify-center size-7 rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold shrink-0">
                {clinicName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="flex-1 font-semibold text-sm truncate text-sidebar-foreground">{clinicName}</span>
          </>
        )}
        {!mobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                onClick={toggle}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              >
                <PanelLeft className={cn('size-4 transition-transform duration-200', collapsed && 'rotate-180')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Expandir menu' : 'Recolher menu'}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 pt-1 pb-1 text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-wider">Modulos</p>
        )}
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} onClick={onNavigate} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-2 py-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 pt-1 pb-1 text-[10px] font-medium text-sidebar-foreground/50 uppercase tracking-wider">Sistema</p>
        )}
        {BOTTOM_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} item={item} collapsed={collapsed} active={isActive(item.href)} onClick={onNavigate} />
        ))}
      </div>

      <div className={cn('shrink-0 border-t border-sidebar-border', collapsed ? 'flex flex-col items-center gap-1 p-2' : 'p-3 space-y-1')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center justify-center size-8">
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">{initials}</AvatarFallback>
                </Avatar>
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              {user.name} · {user.email}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2 w-full px-2 py-1.5">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium leading-tight truncate text-sidebar-foreground">{user.name}</p>
              <p className="text-[10px] text-sidebar-foreground/50 leading-tight truncate">
                {user.role === 'admin' ? 'Administrador' : 'Equipe'} · {user.email}
              </p>
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'text-sidebar-foreground/60 hover:text-sidebar-foreground',
            collapsed ? 'size-8 p-0' : 'w-full justify-start px-2 gap-2',
          )}
          onClick={logout}
          aria-label="Sair"
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && 'Sair'}
        </Button>
      </div>
    </div>
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
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm transition-colors cursor-pointer border',
        collapsed ? 'justify-center w-8 h-8 mx-auto' : 'px-3 py-2 w-full',
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium border-primary/50 glow-primary'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border-transparent',
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
