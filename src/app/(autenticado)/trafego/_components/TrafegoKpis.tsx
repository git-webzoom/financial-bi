'use client'

import { formatMoeda } from '@/lib/format'
import type { KpisTrafego } from './TrafegoClient'

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

function KpiCard({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
