'use client'

import type { PresencaWebn } from './WebnarioClient'

interface Props {
  presencas: PresencaWebn[]
  carregando: boolean
}

function KpiCard({
  label, valor, sub, corValor, carregando,
}: {
  label: string
  valor: React.ReactNode
  sub?: React.ReactNode
  corValor?: string
  carregando: boolean
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-1 min-w-0"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate" style={{ color: '#555555' }}>
        {label}
      </p>
      {carregando
        ? <div className="h-8 rounded" style={{ backgroundColor: '#1A1A1A', width: '60%' }} />
        : <p className="text-xl sm:text-2xl lg:text-3xl font-bold truncate" style={{ color: corValor ?? '#FFFFFF' }}>{valor}</p>
      }
      {sub && !carregando && (
        <p className="text-xs truncate" style={{ color: '#888888' }}>{sub}</p>
      )}
    </div>
  )
}

export default function WebnarioKpis({ presencas, carregando }: Props) {
  const total = presencas.length
  const pitch = presencas.filter(p => p.viu_pitch).length
  const taxaRetencao = total > 0 ? (pitch / total * 100) : 0

  return (
    <div className="grid grid-cols-2 gap-4">
      <KpiCard
        label="Acessaram ao Vivo"
        valor={total.toLocaleString('pt-BR')}
        carregando={carregando}
      />
      <KpiCard
        label="Ficaram até o Pitch"
        valor={pitch.toLocaleString('pt-BR')}
        sub={total > 0 ? `${taxaRetencao.toFixed(1).replace('.', ',')}% de retenção` : undefined}
        corValor="#4ADE80"
        carregando={carregando}
      />
    </div>
  )
}
