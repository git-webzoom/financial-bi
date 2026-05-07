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

const inputCls = 'border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export default function TrafegoFiltros({
  filtros, metaAccounts, campanhas, adsets, carregando, onChange,
}: Props) {
  const opcoesContas = metaAccounts.map(a => ({ value: a.account_id, label: a.nome }))
  const opcoesCampanhas = campanhas.map(c => ({ value: c, label: c }))
  const opcoesAdsets    = adsets.map(a => ({ value: a, label: a }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <div className="flex flex-wrap gap-3 items-end">

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Data início</label>
          <input
            type="date"
            value={filtros.inicio}
            onChange={e => onChange({ inicio: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Data fim</label>
          <input
            type="date"
            value={filtros.fim}
            onChange={e => onChange({ fim: e.target.value })}
            className={inputCls}
          />
        </div>

        {/* Conta */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Conta de Anúncios</label>
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
          <label className="text-xs font-medium text-gray-500">Campanha</label>
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
          <label className="text-xs font-medium text-gray-500">Conjunto de Anúncios</label>
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
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Limpar filtros
        </button>

        {carregando && (
          <span className="text-xs text-gray-400 self-center">Carregando…</span>
        )}
      </div>
    </div>
  )
}
