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
      className="rounded-xl px-5 py-4 flex flex-col gap-1"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#555555' }}>
        {label}
      </p>
      {carregando
        ? <div className="h-8 rounded" style={{ backgroundColor: '#1A1A1A', width: '60%' }} />
        : <p className="text-3xl font-bold" style={{ color: corValor ?? '#FFFFFF' }}>{valor}</p>
      }
      {sub && !carregando && (
        <p className="text-xs" style={{ color: '#888888' }}>{sub}</p>
      )}
    </div>
  )
}

export default function WebnarioKpis({ presencas, carregando }: Props) {
  const total = presencas.length
  const pitch = presencas.filter(p => p.viu_pitch).length
  const compradores = presencas.filter(p => p.comprou).length
  const taxaRetencao = total > 0 ? (pitch / total * 100) : 0
  const taxaConversao = pitch > 0 ? (compradores / pitch * 100) : 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <KpiCard
        label="Compradores"
        valor={compradores.toLocaleString('pt-BR')}
        sub={pitch > 0 ? `${taxaConversao.toFixed(1).replace('.', ',')}% dos que viram o pitch` : undefined}
        corValor="#C9A84C"
        carregando={carregando}
      />
      <KpiCard
        label="Taxa de Conversão"
        valor={`${(total > 0 ? compradores / total * 100 : 0).toFixed(1).replace('.', ',')}%`}
        sub={total > 0 ? `${compradores} de ${total} presentes` : undefined}
        corValor="#C9A84C"
        carregando={carregando}
      />
    </div>
  )
}
