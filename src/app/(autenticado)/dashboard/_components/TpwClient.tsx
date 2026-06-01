'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda } from '@/lib/format'
import { aplicarRegras } from '@/lib/filtros-personalizados'
import type { RegraFiltro } from '@/lib/filtros-personalizados'

interface TpwDados {
  investido:        number
  impressions:      number
  linkClicks:       number
  landingPageViews: number
  receitaBruta:     number
  numVendas:        number
}

interface FunilStep {
  label:     string
  valor:     number
  formatado: string
}

const STATUS_APROVADO = ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed']

function hoje(): string {
  return new Date().toISOString().substring(0, 10)
}

function seteDiasAtras(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().substring(0, 10)
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, valor, carregando }: { label: string; valor: string; carregando: boolean }) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
      <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: '#888888' }}>{label}</p>
      {carregando
        ? <div className="h-8 w-24 rounded animate-pulse" style={{ backgroundColor: '#1A1A1A' }} />
        : <p className="text-2xl font-bold" style={{ color: '#FFFFFF' }}>{valor}</p>
      }
    </div>
  )
}

// ─── Funil ────────────────────────────────────────────────────────────────────

const FUNIL_WIDTHS = [100, 76, 55, 38, 28]

function Funil({ steps, carregando }: { steps: FunilStep[]; carregando: boolean }) {
  return (
    <div className="flex flex-col items-center">
      {steps.map((step, i) => {
        const prev   = steps[i - 1]
        const pctStr = i === 0 ? null
          : prev && prev.valor > 0 ? `${((step.valor / prev.valor) * 100).toFixed(1)}%`
          : '—'

        const widthPct = FUNIL_WIDTHS[i] ?? FUNIL_WIDTHS[FUNIL_WIDTHS.length - 1]

        return (
          <div key={step.label} className="w-full flex flex-col items-center">
            <div
              className="rounded-xl px-4 py-3 transition-all duration-300 text-center"
              style={{ width: `${widthPct}%`, backgroundColor: '#111111', border: '1px solid #222222' }}
            >
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#666666' }}>
                {step.label}
              </p>
              {carregando ? (
                <div className="h-6 w-20 rounded animate-pulse mt-1 mx-auto" style={{ backgroundColor: '#1A1A1A' }} />
              ) : (
                <div className="flex items-baseline justify-center gap-2 mt-0.5">
                  <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{step.formatado}</p>
                  {pctStr !== null && (
                    <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{pctStr}</p>
                  )}
                </div>
              )}
            </div>
            {i < steps.length - 1 && (
              <ChevronDown className="w-4 h-4 my-0.5" style={{ color: '#444444' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #222222',
  borderRadius: '0.5rem',
  color: '#FFFFFF',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
  colorScheme: 'dark',
}

interface TpwClientProps {
  filtroTrafegoId?: string | null
  filtroVendasId?:  string | null
}

export default function TpwClient({ filtroTrafegoId = null, filtroVendasId = null }: TpwClientProps = {}) {
  const supabase = createClient()

  const [dataInicio, setDataInicio] = useState(seteDiasAtras())
  const [dataFim,    setDataFim]    = useState(hoje())
  const [dados,      setDados]      = useState<TpwDados | null>(null)
  const [carregando, setCarregando] = useState(true)

  const buscarDados = useCallback(async (inicio: string, fim: string) => {
    setCarregando(true)
    try {
      // Regras dos filtros vinculados à aba (recebidos por props). Sem filtro → soma tudo no range.
      const [{ data: tRegrasRaw }, { data: vRegrasRaw }] = await Promise.all([
        filtroTrafegoId
          ? supabase.from('filtros_personalizados_regras')
              .select('campo, operador, valor, ordem').eq('filtro_id', filtroTrafegoId).order('ordem')
          : Promise.resolve({ data: [] as RegraFiltro[], error: null }),
        filtroVendasId
          ? supabase.from('filtros_personalizados_regras')
              .select('campo, operador, valor, ordem').eq('filtro_id', filtroVendasId).order('ordem')
          : Promise.resolve({ data: [] as RegraFiltro[], error: null }),
      ])

      const regrasTrafego: RegraFiltro[] = (tRegrasRaw ?? []) as RegraFiltro[]
      const regrasVendas:  RegraFiltro[] = (vRegrasRaw ?? []) as RegraFiltro[]

      let trafegoQ = supabase
        .from('trafego')
        .select('amount_spent, impressions, link_clicks, landing_page_views')
        .gte('date_ref', inicio)
        .lte('date_ref', fim)
      if (regrasTrafego.length) trafegoQ = aplicarRegras(trafegoQ, regrasTrafego)

      let vendasQ = supabase
        .from('vendas')
        .select('status, valor_venda, venda_principal_id')
        .gte('data_pedido', inicio + 'T00:00:00-03:00')
        .lte('data_pedido', fim    + 'T23:59:59.999-03:00')
      if (regrasVendas.length) vendasQ = aplicarRegras(vendasQ, regrasVendas)

      const [{ data: tRows }, { data: vRows }] = await Promise.all([trafegoQ, vendasQ])

      const trafego = (tRows ?? []).reduce(
        (acc: { investido: number; impressions: number; linkClicks: number; landingPageViews: number },
          r: { amount_spent: number | null; impressions: number | null; link_clicks: number | null; landing_page_views: number | null }) => ({
          investido:        acc.investido        + (r.amount_spent       ?? 0),
          impressions:      acc.impressions      + (r.impressions        ?? 0),
          linkClicks:       acc.linkClicks       + (r.link_clicks        ?? 0),
          landingPageViews: acc.landingPageViews + (r.landing_page_views ?? 0),
        }),
        { investido: 0, impressions: 0, linkClicks: 0, landingPageViews: 0 }
      )

      const aprovadas    = (vRows ?? []).filter((v: { status: string }) => STATUS_APROVADO.includes(v.status))
      const receitaBruta = aprovadas.reduce((s: number, v: { valor_venda: number | null }) => s + (v.valor_venda ?? 0), 0)
      // Conta só a venda mãe (1 por compra); order bumps/upsells (venda_principal_id != null) não contam.
      const numVendas    = aprovadas.filter((v: { venda_principal_id: string | null }) => v.venda_principal_id == null).length

      setDados({ ...trafego, receitaBruta, numVendas })
    } finally {
      setCarregando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroTrafegoId, filtroVendasId])

  useEffect(() => {
    buscarDados(dataInicio, dataFim)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarDados])

  const inv = dados?.investido    ?? 0
  const rec = dados?.receitaBruta ?? 0
  const num = dados?.numVendas    ?? 0
  const fmtNum = (n: number) => n.toLocaleString('pt-BR')

  const kpis = [
    { label: 'R$ Tráfego',   valor: formatMoeda(inv)                            },
    { label: 'R$ Vendas',    valor: formatMoeda(rec)                            },
    { label: 'Nº de Vendas', valor: fmtNum(num)                                 },
    { label: 'Ticket Médio', valor: formatMoeda(num > 0 ? rec / num : 0)        },
    { label: 'CPA',          valor: formatMoeda(num > 0 ? inv / num : 0)        },
    { label: 'ROAS',         valor: (inv > 0 ? rec / inv : 0).toFixed(2) + 'x' },
  ]

  const funilSteps: FunilStep[] = [
    { label: 'IMPRESSÕES',      valor: dados?.impressions      ?? 0, formatado: fmtNum(dados?.impressions      ?? 0) },
    { label: 'CLIQUES NO LINK', valor: dados?.linkClicks       ?? 0, formatado: fmtNum(dados?.linkClicks       ?? 0) },
    { label: 'PAGE VIEW',       valor: dados?.landingPageViews ?? 0, formatado: fmtNum(dados?.landingPageViews ?? 0) },
    { label: 'TOTAL DE VENDAS', valor: dados?.numVendas        ?? 0, formatado: fmtNum(dados?.numVendas        ?? 0) },
  ]

  return (
    <div className="space-y-5">

      {/* Range de data */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>De</label>
          <input
            type="date"
            value={dataInicio}
            max={dataFim}
            onChange={e => setDataInicio(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Até</label>
          <input
            type="date"
            value={dataFim}
            min={dataInicio}
            max={hoje()}
            onChange={e => setDataFim(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          onClick={() => buscarDados(dataInicio, dataFim)}
          disabled={carregando}
          style={{
            backgroundColor: '#C9A84C',
            color: '#000000',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.5rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: carregando ? 'not-allowed' : 'pointer',
            opacity: carregando ? 0.6 : 1,
          }}
        >
          Buscar
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-5">

        {/* KPI Cards — 65% */}
        <div className="lg:flex-[65] grid grid-cols-2 sm:grid-cols-3 auto-rows-min gap-4">
          {kpis.map(({ label, valor }) => (
            <KpiCard key={label} label={label} valor={valor} carregando={carregando} />
          ))}
        </div>

        {/* Funil — 35% */}
        <div className="lg:flex-[35]">
          <Funil steps={funilSteps} carregando={carregando} />
        </div>

      </div>
    </div>
  )
}
