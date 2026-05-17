'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { InscritoCrm } from './CrmClient'

interface Props {
  inscritos: InscritoCrm[]
  carregando: boolean
  sourceAtivo: string | null
  campaignAtivo: string | null
  onSource: (s: string) => void
  onCampaign: (c: string) => void
}

function agrupar(inscritos: InscritoCrm[], campo: keyof InscritoCrm, top: number) {
  const map: Record<string, number> = {}
  for (const i of inscritos) {
    const v = (i[campo] as string) || '(sem valor)'
    map[v] = (map[v] ?? 0) + 1
  }
  const total = inscritos.length
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([nome, count]) => ({
      nome: nome.length > 30 ? nome.slice(0, 28) + '…' : nome,
      nomeCompleto: nome,
      count,
      pct: total > 0 ? (count / total * 100).toFixed(1) : '0',
    }))
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: { nomeCompleto: string; count: number; pct: string } }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', color: '#FFFFFF' }}>
      <p className="font-medium mb-1" style={{ color: '#C9A84C' }}>{d.nomeCompleto}</p>
      <p>{d.count} inscritos · {d.pct}%</p>
    </div>
  )
}

function GraficoBarras({
  dados, titulo, ativo, onClick, altura,
}: {
  dados: ReturnType<typeof agrupar>
  titulo: string
  ativo: string | null
  onClick: (nome: string) => void
  altura: number
}) {
  if (dados.length === 0) {
    return (
      <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#FFFFFF' }}>{titulo}</p>
        <p className="text-sm" style={{ color: '#555555' }}>Sem dados para exibir.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
      <p className="text-sm font-semibold mb-4" style={{ color: '#FFFFFF' }}>{titulo}</p>
      <ResponsiveContainer width="100%" height={altura}>
        <BarChart data={dados} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nomeCompleto"
            width={120}
            tick={({ x, y, payload }) => (
              <text x={x} y={y} fill="#888888" fontSize={11} textAnchor="end" dominantBaseline="middle">
                {payload.value.length > 18 ? payload.value.slice(0, 16) + '…' : payload.value}
              </text>
            )}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1A1A1A' }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} onClick={(d) => onClick((d as unknown as { nomeCompleto: string }).nomeCompleto)} style={{ cursor: 'pointer' }}>
            {dados.map((entry, idx) => (
              <Cell
                key={`${idx}-${entry.nomeCompleto}`}
                fill={ativo === null || ativo === entry.nomeCompleto ? '#C9A84C' : '#3A2E10'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {ativo && (
        <p className="text-xs mt-2" style={{ color: '#C9A84C' }}>
          Filtrando por: <strong>{ativo}</strong> — clique novamente para remover
        </p>
      )}
    </div>
  )
}

export default function CrmGraficosOrigem({ inscritos, carregando, sourceAtivo, campaignAtivo, onSource, onCampaign }: Props) {
  const sources   = agrupar(inscritos, 'utm_source', 10)
  const campaigns = agrupar(inscritos, 'utm_campaign', 10)

  if (carregando) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {[1, 2].map(k => (
          <div key={k} className={`rounded-xl p-5 ${k === 1 ? 'lg:col-span-3' : 'lg:col-span-2'}`} style={{ backgroundColor: '#111111', border: '1px solid #222222', height: 220 }} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3">
        <GraficoBarras
          dados={sources}
          titulo="Top 10 — utm_source"
          ativo={sourceAtivo}
          onClick={onSource}
          altura={Math.max(sources.length * 28, 80)}
        />
      </div>
      <div className="lg:col-span-2">
        <GraficoBarras
          dados={campaigns}
          titulo="Top 10 — utm_campaign"
          ativo={campaignAtivo}
          onClick={onCampaign}
          altura={Math.max(campaigns.length * 28, 80)}
        />
      </div>
    </div>
  )
}
