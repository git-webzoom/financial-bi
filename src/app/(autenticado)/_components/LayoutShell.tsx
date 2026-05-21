'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface Props {
  children: React.ReactNode
  nomeUsuario: string
  isAdmin: boolean
}

export default function LayoutShell({ children, nomeUsuario, isAdmin }: Props) {
  const [sidebarAberta, setSidebarAberta] = useState(false)

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#0A0A0A' }}>
      {/* Overlay mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
          onClick={() => setSidebarAberta(false)}
        />
      )}

      <Sidebar
        nomeUsuario={nomeUsuario}
        isAdmin={isAdmin}
        aberta={sidebarAberta}
        onFechar={() => setSidebarAberta(false)}
      />

      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#0A0A0A' }}>
        <Header
          nomeUsuario={nomeUsuario}
          onAbrirMenu={() => setSidebarAberta(true)}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
