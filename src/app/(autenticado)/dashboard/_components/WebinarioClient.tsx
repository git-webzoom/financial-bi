'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda } from '@/lib/format'
import { aplicarRegras } from '@/lib/filtros-personalizados'
import type { RegraFiltro } from '@/lib/filtros-personalizados'
import SeletorSemana from '@/app/(autenticado)/crm/_components/SeletorSemana'
import LeadScoreGraficoSemana from './LeadScoreGraficoSemana'

interface WebinarioDados {
  investido:        number
  impressions:      number
  linkClicks:       number
  landingPageViews: number
  receitaBruta:     number
  numVendas:        number
  leads:            number
  noGrupo:          number
  showUp:           number
  pitch:            number
}

interface Periodo {
  data_inicio: string
  data_fim:    string
  data_evento: string
}

interface FunilStep {
  label:     string
  valor:     number
  formatado: string
}

const STATUS_APROVADO = ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed']

// Filtros personalizados fixos da aba Webinário (afetam só tráfego e vendas).
const FILTRO_TRAFEGO_ID = '1b4386d9-6a7f-4f9f-a0aa-81c45f62578f' // "WEBN" (trafego)
const FILTRO_VENDAS_ID  = '0ec3aba7-cc3f-4d3e-a6af-b0dda68ea762' // "WEBN Sem Renov" (vendas)

// ─── KPI Card (mesmo estilo do mockup venda_direta) ────────────────────────────

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

// ─── Funil (8 passos) ──────────────────────────────────────────────────────────

// 8 larguras decrescentes para o funil parecer um funil de verdade.
const FUNIL_WIDTHS = [100, 88, 76, 64, 53, 43, 34, 26]

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmtNum = (n: number) => n.toLocaleString('pt-BR')

function umAsLinha<T>(raw: T | T[] | null): T | null {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null)
}

interface SemanaRange { numero: number; inicio: string; fim: string; inicio_ts?: string; fim_ts?: string }

// ─── Componente principal ──────────────────────────────────────────────────────

