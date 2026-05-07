'use client'

import { usePathname } from 'next/navigation'

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
}

export default function Header({ nomeUsuario }: HeaderProps) {
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
      className="flex items-center justify-between px-8 py-4"
      style={{ backgroundColor: '#111111', borderBottom: '1px solid #1E1E1E' }}
    >
      <h1 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{titulo}</h1>
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
