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
    <div className="bg-white border border-gray-200 rounded-xl shadow-md px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-sm font-semibold text-gray-700 mb-4">Investimento × Leads por dia</p>
      {dados.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Sem dados para o período selecionado.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dataFormatada} margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `R$${v}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="investido"
              name="Investido"
              stroke="#1E3A5F"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="leads"
              name="Leads"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
