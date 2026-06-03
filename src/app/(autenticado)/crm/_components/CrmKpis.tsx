'use client'

import { useRouter } from 'next/navigation'
import type { InscritoCrm } from './CrmClient'

interface Props {
  inscritos: InscritoCrm[]
  carregando: boolean
}

function KpiCard({
  label, valor, sub, corValor, carregando, onClick,
}: {
  label: string
  valor: React.ReactNode
  sub?: React.ReactNode
  corValor?: string
  carregando: boolean
  onClick?: () => void
}) {
  return (
    <div
      className="rounded-xl px-4 py-3 sm:px-5 sm:py-4 flex flex-col gap-1 min-w-0"
      style={{
        backgroundColor: '#111111',
        border: '1px solid #222222',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s',
      }}
      onClick={onClick}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.borderColor = '#C9A84C' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.borderColor = '#222222' }}
    >
      <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider truncate" style={{ color: '#555555' }}>
        {label}
        {onClick && <span className="ml-1 normal-case font-normal" style={{ color: '#3A2E10' }}>↗</span>}
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

export default function CrmKpis({ inscritos, carregando }: Props) {
  const router = useRouter()
  const total = inscritos.length
  const novos = inscritos.filter(i => i.outras_semanas.length === 0).length
  const recorrentes = total - novos
  const compradores = inscritos.filter(i => i.comprou)
  const taxa = total > 0 ? (compradores.length / total * 100) : 0

  function verCompras() {
    if (compradores.length === 0) return
    const emails = compradores.map(i => i.email).filter(Boolean)
    sessionStorage.setItem('vendas_filtro_emails', JSON.stringify(emails))
    router.push('/vendas')
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Total Inscritos"
        valor={total.toLocaleString('pt-BR')}
        carregando={carregando}
      />
      <KpiCard
        label="Novos / Recorrentes"
        valor={`${novos.toLocaleString('pt-BR')} / ${recorrentes.toLocaleString('pt-BR')}`}
        sub={total > 0 ? `${Math.round(novos / total * 100)}% novos` : undefined}
        carregando={carregando}
      />
      <KpiCard
        label="Compradores"
        valor={compradores.length.toLocaleString('pt-BR')}
        corValor="#C9A84C"
        sub="Clique para ver as vendas"
        carregando={carregando}
        onClick={compradores.length > 0 ? verCompras : undefined}
      />
      <KpiCard
        label="Taxa de Conversão"
        valor={`${taxa.toFixed(1).replace('.', ',')}%`}
        corValor="#C9A84C"
        sub={total > 0 ? `${compradores.length} de ${total} inscritos` : undefined}
        carregando={carregando}
      />
    </div>
  )
}
