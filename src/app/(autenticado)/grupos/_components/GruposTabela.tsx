'use client'

import type { SendflowGrupo } from '../page'

interface Props {
  grupos: SendflowGrupo[]
  carregando: boolean
}

export default function GruposTabela({ grupos, carregando }: Props) {
  if (carregando) {
    return (
      <div className="p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded" style={{ backgroundColor: '#1A1A1A', opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    )
  }

  if (grupos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-2">
        <p className="text-sm" style={{ color: '#555555' }}>Nenhum grupo nesta campanha</p>
        <p className="text-xs" style={{ color: '#333333' }}>Execute um Sync Grupos em Configurações → Sendflow</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid #1E1E1E' }}>
            {['Nome do Grupo', 'Nº', 'Membros', 'Link de Convite', 'Status'].map(h => (
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
          {grupos.map((g, idx) => (
            <tr
              key={g.id}
              style={{
                borderBottom: idx < grupos.length - 1 ? '1px solid #1A1A1A' : 'none',
                backgroundColor: 'transparent',
                transition: 'background-color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#161616'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <td className="px-4 py-3 font-medium" style={{ color: '#FFFFFF' }}>{g.nome}</td>
              <td className="px-4 py-3 text-xs font-mono" style={{ color: '#555555' }}>
                {g.count > 0 ? `#${g.count}` : '—'}
              </td>
              <td className="px-4 py-3" style={{ color: '#888888' }}>
                {g.total_membros.toLocaleString('pt-BR')}
                {g.grupo_cheio && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#2A1A0A', color: '#FB923C' }}>
                    Cheio
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                {g.link ? (
                  <a
                    href={g.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ backgroundColor: '#0F2A1A', color: '#4ADE80', border: '1px solid #4ADE8033' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#163D24'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#0F2A1A'}
                  >
                    Abrir link →
                  </a>
                ) : (
                  <span style={{ color: '#333333' }}>—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {g.ativo ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: '#0F2A1A', color: '#4ADE80', border: '1px solid #4ADE8033' }}
                  >
                    Ativo
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: '#555555' }}>Inativo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
