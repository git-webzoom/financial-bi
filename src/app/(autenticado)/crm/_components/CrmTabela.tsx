'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatData } from '@/lib/format'
import type { InscritoCrm } from './CrmClient'

const PAGE_SIZE = 50

interface Props {
  inscritos: InscritoCrm[]
  carregando: boolean
  onSelecionar: (i: InscritoCrm) => void
}

function BadgeTemperatura({ temp }: { temp: string | null }) {
  if (!temp) return <span style={{ color: '#555555' }}>—</span>
  const map: Record<string, { bg: string; text: string }> = {
    'Quente': { bg: '#2A0F0F', text: '#DC2626' },
    'Morno':  { bg: '#2A1A0F', text: '#EA580C' },
    'Frio':   { bg: '#0F1A2A', text: '#2563EB' },
  }
  const cfg = map[temp] ?? { bg: '#1A1A1A', text: '#888888' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {temp}
    </span>
  )
}

export default function CrmTabela({ inscritos, carregando, onSelecionar }: Props) {
  const [pagina, setPagina] = useState(0)

  const totalPaginas = Math.ceil(inscritos.length / PAGE_SIZE)
  const inicio = pagina * PAGE_SIZE
  const fim = Math.min(inicio + PAGE_SIZE, inscritos.length)
  const pagAtual = inscritos.slice(inicio, fim)

  if (carregando) {
    return (
      <div className="p-8 flex items-center justify-center gap-2" style={{ color: '#555555' }}>
        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#333333', borderTopColor: '#C9A84C' }} />
        <span className="text-sm">Carregando inscritos…</span>
      </div>
    )
  }

  if (inscritos.length === 0) {
    return (
      <div className="p-10 text-center text-sm" style={{ color: '#555555' }}>
        Nenhum inscrito encontrado com os filtros aplicados.
      </div>
    )
  }

  return (
    <div>
      {/* Wrapper com scroll horizontal — essencial no mobile */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 820 }}>
          {/* Cabeçalho */}
          <div
            className="grid text-xs font-semibold uppercase tracking-wide px-5 py-2"
            style={{
              color: '#555555',
              borderBottom: '1px solid #1E1E1E',
              gridTemplateColumns: '2fr 2fr 1.2fr 1fr 1.5fr 0.8fr 0.6fr 1.2fr 0.8fr',
              gap: '0.5rem',
            }}
          >
            <span>Nome</span>
            <span>Email</span>
            <span>Cadastro</span>
            <span>Source</span>
            <span>Campaign</span>
            <span>Medium</span>
            <span>Comprou</span>
            <span>Outras Semanas</span>
            <span>Temp.</span>
          </div>

          {/* Linhas */}
          {pagAtual.map((i) => (
            <div
              key={i.id}
              className="grid px-5 py-3 cursor-pointer"
              style={{
                borderBottom: '1px solid #1E1E1E',
                gridTemplateColumns: '2fr 2fr 1.2fr 1fr 1.5fr 0.8fr 0.6fr 1.2fr 0.8fr',
                gap: '0.5rem',
                alignItems: 'center',
              }}
              onClick={() => onSelecionar(i)}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#141414'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <span className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{i.nome || '—'}</span>
              <span className="text-sm truncate" style={{ color: '#888888' }}>{i.email}</span>
              <span className="text-xs" style={{ color: '#888888' }}>{formatData(i.data_cadastro)}</span>
              <span className="text-xs truncate" style={{ color: '#888888' }}>{i.utm_source || '—'}</span>
              <span className="text-xs truncate" style={{ color: '#888888' }}>{i.utm_campaign || '—'}</span>
              <span className="text-xs truncate" style={{ color: '#888888' }}>{i.utm_medium || '—'}</span>
              <span>
                {i.comprou
                  ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>✓ Sim</span>
                  : <span style={{ color: '#555555' }}>—</span>
                }
              </span>
              <span className="flex flex-wrap gap-1">
                {i.outras_semanas.slice(0, 5).map(s => (
                  <span
                    key={s}
                    className="inline-block px-1.5 py-0.5 rounded text-xs"
                    style={{ backgroundColor: '#1A1A1A', color: '#888888' }}
                  >
                    {s}
                  </span>
                ))}
                {i.outras_semanas.length > 5 && (
                  <span className="text-xs" style={{ color: '#555555' }}>…</span>
                )}
              </span>
              <BadgeTemperatura temp={i.temperatura} />
            </div>
          ))}
        </div>
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid #1E1E1E' }}
        >
          <span className="text-xs" style={{ color: '#555555' }}>
            {inicio + 1} a {fim} de {inscritos.length}
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
