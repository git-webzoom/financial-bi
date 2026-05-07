'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { GraficoDia } from './TrafegoClient'

function fmtData(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmtReais(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
}

interface TooltipPayload {
  name:  string
  value: number
  color: string
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean
  payload?: TooltipPayload[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm"
      style={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', color: '#FFFFFF' }}
    >
      <p className="font-semibold mb-1" style={{ color: '#888888' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'Investido' ? fmtReais(p.value) : `${p.value} leads`}
        </p>
      ))}
    </div>
  )
}

export default function TrafegoGrafico({ dados }: { dados: GraficoDia[] }) {
  const dataFormatada = dados.map(d => ({ ...d, dia: fmtData(d.data) }))

  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <p className="text-sm font-semibold mb-4" style={{ color: '#FFFFFF' }}>Investimento × Leads por dia</p>
      {dados.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: '#555555' }}>Sem dados para o período selecionado.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dataFormatada} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: '#888888' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#888888' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `R$${v}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#888888' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: '#888888' }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="investido"
              name="Investido"
              stroke="#C9A84C"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#C9A84C' }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke="#4ADE80"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#4ADE80' }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
