'use client'

import { formatMoeda } from '@/lib/format'
import type { RegistroTrafego, MetaAccount } from './TrafegoClient'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function fmtNum(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('pt-BR').format(n)
}

function fmtData(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function ctr(cliques: number | null, impressoes: number | null) {
  if (!cliques || !impressoes || impressoes === 0) return '—'
  return `${((cliques / impressoes) * 100).toFixed(2)}%`
}

function cpl(investido: number | null, leads: number | null) {
  if (!investido || !leads || leads === 0) return '—'
  return formatMoeda(investido / leads)
}

interface Props {
  registros:    RegistroTrafego[]
  metaAccounts: MetaAccount[]
  total:        number
  pagina:       number
  pageSize:     number
  carregando:   boolean
  onPagina:     (p: number) => void
}

export default function TrafegoTabela({
  registros, metaAccounts, total, pagina, pageSize, carregando, onPagina,
}: Props) {
  const accountMap = new Map(metaAccounts.map(a => [a.account_id, a.nome]))
  const inicio = pagina * pageSize + 1
  const fim    = Math.min(pagina * pageSize + registros.length, total)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className={`w-full text-sm transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Data', 'Conta', 'Campanha', 'Conjunto', 'Anúncio', 'Investido', 'Impressões', 'Cliques', 'CTR', 'Leads', 'CPL'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500 whitespace-nowrap text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : registros.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtData(r.date_ref)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700 max-w-[140px] truncate">
                  {accountMap.get(r.ad_account_id) ?? r.ad_account_id}
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={r.campaign_name}>{r.campaign_name}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={r.adset_name}>{r.adset_name}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={r.ad_name}>{r.ad_name}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">{formatMoeda(r.amount_spent)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtNum(r.impressions)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtNum(r.link_clicks)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{ctr(r.link_clicks, r.impressions)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtNum(r.leads)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{cpl(r.amount_spent, r.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500">
          {total === 0 ? 'Nenhum registro' : `${inicio}–${fim} de ${new Intl.NumberFormat('pt-BR').format(total)} registros`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPagina(pagina - 1)}
            disabled={pagina === 0 || carregando}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-600 px-1">Página {pagina + 1} de {Math.max(1, Math.ceil(total / pageSize))}</span>
          <button
            onClick={() => onPagina(pagina + 1)}
            disabled={fim >= total || carregando}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
