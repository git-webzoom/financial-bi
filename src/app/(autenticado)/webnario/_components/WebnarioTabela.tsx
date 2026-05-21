'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PresencaWebn } from './WebnarioClient'

const PAGE_SIZE = 50

interface Props {
  presencas: PresencaWebn[]
  carregando: boolean
}

function formatarHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export default function WebnarioTabela({ presencas, carregando }: Props) {
  const [pagina, setPagina] = useState(0)

  useEffect(() => { setPagina(0) }, [presencas])

  const totalPaginas = Math.ceil(presencas.length / PAGE_SIZE)
  const inicio = pagina * PAGE_SIZE
  const fim = Math.min(inicio + PAGE_SIZE, presencas.length)
  const pagAtual = presencas.slice(inicio, fim)

  if (carregando) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded" style={{ backgroundColor: '#1A1A1A', opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    )
  }

  if (presencas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2">
        <p className="text-sm" style={{ color: '#555555' }}>Nenhum acesso registrado nesta semana</p>
        <p className="text-xs" style={{ color: '#333333' }}>Os dados aparecerão conforme o webhook da Hotwebnar enviar os acessos</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E1E' }}>
            {['Nome', 'Email', 'Entrada', 'Ficou até o Pitch', 'Comprou'].map(h => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#555555' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagAtual.map((p, idx) => (
            <tr
              key={p.id}
              style={{
                borderBottom: idx < pagAtual.length - 1 ? '1px solid #1A1A1A' : 'none',
                backgroundColor: 'transparent',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#161616'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <td className="px-4 py-3" style={{ color: '#FFFFFF' }}>
                {p.nome ?? <span style={{ color: '#444444' }}>—</span>}
              </td>
              <td className="px-4 py-3" style={{ color: '#888888' }}>{p.email}</td>
              <td className="px-4 py-3" style={{ color: '#888888' }}>
                {formatarHora(p.data_acesso)}
              </td>
              <td className="px-4 py-3">
                {p.viu_pitch ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: '#0F2A1A', color: '#4ADE80', border: '1px solid #4ADE8033' }}
                  >
                    Sim · {formatarHora(p.data_pitch)}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#444444' }}>Não</span>
                )}
              </td>
              <td className="px-4 py-3">
                {p.comprou ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: '#2A1A0A', color: '#C9A84C', border: '1px solid #C9A84C33' }}
                  >
                    Sim
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#444444' }}>Não</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPaginas > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid #1E1E1E' }}
        >
          <span className="text-xs" style={{ color: '#555555' }}>
            {inicio + 1} a {fim} de {presencas.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPagina(p => p - 1)}
              disabled={pagina === 0}
              className="p-2.5 rounded-lg disabled:opacity-30 transition-colors"
              style={{ color: '#888888' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPagina(p => p + 1)}
              disabled={pagina >= totalPaginas - 1}
              className="p-2.5 rounded-lg disabled:opacity-30 transition-colors"
              style={{ color: '#888888' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
