'use client'

import { formatMoeda } from '@/lib/format'
import type { KpisTrafego } from './TrafegoClient'

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#888888' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{valor}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: '#555555' }}>{sub}</p>}
    </div>
  )
}

export default function TrafegoKpis({ kpis }: { kpis: KpisTrafego }) {
  const cpm = kpis.impressoes > 0 ? (kpis.investido / kpis.impressoes) * 1000 : 0
  const ctr = kpis.impressoes > 0 ? (kpis.cliques  / kpis.impressoes) * 100  : 0
  const cpl = kpis.leads      > 0 ?  kpis.investido / kpis.leads              : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total Investido"  valor={formatMoeda(kpis.investido)} />
      <KpiCard label="Impressões"       valor={fmt(kpis.impressoes)} />
      <KpiCard label="Cliques"          valor={fmt(kpis.cliques)} />
      <KpiCard label="Alcance"          valor={fmt(kpis.alcance)} />
      <KpiCard label="CPM"              valor={formatMoeda(cpm)} sub="custo por mil impressões" />
      <KpiCard label="CTR"              valor={`${ctr.toFixed(2)}%`} sub="taxa de cliques" />
      <KpiCard label="Leads"            valor={fmt(kpis.leads)} />
      <KpiCard label="CPL"              valor={kpis.leads > 0 ? formatMoeda(cpl) : '—'} sub="custo por lead" />
    </div>
  )
}
