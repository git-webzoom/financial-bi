'use client'

import SelectBusca from './SelectBusca'
import type { FiltrosTrafego, MetaAccount } from './TrafegoClient'

interface Props {
  filtros:      FiltrosTrafego
  metaAccounts: MetaAccount[]
  campanhas:    string[]
  adsets:       string[]
  carregando:   boolean
  onChange:     (f: Partial<FiltrosTrafego>) => void
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #222222',
  color: '#FFFFFF',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

export default function TrafegoFiltros({
  filtros, metaAccounts, campanhas, adsets, carregando, onChange,
}: Props) {
  const opcoesContas    = metaAccounts.map(a => ({ value: a.account_id, label: a.nome }))
  const opcoesCampanhas = campanhas.map(c => ({ value: c, label: c }))
  const opcoesAdsets    = adsets.map(a => ({ value: a, label: a }))

  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <div className="flex flex-wrap gap-3 items-end">

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Data início</label>
          <input
            type="date"
            value={filtros.inicio}
            onChange={e => onChange({ inicio: e.target.value })}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#C9A84C')}
            onBlur={e => (e.target.style.borderColor = '#222222')}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Data fim</label>
          <input
            type="date"
            value={filtros.fim}
            onChange={e => onChange({ fim: e.target.value })}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#C9A84C')}
            onBlur={e => (e.target.style.borderColor = '#222222')}
          />
        </div>

        {/* Conta */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Conta de Anúncios</label>
          <SelectBusca
            opcoes={opcoesContas}
            value={filtros.conta}
            placeholder="Todas as contas"
            placeholderBusca="Buscar conta..."
            onChange={v => onChange({ conta: v, campanha: '', adset: '' })}
            disabled={carregando}
          />
        </div>

        {/* Campanha */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Campanha</label>
          <SelectBusca
            opcoes={opcoesCampanhas}
            value={filtros.campanha}
            placeholder="Todas as campanhas"
            placeholderBusca="Buscar campanha..."
            onChange={v => onChange({ campanha: v, adset: '' })}
            disabled={carregando}
          />
        </div>

        {/* Conjunto */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Conjunto de Anúncios</label>
          <SelectBusca
            opcoes={opcoesAdsets}
            value={filtros.adset}
            placeholder="Todos os conjuntos"
            placeholderBusca="Buscar conjunto..."
            onChange={v => onChange({ adset: v })}
            disabled={carregando}
          />
        </div>

        {/* Limpar */}
        <button
          onClick={() => onChange({ conta: '', campanha: '', adset: '' })}
          disabled={carregando}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: 'transparent', border: '1px solid #333333', color: '#888888' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
            ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#888888'
          }}
        >
          Limpar filtros
        </button>

        {carregando && (
          <span className="text-xs self-center" style={{ color: '#555555' }}>Carregando…</span>
        )}
      </div>
    </div>
  )
}
