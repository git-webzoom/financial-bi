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
    ?? 'Sistema BI'

  const iniciais = nomeUsuario
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
      <h1 className="text-xl font-semibold text-gray-800">{titulo}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 hidden sm:block">{nomeUsuario}</span>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ backgroundColor: '#1E3A5F' }}
        >
          {iniciais}
        </div>
      </div>
    </header>
  )
}
