'use client'

import { useState } from 'react'
import TpwClient from './_components/TpwClient'

type Aba = 'webnario' | 'tpw'

export default function DashboardPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('webnario')

  return (
    <div className="p-6 space-y-6">

      {/* Abas */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        {(['webnario', 'tpw'] as Aba[]).map((aba) => {
          const label = aba === 'webnario' ? 'Webnário' : 'TPW'
          const ativo = abaAtiva === aba
          return (
            <button
              key={aba}
              onClick={() => setAbaAtiva(aba)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: ativo ? '#C9A84C' : 'transparent',
                color: ativo ? '#0A0A0A' : '#888888',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo das abas */}
      {abaAtiva === 'webnario' && (
        <div
          className="rounded-xl flex flex-col items-center justify-center py-20 px-6 text-center"
          style={{ backgroundColor: '#111111', border: '1px dashed #222222' }}
        >
          <p className="text-sm" style={{ color: '#888888' }}>Conteúdo do Webnário em breve</p>
        </div>
      )}

      {abaAtiva === 'tpw' && <TpwClient />}

    </div>
  )
}
