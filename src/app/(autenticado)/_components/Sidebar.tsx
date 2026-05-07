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
      style={{ backgroundColor: '#1E3A5F' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-lg shrink-0">
          <BarChart3 className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">Sistema BI</p>
          <p className="text-white/50 text-xs truncate">Automação de Dados</p>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé: usuário + logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <div className="px-3 py-2">
          <p className="text-white/40 text-xs">Logado como</p>
          <p className="text-white text-sm font-medium truncate">{nomeUsuario}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sair
        </button>
      </div>
    </aside>
  )
}
