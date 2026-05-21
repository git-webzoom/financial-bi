'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

const titulos: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/vendas':        'Vendas',
  '/trafego':       'Tráfego',
  '/crm':           'CRM',
  '/webnario':      'Webinários',
  '/grupos':        'Grupos WhatsApp',
  '/configuracoes': 'Configurações',
}

interface HeaderProps {
  nomeUsuario: string
  onAbrirMenu: () => void
}

export default function Header({ nomeUsuario, onAbrirMenu }: HeaderProps) {
  const pathname = usePathname()

  const titulo =
    Object.entries(titulos).find(([key]) => pathname === key || pathname.startsWith(key + '/'))?.[1]
    ?? 'Financial BI'

  const iniciais = nomeUsuario
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header
      className="flex items-center justify-between px-4 md:px-8 py-4"
      style={{ backgroundColor: '#111111', borderBottom: '1px solid #1E1E1E' }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — só aparece no mobile */}
        <button
          className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          onClick={onAbrirMenu}
          style={{ color: '#888888' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
            ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#888888'
          }}
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: '#FFFFFF' }}>{titulo}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm hidden sm:block" style={{ color: '#888888' }}>{nomeUsuario}</span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: '#C9A84C', color: '#000000' }}
        >
          {iniciais}
        </div>
      </div>
    </header>
  )
}
