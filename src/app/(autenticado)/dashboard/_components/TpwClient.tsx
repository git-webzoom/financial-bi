'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda } from '@/lib/format'
import SeletorSemana from '../../crm/_components/SeletorSemana'
import { aplicarRegras } from '@/lib/filtros-personalizados'
import type { RegraFiltro } from '@/lib/filtros-personalizados'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TpwPeriodo {
  data_inicio: string
  data_fim:    string
}

// SeletorSemana espera timestamps — usa noon BRT para evitar erro de fuso
function toSeletorPeriodo(p: TpwPeriodo | null) {
  if (!p) return null
  return {
    data_inicio: p.data_inicio + 'T12:00:00-03:00',
    data_fim:    p.data_fim    + 'T12:00:00-03:00',
    data_evento: '',
  }
}

// Soma N dias a uma data YYYY-MM-DD
function addDias(dateStr: string, dias: number): string {
  const d = new Date(dateStr + 'T12:00:00-03:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().substring(0, 10)
}

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

type SemanaRow = { numero: number; inicio: string; fim: string }

const STATUS_APROVADO = ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed']

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

// Larguras fixas decrescentes para formato visual de funil real
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
              className="rounded-xl px-4 py-3 transition-all duration-300"
              style={{ width: `${widthPct}%`, backgroundColor: '#111111', border: '1px solid #222222' }}
            >
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#666666' }}>
                {step.label}
              </p>
              {carregando ? (
                <div className="h-6 w-20 rounded animate-pulse mt-1" style={{ backgroundColor: '#1A1A1A' }} />
              ) : (
                <div className="flex items-baseline gap-2 mt-0.5">
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

export default function TpwClient() {
  const supabase = createClient()

  const [semana,      setSemana]      = useState(0)
  const [semanaAtual, setSemanaAtual] = useState(0)
  // periodo = webn (vendas) — usado no SeletorSemana para exibir as datas
  const [periodo,     setPeriodo]     = useState<TpwPeriodo | null>(null)
  const [dados,       setDados]       = useState<TpwDados | null>(null)
  const [carregando,  setCarregando]  = useState(true)
  const [iniciou,     setIniciou]     = useState(false)

  // Pontos de referência fixos por entidade
  const refSemana         = useRef(0)
  const refPeriodoVendas  = useRef<TpwPeriodo | null>(null) // webn
  const refPeriodoCapt    = useRef<TpwPeriodo | null>(null) // captação (tráfego)

  const buscarDados = useCallback(async (
    perVendas:  TpwPeriodo,
    perTrafego: TpwPeriodo,
  ) => {
    setCarregando(true)
    try {
      // 1. IDs dos filtros TPW (trafego + vendas)
      const [{ data: ftFiltro }, { data: fvFiltro }] = await Promise.all([
        supabase
          .from('filtros_personalizados').select('id')
          .eq('nome', 'TPW').eq('modulo', 'trafego').eq('ativo', true).maybeSingle(),
        supabase
          .from('filtros_personalizados').select('id')
          .eq('nome', 'TPW').eq('modulo', 'vendas').eq('ativo', true).maybeSingle(),
      ])

      // 2. Regras de cada filtro
      const [{ data: tRegrasRaw }, { data: vRegrasRaw }] = await Promise.all([
        ftFiltro?.id
          ? supabase.from('filtros_personalizados_regras')
              .select('campo, operador, valor, ordem').eq('filtro_id', ftFiltro.id).order('ordem')
          : Promise.resolve({ data: [] as RegraFiltro[], error: null }),
        fvFiltro?.id
          ? supabase.from('filtros_personalizados_regras')
              .select('campo, operador, valor, ordem').eq('filtro_id', fvFiltro.id).order('ordem')
          : Promise.resolve({ data: [] as RegraFiltro[], error: null }),
      ])

      const regrasTrafego: RegraFiltro[] = (tRegrasRaw ?? []) as RegraFiltro[]
      const regrasVendas:  RegraFiltro[] = (vRegrasRaw ?? []) as RegraFiltro[]

      // 3. Queries — cada entidade usa seu próprio período de semana
      let trafegoQ = supabase
        .from('trafego')
        .select('amount_spent, impressions, link_clicks, landing_page_views')
        .gte('date_ref', perTrafego.data_inicio)
        .lte('date_ref', perTrafego.data_fim)
      if (regrasTrafego.length) trafegoQ = aplicarRegras(trafegoQ, regrasTrafego)

      // Vendas: dia cheio em BRT (igual à página de Vendas)
      let vendasQ = supabase
        .from('vendas')
        .select('status, valor_venda')
        .gte('data_pedido', perVendas.data_inicio + 'T00:00:00-03:00')
        .lte('data_pedido', perVendas.data_fim    + 'T23:59:59.999-03:00')
      if (regrasVendas.length) vendasQ = aplicarRegras(vendasQ, regrasVendas)

      const [{ data: tRows }, { data: vRows }] = await Promise.all([trafegoQ, vendasQ])

      // 4. Agrega tráfego
      const trafego = (tRows ?? []).reduce(
        (acc: { investido: number; impressions: number; linkClicks: number; landingPageViews: number },
          r: { amount_spent: number | null; impressions: number | null; link_clicks: number | null; landing_page_views: number | null }) => ({
          investido:        acc.investido        + (r.amount_spent        ?? 0),
          impressions:      acc.impressions      + (r.impressions         ?? 0),
          linkClicks:       acc.linkClicks       + (r.link_clicks         ?? 0),
          landingPageViews: acc.landingPageViews + (r.landing_page_views  ?? 0),
        }),
        { investido: 0, impressions: 0, linkClicks: 0, landingPageViews: 0 }
      )

      // 5. Agrega vendas — apenas status aprovados
      const aprovadas    = (vRows ?? []).filter((v: { status: string }) => STATUS_APROVADO.includes(v.status))
      const receitaBruta = aprovadas.reduce((s: number, v: { valor_venda: number | null }) => s + (v.valor_venda ?? 0), 0)

      setDados({ ...trafego, receitaBruta, numVendas: aprovadas.length })
    } finally {
      setCarregando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    async function init() {
      // Busca semana atual de cada entidade em paralelo
      const [{ data: webnRaw }, { data: captRaw }] = await Promise.all([
        supabase.rpc('listar_semanas_vendas',   { p_limit: 1 }),
        supabase.rpc('listar_semanas_recentes', { p_limit: 20, p_offset: 0 }),
      ])

      const webnRows = (Array.isArray(webnRaw) ? webnRaw : (webnRaw ? [webnRaw] : [])) as SemanaRow[]
      const captRows = (Array.isArray(captRaw) ? captRaw : (captRaw ? [captRaw] : [])) as SemanaRow[]

      if (!webnRows[0]) return

      const webn = webnRows[0]
      const numero = webn.numero

      // Período webn (para vendas e display no seletor)
      const perVendas: TpwPeriodo = {
        data_inicio: String(webn.inicio),
        data_fim:    String(webn.fim),
      }

      // Período captação (para tráfego) — busca a semana com mesmo número
      const captSemana = captRows.find(r => r.numero === numero)
      const perTrafego: TpwPeriodo = captSemana
        ? { data_inicio: String(captSemana.inicio), data_fim: String(captSemana.fim) }
        : { data_inicio: addDias(perVendas.data_inicio, -7), data_fim: addDias(perVendas.data_fim, -7) }

      refSemana.current        = numero
      refPeriodoVendas.current  = perVendas
      refPeriodoCapt.current    = perTrafego

      setSemanaAtual(numero)
      setSemana(numero)
      setPeriodo(perVendas)
      setIniciou(true)
      buscarDados(perVendas, perTrafego)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMudarSemana = useCallback((nova: number) => {
    const baseVendas  = refPeriodoVendas.current
    const baseTrafego = refPeriodoCapt.current
    if (!baseVendas || !baseTrafego) return

    const delta = nova - refSemana.current

    const novoVendas: TpwPeriodo = {
      data_inicio: addDias(baseVendas.data_inicio,  delta * 7),
      data_fim:    addDias(baseVendas.data_fim,      delta * 7),
    }
    const novoTrafego: TpwPeriodo = {
      data_inicio: addDias(baseTrafego.data_inicio, delta * 7),
      data_fim:    addDias(baseTrafego.data_fim,    delta * 7),
    }

    setSemana(nova)
    setPeriodo(novoVendas)
    buscarDados(novoVendas, novoTrafego)
  }, [buscarDados])

  // ── Loading inicial ──────────────────────────────────────────────────────────
  if (!iniciou) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 animate-spin"
          style={{ borderColor: '#333333', borderTopColor: '#C9A84C' }} />
      </div>
    )
  }

  // ── KPIs derivados ───────────────────────────────────────────────────────────
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

      <SeletorSemana
        semana={semana}
        semanaAtual={semanaAtual}
        periodo={toSeletorPeriodo(periodo)}
        carregando={carregando}
        onMudar={handleMudarSemana}
      />

      <div className="flex flex-col lg:flex-row gap-5">

        {/* KPI Cards — 65% */}
        <div className="lg:flex-[65] grid grid-cols-2 sm:grid-cols-3 gap-4">
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
