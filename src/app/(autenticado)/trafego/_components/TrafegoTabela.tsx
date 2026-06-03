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

// Campo label/valor dos cards no mobile.
function CampoTraf({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide" style={{ color: '#555555' }}>{label}</p>
      <p className="text-xs truncate" style={{ color: '#AAAAAA' }}>{valor}</p>
    </div>
  )
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
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      {/* DESKTOP (md+): tabela. No mobile usa os cards abaixo. */}
      <div className="hidden md:block overflow-x-auto">
        <table className={`w-full text-sm transition-opacity ${carregando ? 'opacity-50' : ''}`}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#111111' }}>
              {['Data', 'Conta', 'Campanha', 'Conjunto', 'Anúncio', 'Investido', 'Impressões', 'Cliques', 'CTR', 'Leads', 'CPL'].map(h => (
                <th
                  key={h}
                  className="text-left px-4 py-3 font-medium whitespace-nowrap text-xs uppercase tracking-wide"
                  style={{ color: '#888888' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: '#555555' }}>
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : registros.map(r => (
              <tr
                key={r.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#0A0A0A' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#111111'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#0A0A0A'}
              >
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>{fmtData(r.date_ref)}</td>
                <td className="px-4 py-3 whitespace-nowrap max-w-[140px] truncate" style={{ color: '#FFFFFF' }}>
                  {accountMap.get(r.ad_account_id) ?? r.ad_account_id}
                </td>
                <td className="px-4 py-3 max-w-[180px] truncate" title={r.campaign_name} style={{ color: '#FFFFFF' }}>{r.campaign_name}</td>
                <td className="px-4 py-3 max-w-[160px] truncate" title={r.adset_name} style={{ color: '#FFFFFF' }}>{r.adset_name}</td>
                <td className="px-4 py-3 max-w-[160px] truncate" title={r.ad_name} style={{ color: '#FFFFFF' }}>{r.ad_name}</td>
                <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: '#C9A84C' }}>{formatMoeda(r.amount_spent)}</td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>{fmtNum(r.impressions)}</td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>{fmtNum(r.link_clicks)}</td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>{ctr(r.link_clicks, r.impressions)}</td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>{fmtNum(r.leads)}</td>
                <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>{cpl(r.amount_spent, r.leads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE (<md): cada registro vira um card — sem scroll horizontal */}
      <div className={`md:hidden flex flex-col transition-opacity ${carregando ? 'opacity-50' : ''}`}>
        {registros.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: '#555555' }}>Nenhum registro encontrado.</div>
        ) : registros.map(r => (
          <div key={r.id} className="px-4 py-3" style={{ borderBottom: '1px solid #1E1E1E' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }} title={r.campaign_name}>{r.campaign_name || '—'}</p>
                <p className="text-xs truncate" style={{ color: '#888888' }}>{accountMap.get(r.ad_account_id) ?? r.ad_account_id} · {fmtData(r.date_ref)}</p>
              </div>
              <span className="text-sm font-medium shrink-0" style={{ color: '#C9A84C' }}>{formatMoeda(r.amount_spent)}</span>
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-2 mt-3">
              <CampoTraf label="Impressões" valor={fmtNum(r.impressions)} />
              <CampoTraf label="Cliques" valor={fmtNum(r.link_clicks)} />
              <CampoTraf label="CTR" valor={ctr(r.link_clicks, r.impressions)} />
              <CampoTraf label="Leads" valor={fmtNum(r.leads)} />
              <CampoTraf label="CPL" valor={cpl(r.amount_spent, r.leads)} />
            </div>
          </div>
        ))}
      </div>

      {/* Paginação */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderTop: '1px solid #1E1E1E', backgroundColor: '#111111' }}
      >
        <p className="text-xs" style={{ color: '#555555' }}>
          {total === 0 ? 'Nenhum registro' : `${inicio}–${fim} de ${new Intl.NumberFormat('pt-BR').format(total)} registros`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPagina(pagina - 1)}
            disabled={pagina === 0 || carregando}
            className="p-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs px-1" style={{ color: '#888888' }}>
            Página {pagina + 1} de {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <button
            onClick={() => onPagina(pagina + 1)}
            disabled={fim >= total || carregando}
            className="p-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
