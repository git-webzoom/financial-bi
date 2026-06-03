'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMoeda } from '@/lib/format'
import VendaDrawer from '@/app/(autenticado)/vendas/_components/VendaDrawer'
import type { Venda } from '@/app/(autenticado)/vendas/_components/VendasClient'

// Tabela de vendas simplificada para as abas do dashboard. Recebe a lista de COMPRAS já agregada
// (1 linha por compra, mesma fonte/filtro dos KPIs da aba) e mostra nome, email, oferta e valor,
// 10 por página. Clicar abre o VendaDrawer (reusado da /vendas). Tabela no desktop, cards no mobile.

const PAGE_SIZE = 10

interface Props {
  vendas: Venda[]
  carregando: boolean
  titulo?: string
}

export default function TabelaVendasMini({ vendas, carregando, titulo = 'Vendas' }: Props) {
  const [pagina, setPagina] = useState(0)
  const [sel, setSel] = useState<Venda | null>(null)

  const totalPaginas = Math.ceil(vendas.length / PAGE_SIZE)
  const inicio = pagina * PAGE_SIZE
  const fim = Math.min(inicio + PAGE_SIZE, vendas.length)
  const pag = vendas.slice(inicio, fim)

  const valorDe = (v: Venda) => formatMoeda(v.valor_total_grupo ?? v.valor_venda ?? 0, v.moeda)

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
        <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{titulo}</p>
        {!carregando && (
          <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
            {vendas.length} {vendas.length === 1 ? 'venda' : 'vendas'}
          </p>
        )}
      </div>

      {carregando ? (
        <div className="p-8 flex items-center justify-center gap-2" style={{ color: '#555555' }}>
          <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#333333', borderTopColor: '#C9A84C' }} />
          <span className="text-sm">Carregando vendas…</span>
        </div>
      ) : vendas.length === 0 ? (
        <div className="p-10 text-center text-sm" style={{ color: '#555555' }}>
          Nenhuma venda no período/filtro.
        </div>
      ) : (
        <>
          {/* DESKTOP (md+): tabela */}
          <div className="hidden md:block">
            <div
              className="grid text-xs font-semibold uppercase tracking-wide px-5 py-2"
              style={{ color: '#555555', borderBottom: '1px solid #1E1E1E', gridTemplateColumns: '2fr 2.2fr 2.5fr 1.2fr', gap: '0.5rem' }}
            >
              <span>Nome</span>
              <span>Email</span>
              <span>Oferta</span>
              <span className="text-right">Valor</span>
            </div>
            {pag.map((v) => (
              <div
                key={v.id}
                className="grid px-5 py-3 cursor-pointer"
                style={{ borderBottom: '1px solid #1E1E1E', gridTemplateColumns: '2fr 2.2fr 2.5fr 1.2fr', gap: '0.5rem', alignItems: 'center' }}
                onClick={() => setSel(v)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#141414'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
              >
                <span className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{v.nome_contato || '—'}</span>
                <span className="text-xs truncate" style={{ color: '#888888' }}>{v.email_contato || '—'}</span>
                <span className="text-xs truncate flex items-center gap-1.5" style={{ color: '#888888' }}>
                  <span className="truncate">{v.nome_oferta || '—'}</span>
                  {(v.qtd_bumps ?? 0) > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: '#2A1E08', color: '#C9A84C', border: '1px solid #C9A84C44' }}>+{v.qtd_bumps}</span>
                  )}
                </span>
                <span className="text-sm font-medium text-right whitespace-nowrap" style={{ color: '#C9A84C' }}>{valorDe(v)}</span>
              </div>
            ))}
          </div>

          {/* MOBILE (<md): cards */}
          <div className="md:hidden flex flex-col">
            {pag.map((v) => (
              <div
                key={v.id}
                className="px-4 py-3 cursor-pointer active:bg-[#141414]"
                style={{ borderBottom: '1px solid #1E1E1E' }}
                onClick={() => setSel(v)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{v.nome_contato || '—'}</p>
                    <p className="text-xs truncate" style={{ color: '#555555' }}>{v.email_contato || '—'}</p>
                  </div>
                  <span className="text-sm font-medium whitespace-nowrap shrink-0" style={{ color: '#C9A84C' }}>{valorDe(v)}</span>
                </div>
                <p className="text-xs truncate mt-2 flex items-center gap-1.5" style={{ color: '#888888' }}>
                  <span className="truncate">{v.nome_oferta || '—'}</span>
                  {(v.qtd_bumps ?? 0) > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: '#2A1E08', color: '#C9A84C', border: '1px solid #C9A84C44' }}>+{v.qtd_bumps}</span>
                  )}
                </p>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #1E1E1E' }}>
              <span className="text-xs" style={{ color: '#555555' }}>{inicio + 1} a {fim} de {vendas.length}</span>
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
        </>
      )}

      {sel && <VendaDrawer venda={sel} onClose={() => setSel(null)} />}
    </div>
  )
}