export default function WebinarioClient() {
  const supabase = createClient()

  const [semanaAtual, setSemanaAtual] = useState<number>(0)
  const [semana,      setSemana]      = useState<number>(0)
  const [periodo,     setPeriodo]     = useState<Periodo | null>(null)
  const [dados,       setDados]       = useState<WebinarioDados | null>(null)
  const [carregando,  setCarregando]  = useState(true)
  const semanaCarregada = useRef<number | null>(null)

  // Busca os dados de UMA semana. Cada entidade resolve a semana pela SUA própria
  // definição: tráfego pela semana de tráfego (date_ref, régua Qua→Ter), vendas pela
  // semana de vendas (data_pedido), webinário pela coluna numero_semana, grupo é valor fixo.
  const buscarDados = useCallback(async (numeroSemana: number) => {
    setCarregando(true)
    try {
      // Períodos por entidade + período do webinário (para o SeletorSemana)
      // + regras dos filtros personalizados fixos "WEBN" (tráfego) e "WEBN Sem Renov" (vendas).
      const [
        { data: semTrafegoRaw },
        { data: semVendasRaw },
        { data: periodoRaw },
        { data: tRegrasRaw },
        { data: vRegrasRaw },
      ] = await Promise.all([
        supabase.rpc('listar_semanas_trafego', { p_limit: 60, p_offset: 0 }),
        supabase.rpc('listar_semanas_vendas',   { p_limit: 60 }),
        supabase.rpc('get_periodo_semana',      { p_numero: numeroSemana, p_entidade: 'webn' }),
        supabase.from('filtros_personalizados_regras')
          .select('campo, operador, valor, ordem').eq('filtro_id', FILTRO_TRAFEGO_ID).order('ordem'),
        supabase.from('filtros_personalizados_regras')
          .select('campo, operador, valor, ordem').eq('filtro_id', FILTRO_VENDAS_ID).order('ordem'),
      ])

      const semTrafego = (semTrafegoRaw ?? []) as SemanaRange[]
      const semVendas  = (semVendasRaw  ?? []) as SemanaRange[]
      const regrasTrafego = (tRegrasRaw ?? []) as RegraFiltro[]
      const regrasVendas  = (vRegrasRaw ?? []) as RegraFiltro[]

      const rangeTrafego = semTrafego.find(s => s.numero === numeroSemana) ?? null
      const rangeVendas  = semVendas.find(s => s.numero === numeroSemana)  ?? null
      const periodoWebn  = umAsLinha<Periodo>(periodoRaw as Periodo | Periodo[] | null)

      // Tráfego (semana de captação, filtro "WEBN") — só consulta se houver range
      let trafegoQ
      if (rangeTrafego) {
        let q = supabase
          .from('trafego')
          .select('amount_spent, impressions, link_clicks, landing_page_views')
          .gte('date_ref', rangeTrafego.inicio)
          .lte('date_ref', rangeTrafego.fim)
        if (regrasTrafego.length) q = aplicarRegras(q, regrasTrafego)
        trafegoQ = q
      } else {
        trafegoQ = Promise.resolve({ data: [] })
      }

      // Vendas (semana de vendas, filtro "WEBN Sem Renov") — data_pedido em BRT.
      // Usa os timestamps com o corte real da semana (ex. terça 20:00→19:59); cai para
      // dia inteiro 00:00→23:59 só se a RPC não trouxer os _ts (compatibilidade).
      let vendasQ
      if (rangeVendas) {
        const vIni = rangeVendas.inicio_ts ?? rangeVendas.inicio + 'T00:00:00-03:00'
        const vFim = rangeVendas.fim_ts    ?? rangeVendas.fim    + 'T23:59:59.999-03:00'
        let q = supabase
          .from('vendas')
          .select('id, status, valor_venda, venda_principal_id')
          .gte('data_pedido', vIni)
          .lte('data_pedido', vFim)
        if (regrasVendas.length) q = aplicarRegras(q, regrasVendas)
        vendasQ = q
      } else {
        vendasQ = Promise.resolve({ data: [] })
      }

      // Webinário (coluna numero_semana) — contagens via head:true
      const leadsQ = supabase
        .from('webinario_inscritos')
        .select('id', { count: 'exact', head: true })
        .eq('numero_semana', numeroSemana)

      const showUpQ = supabase
        .from('webinario_presencas')
        .select('id', { count: 'exact', head: true })
        .eq('numero_semana', numeroSemana)

      const pitchQ = supabase
        .from('webinario_presencas')
        .select('id', { count: 'exact', head: true })
        .eq('numero_semana', numeroSemana)
        .eq('viu_pitch', true)

      // NO GRUPO — histórico da semana (mesma fonte do card "No grupo · Semana N" em /grupos):
      // grupos_kpis_semana.no_grupo_agora filtrado por numero_semana.
      const grupoQ = supabase
        .from('grupos_kpis_semana')
        .select('no_grupo_agora')
        .eq('numero_semana', numeroSemana)
        .maybeSingle()

      const [
        { data: tRows },
        { data: vRows },
        { count: leadsCount },
        { count: showUpCount },
        { count: pitchCount },
        { data: grupoRow },
      ] = await Promise.all([trafegoQ, vendasQ, leadsQ, showUpQ, pitchQ, grupoQ])

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
      // Conta COMPRAS distintas (1 por compra). Um order bump que passou o filtro mas cuja mãe não
      // passou (ex.: mãe "Sala VIP Mensal" + bumps WEBN) ainda conta a compra como 1 — mesma régua
      // da aba Vendas (coalesce(venda_principal_id, id)).
      const numVendas    = new Set(
        aprovadas.map((v: { id: string; venda_principal_id: string | null }) => v.venda_principal_id ?? v.id)
      ).size

      setPeriodo(periodoWebn)
      setDados({
        ...trafego,
        receitaBruta,
        numVendas,
        leads:     leadsCount  ?? 0,
        showUp:    showUpCount ?? 0,
        pitch:     pitchCount  ?? 0,
        noGrupo:   (grupoRow as { no_grupo_agora: number | null } | null)?.no_grupo_agora ?? 0,
      })
    } finally {
      setCarregando(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mount: a aba usa a semana de CAPTAÇÃO atual como referência do seletor.
  // Entidades que ainda não chegaram nessa semana (webinário/vendas atrasados)
  // ficam zeradas naturalmente (range nulo / sem linhas).
  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const { data: atualRaw } = await supabase.rpc('get_semana_atual')
      let s = atualRaw as number | null

      if (!s) {
        const { data: ult } = await supabase
          .rpc('listar_semanas_trafego', { p_limit: 1, p_offset: 0 })
        const arr = (ult ?? []) as SemanaRange[]
        s = arr[0]?.numero ?? 1
      }

      if (cancelado) return
      semanaCarregada.current = s
      setSemanaAtual(s)
      setSemana(s)
      await buscarDados(s)
    })()
    return () => { cancelado = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const carregarSemana = useCallback((novaS: number) => {
    if (semanaCarregada.current === novaS) return
    semanaCarregada.current = novaS
    setSemana(novaS)
    buscarDados(novaS)
  }, [buscarDados])

  const inv = dados?.investido    ?? 0
  const rec = dados?.receitaBruta ?? 0
  const num = dados?.numVendas    ?? 0

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
    { label: 'LEADS',           valor: dados?.leads            ?? 0, formatado: fmtNum(dados?.leads            ?? 0) },
    { label: 'NO GRUPO',        valor: dados?.noGrupo          ?? 0, formatado: fmtNum(dados?.noGrupo          ?? 0) },
    { label: 'SHOW UP',         valor: dados?.showUp           ?? 0, formatado: fmtNum(dados?.showUp           ?? 0) },
    { label: 'PITCH',           valor: dados?.pitch            ?? 0, formatado: fmtNum(dados?.pitch            ?? 0) },
    { label: 'Nº VENDAS',       valor: dados?.numVendas        ?? 0, formatado: fmtNum(dados?.numVendas        ?? 0) },
  ]

  return (
    <div className="space-y-5">

      <SeletorSemana
        semana={semana}
        semanaAtual={semanaAtual}
        periodo={periodo}
        carregando={carregando}
        onMudar={carregarSemana}
      />

      <div className="flex flex-col lg:flex-row lg:items-start gap-5">

        {/* Coluna esquerda — 65%: KPIs e, logo abaixo, o gráfico de Lead Score */}
        <div className="lg:flex-[65] flex flex-col gap-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 auto-rows-min gap-4">
            {kpis.map(({ label, valor }) => (
              <KpiCard key={label} label={label} valor={valor} carregando={carregando} />
            ))}
          </div>

          {/* Distribuição de Lead Score por nota dos captados da semana — abaixo dos cards */}
          <LeadScoreGraficoSemana semana={semana} carregando={carregando} />
        </div>

        {/* Funil — 35% */}
        <div className="lg:flex-[35]">
          <Funil steps={funilSteps} carregando={carregando} />
        </div>

      </div>
    </div>
  )
}
