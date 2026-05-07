'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  ShoppingCart,
  TrendingUp,
  Users,
  Video,
  MessageCircle,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { label: 'Dashboard',  href: '/dashboard', icon: BarChart3 },
  { label: 'Vendas',     href: '/vendas',    icon: ShoppingCart },
  { label: 'Tráfego',   href: '/trafego',   icon: TrendingUp },
  { label: 'CRM',       href: '/crm',       icon: Users },
  { label: 'Webinários',href: '/webnario',  icon: Video },
  { label: 'Grupos',    href: '/grupos',    icon: MessageCircle },
]

interface SidebarProps {
  nomeUsuario: string
  isAdmin: boolean
}

export default function Sidebar({ nomeUsuario, isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = isAdmin
    ? [...navItems, { label: 'Configurações', href: '/configuracoes', icon: Settings }]
    : navItems

  return (
    <aside
      className="w-60 shrink-0 flex flex-col"
      style={{ backgroundColor: '#0A0A0A', borderRight: '1px solid #1E1E1E' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid #1E1E1E' }}>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{ backgroundColor: '#1A1A1A', border: '1px solid #C9A84C33' }}
        >
          <BarChart3 className="w-4 h-4" style={{ color: '#C9A84C' }} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight truncate">
            <span style={{ color: '#FFFFFF' }}>Financial </span>
            <span style={{ color: '#C9A84C' }}>BI</span>
          </p>
          <p className="text-xs truncate" style={{ color: '#888888' }}>Automação de Dados</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={active
                ? {
                    backgroundColor: '#1A1A1A',
                    color: '#FFFFFF',
                    borderLeft: '3px solid #C9A84C',
                    paddingLeft: '9px',
                  }
                : {
                    color: '#888888',
                    borderLeft: '3px solid transparent',
                    paddingLeft: '9px',
                  }
              }
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#141414'
                  ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#888888'
                }
              }}
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? '#C9A84C' : '#888888' }}
              />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé: usuário + logout */}
      <div className="px-3 py-4 space-y-1" style={{ borderTop: '1px solid #1E1E1E' }}>
        <div className="px-3 py-2">
          <p className="text-xs" style={{ color: '#555555' }}>Logado como</p>
          <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{nomeUsuario}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#888888' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#141414'
            ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#888888'
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}
