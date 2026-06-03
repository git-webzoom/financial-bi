'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { createClient } from '@/lib/supabase/client'

// Distribuição de Lead Score por nota dos captados da semana (aba Webinário do /dashboard).
// Dados: RPC get_lead_score_distribuicao_semana(semana). Lê a MESMA semana de captação do resto
// da aba. lead_score é por pessoa; o recorte de semana vem dos inscritos (webinario_inscritos).

interface Distribuicao {
  total_captados: number
  preencheram: number
  sem_resposta: number
  faixas: Record<'A+' | 'A' | 'B' | 'C' | 'D', number>
}

// Cor + significado curto por faixa (cores alinhadas ao FAIXA_CFG do CrmTabela; textos derivados
// das "Ações recomendadas por faixa" do PLANO-LEAD-SCORE.md §5).
const FAIXAS: { faixa: 'A+' | 'A' | 'B' | 'C' | 'D'; cor: string; significado: string }[] = [
  { faixa: 'A+', cor: '#4ADE80', significado: 'Quentíssimo · prioridade máxima' },
  { faixa: 'A',  cor: '#6EE79A', significado: 'Quente · nurturing ativo' },
  { faixa: 'B',  cor: '#FACC15', significado: 'Morno · atenção' },
  { faixa: 'C',  cor: '#60A5FA', significado: 'Frio · fluxo padrão' },
  { faixa: 'D',  cor: '#888888', significado: 'Muito frio · baixo investimento' },
]

interface BarraDado {
  faixa: string
  cor: string
  count: number
  pct: number      // % sobre quem preencheu
  rotulo: string   // "242 · 51%"
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: BarraDado }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', color: '#FFFFFF' }}>
      <p className="font-bold mb-1" style={{ color: d.cor }}>Nota {d.faixa}</p>
      <p>{d.count} leads · {d.pct}% de quem preencheu</p>
    </div>
  )
}

export default function LeadScoreGraficoSemana({ semana, carregando: carregandoPai }: { semana: number; carregando: boolean }) {
  const supabase = createClient()
  const [dist, setDist] = useState<Distribuicao | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!semana) return
    let cancelado = false
    setCarregando(true)
    supabase
      .rpc('get_lead_score_distribuicao_semana', { p_numero: semana })
      .then(({ data }) => {
        if (cancelado) return
        setDist((data as unknown as Distribuicao) ?? null)
        setCarregando(false)
      })
    return () => { cancelado = true }
  // supabase é estável entre renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana])

  const loading = carregando || carregandoPai

  const preencheram = dist?.preencheram ?? 0
  const dados: BarraDado[] = FAIXAS.map(({ faixa, cor }) => {
    const count = dist?.faixas?.[faixa] ?? 0
    const pct = preencheram > 0 ? Math.round((count / preencheram) * 100) : 0
    return { faixa, cor, count, pct, rotulo: count > 0 ? `${count} · ${pct}%` : '0' }
  })

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
      {/* Cabeçalho + resumo (captados → preencheram → sem resposta) */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-4">
        <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
          Qualidade dos leads captados · Semana {semana}
        </p>
        {!loading && dist && (
          <p className="text-xs" style={{ color: '#888888' }}>
            <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{dist.total_captados.toLocaleString('pt-BR')}</span> captados
            {' · '}
            <span style={{ color: '#C9A84C', fontWeight: 600 }}>{dist.preencheram.toLocaleString('pt-BR')}</span> preencheram a pesquisa
            {dist.total_captados > 0 && ` (${Math.round((dist.preencheram / dist.total_captados) * 100)}%)`}
            {' · '}
            {dist.sem_resposta.toLocaleString('pt-BR')} sem resposta
          </p>
        )}
      </div>

      {loading ? (
        <div className="h-[240px] rounded animate-pulse" style={{ backgroundColor: '#1A1A1A' }} />
      ) : !dist || dist.total_captados === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-center" style={{ color: '#555555' }}>
          Sem captação nesta semana ainda.
        </div>
      ) : dist.preencheram === 0 ? (
        <div className="h-[240px] flex items-center justify-center text-sm text-center" style={{ color: '#555555' }}>
          Nenhum dos {dist.total_captados} captados preencheu a pesquisa nesta semana.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dados} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="faixa"
                tick={{ fill: '#CCCCCC', fontSize: 14, fontWeight: 700 }}
                tickLine={false}
                axisLine={{ stroke: '#222222' }}
              />
              <YAxis hide />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1A1A1A' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {dados.map((d) => (
                  <Cell key={d.faixa} fill={d.cor} />
                ))}
                <LabelList dataKey="rotulo" position="top" fill="#CCCCCC" fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legenda: cor + faixa + significado */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 pt-4" style={{ borderTop: '1px solid #1E1E1E' }}>
            {FAIXAS.map(({ faixa, cor, significado }) => (
              <div key={faixa} className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: cor }} />
                <span className="text-xs" style={{ color: '#AAAAAA' }}>
                  <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{faixa}</span> — {significado}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
