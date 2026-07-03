'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  ScatterChart, Scatter, ZAxis, CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda } from '@/lib/format'
import type { RegraFiltro } from '@/lib/filtros-personalizados'

// Performance por anúncio das abas venda_direta (TPW/Desafio). Busca a RPC get_trafego_ads_aba
// (1 linha por anúncio, já agregada e com as taxas calculadas no banco) e renderiza:
//   1) tabela (desktop) / cards (mobile) com Tipo, CPM, Hook, Hold, Click, Gasto, Checkouts + VENDAS por anúncio
//   2) ranking horizontal por gasto
//   3) scatter Hook Rate × Gasto (só anúncios de vídeo)
//
// VENDAS por anúncio (Nº Vendas, R$, CPA, ROAS): cruzamento em memória vendas.utm_content === trafego.ad_name.
// As compras chegam pela prop `vendas` (as MESMAS que alimentam os KPIs da aba, 1 linha/compra). A soma das
// vendas atribuídas + a linha "Sem anúncio identificado" FECHA 100% com o KPI "Nº de Vendas" / "R$ Vendas".
// ~84% das vendas TPW não têm utm_content casável e caem em "Sem anúncio" (esperado).

export interface AdPerf {
  ad_name:             string
  ad_id:               string | null
  tipo:                'video' | 'imagem'
  gasto:               number
  impressoes:          number
  cpm:                 number | null
  hook_rate:           number | null  // fração 0–1 (NULL p/ imagem)
  hold_rate:           number | null  // fração 0–1 (NULL p/ imagem)
  click_rate:          number | null  // fração 0–1
  link_clicks:         number
  checkouts_initiated: number
  video_views_3s:      number
  video_watches_75:    number
}

// ─── Limiares de cor das taxas (ajuste aqui se quiser outra régua de "bom/ruim") ───────────────
// Faixas calibradas para tráfego frio Meta (Hook global observado ~9%). verde = bom, vermelho = ruim.
const FAIXA_HOOK  = { bom: 0.15, medio: 0.08 }  // ≥15% verde · 8–15% amarelo · <8% vermelho
const FAIXA_HOLD  = { bom: 0.15, medio: 0.08 }
const FAIXA_CLICK = { bom: 0.40, medio: 0.20 }  // click de vídeo (cliques ÷ 75% view)

const COR_BOM   = '#4ADE80'
const COR_MEDIO = '#FACC15'
const COR_RUIM  = '#F87171'
const COR_NA    = '#444444'
const GOLD      = '#C9A84C'

function corTaxa(valor: number | null, faixa: { bom: number; medio: number }): string {
  if (valor == null) return COR_NA
  if (valor >= faixa.bom) return COR_BOM
  if (valor >= faixa.medio) return COR_MEDIO
  return COR_RUIM
}

// ─── Formatação ────────────────────────────────────────────────────────────────────────────────
const fmtNum = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR')
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}
// Nome do anúncio costuma ter prefixo "adNN-metaads-..." e o nome real entre colchetes — encurta p/ leitura
function nomeCurto(ad: string): string {
  const m = ad.match(/\[([^\]]+)\]/)
  return (m ? m[1] : ad).trim()
}

// ─── Badge de tipo ───────────────────────────────────────────────────────────────────────────
function TipoBadge({ tipo }: { tipo: 'video' | 'imagem' }) {
  const isVid = tipo === 'video'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
      style={{
        backgroundColor: isVid ? 'rgba(74,222,128,0.12)' : 'rgba(96,165,250,0.12)',
        color: isVid ? '#4ADE80' : '#60A5FA',
      }}
    >
      {isVid ? '🎬 Vídeo' : '🖼️ Imagem'}
    </span>
  )
}

// Célula de taxa com mini-barra colorida
function TaxaCell({ valor, faixa }: { valor: number | null; faixa: { bom: number; medio: number } }) {
  const cor = corTaxa(valor, faixa)
  const pctLargura = valor == null ? 0 : Math.min(valor * 100, 100)
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1E1E1E' }}>
        <div className="h-full rounded-full" style={{ width: `${pctLargura}%`, backgroundColor: cor }} />
      </div>
      <span className="text-xs tabular-nums" style={{ color: valor == null ? '#555555' : '#DDDDDD', minWidth: 42, textAlign: 'right' }}>
        {fmtPct(valor)}
      </span>
    </div>
  )
}

// ─── Tooltips dos gráficos ───────────────────────────────────────────────────────────────────
interface RankDado { nome: string; gasto: number; cpm: number | null; tipo: string }
function TooltipRank({ active, payload }: { active?: boolean; payload?: Array<{ payload: RankDado }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs max-w-[240px]" style={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', color: '#FFFFFF' }}>
      <p className="font-bold mb-1 break-words">{d.nome}</p>
      <p>Gasto: {formatMoeda(d.gasto)}</p>
      <p>CPM: {d.cpm != null ? formatMoeda(d.cpm) : '—'}</p>
    </div>
  )
}

interface ScatterDado { nome: string; hook: number; gasto: number }
function TooltipScatter({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterDado }> }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="px-3 py-2 rounded-lg text-xs max-w-[240px]" style={{ backgroundColor: '#1A1A1A', border: '1px solid #333333', color: '#FFFFFF' }}>
      <p className="font-bold mb-1 break-words">{d.nome}</p>
      <p>Hook Rate: {fmtPct(d.hook)}</p>
      <p>Gasto: {formatMoeda(d.gasto)}</p>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────────────────────
type Ordenacao = 'gasto' | 'hook' | 'cpm' | 'vendas' | 'roas'

// Shape mínimo de uma COMPRA (1 linha/compra) — evita acoplar ao tipo Venda completo.
// utm_content herdado da MÃE (via ...mae em montarComprasFiltradas); valor_total_grupo = mãe + bumps aprovados.
export interface VendaAttr {
  utm_content:        string | null
  valor_total_grupo?: number | null
  valor_venda?:       number | null  // fallback defensivo
}

interface Props {
  filtroTrafegoId?: string | null
  inicio:           string  // 'YYYY-MM-DD'
  fim:              string
  vendas?:          VendaAttr[]  // compras (1 linha/compra) já filtradas/aprovadas — mesmas dos KPIs da aba
}

export default function TabelaAdsPerformance({ filtroTrafegoId = null, inicio, fim, vendas = [] }: Props) {
  const supabase = createClient()
  const [ads,        setAds]        = useState<AdPerf[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ordenacao,  setOrdenacao]  = useState<Ordenacao>('gasto')

  const buscar = useCallback(async () => {
    setCarregando(true)
    try {
      // Regras do filtro de tráfego da aba (mesmo shape de filtros_personalizados_regras).
      // Sem filtro → array vazio → a RPC traz todos os anúncios do período.
      const { data: regrasRaw } = filtroTrafegoId
        ? await supabase.from('filtros_personalizados_regras')
            .select('campo, operador, valor, ordem').eq('filtro_id', filtroTrafegoId).order('ordem')
        : { data: [] as RegraFiltro[] }

      const { data, error } = await supabase.rpc('get_trafego_ads_aba', {
        p_inicio: inicio,
        p_fim:    fim,
        p_regras: (regrasRaw ?? []) as RegraFiltro[],
      })
      if (error) { console.error('get_trafego_ads_aba:', error.message); setAds([]) }
      else setAds((data ?? []) as AdPerf[])
    } finally {
      setCarregando(false)
    }
  }, [filtroTrafegoId, inicio, fim, supabase])

  useEffect(() => { buscar() }, [buscar])

  // ─── Vendas por anúncio (cruzamento em memória: utm_content === ad_name) ──────────────────────
  // Normaliza só com trim() — o banco (medido) mostra 0 matches ganhos por lower(): utm_content e ad_name
  // batem por igualdade exata. Se um dia surgir divergência de caixa, trocar por .trim().toLowerCase()
  // AQUI e no Set `conhecidos` simultaneamente.
  const norm = (s: string | null | undefined) => (s ?? '').trim()
  const valorCompra = (v: VendaAttr) => v.valor_total_grupo ?? v.valor_venda ?? 0

  const { porAnuncio, semAnuncio, totVendas, totReceita } = useMemo(() => {
    // "conhecidos" = SOMENTE os ad_names presentes no array `ads` renderizado (não o banco todo).
    // Assim toda venda cujo anúncio não está na tabela (utm vazio/lixo, ou anúncio descartado pelo HAVING
    // da RPC) cai em "Sem anúncio" e a soma FECHA com o KPI, independentemente de dados futuros.
    const conhecidos = new Set(ads.map(a => norm(a.ad_name)))
    const mapa = new Map<string, { nVendas: number; receita: number }>()
    let semN = 0, semR = 0, totR = 0

    for (const v of vendas) {
      const key = norm(v.utm_content)
      const val = valorCompra(v)
      totR += val
      if (key !== '' && conhecidos.has(key)) {
        const cur = mapa.get(key) ?? { nVendas: 0, receita: 0 }
        cur.nVendas += 1
        cur.receita += val
        mapa.set(key, cur)
      } else {
        semN += 1
        semR += val
      }
    }

    // Invariante (dev-only): atribuídas + sem anúncio == total de compras (== KPI Nº de Vendas).
    if (process.env.NODE_ENV !== 'production' && vendas.length > 0) {
      let soma = semN
      mapa.forEach(x => { soma += x.nVendas })
      if (soma !== vendas.length) {
        console.warn(`[TabelaAdsPerformance] invariante furou: Σ vendas por anúncio (${soma}) != compras (${vendas.length})`)
      }
    }

    return { porAnuncio: mapa, semAnuncio: { nVendas: semN, receita: semR }, totVendas: vendas.length, totReceita: totR }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads, vendas])

  const vendasDe = (adName: string) => porAnuncio.get(norm(adName)) ?? { nVendas: 0, receita: 0 }
  const cpaDe  = (nV: number, gasto: number)  => (nV > 0    ? gasto / nV    : null)  // 0 vendas → traço
  const roasDe = (rec: number, gasto: number) => (gasto > 0 ? rec / gasto   : null)  // 0 gasto  → traço

  const adsOrdenados = useMemo(() => {
    const arr = [...ads]
    if (ordenacao === 'gasto')  arr.sort((a, b) => b.gasto - a.gasto)
    if (ordenacao === 'cpm')    arr.sort((a, b) => (b.cpm ?? 0) - (a.cpm ?? 0))
    if (ordenacao === 'hook')   arr.sort((a, b) => (b.hook_rate ?? -1) - (a.hook_rate ?? -1))
    if (ordenacao === 'vendas') arr.sort((a, b) => vendasDe(b.ad_name).nVendas - vendasDe(a.ad_name).nVendas)
    if (ordenacao === 'roas')   arr.sort((a, b) => {
      const ra = roasDe(vendasDe(a.ad_name).receita, a.gasto) ?? -1
      const rb = roasDe(vendasDe(b.ad_name).receita, b.gasto) ?? -1
      return rb - ra
    })
    return arr
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads, ordenacao, porAnuncio])

  // Dados dos gráficos (derivados da mesma busca — sem nova query)
  const dadosRank: RankDado[] = useMemo(
    () => [...ads].sort((a, b) => b.gasto - a.gasto).slice(0, 10)
      .map(a => ({ nome: nomeCurto(a.ad_name), gasto: a.gasto, cpm: a.cpm, tipo: a.tipo })),
    [ads]
  )
  const dadosScatter: ScatterDado[] = useMemo(
    () => ads.filter(a => a.tipo === 'video' && a.hook_rate != null && a.gasto > 0)
      .map(a => ({ nome: nomeCurto(a.ad_name), hook: a.hook_rate as number, gasto: a.gasto })),
    [ads]
  )

  // Totais (rodapé). Mídia (gasto/CPM) da RPC; vendas (nº/R$/CPA/ROAS) do cruzamento — devem bater
  // com os KPIs da aba (mesmo gasto total, mesmas compras totais).
  const totGasto = ads.reduce((s, a) => s + a.gasto, 0)
  const totImpr  = ads.reduce((s, a) => s + a.impressoes, 0)
  const cpmGeral = totImpr > 0 ? (totGasto / totImpr) * 1000 : null
  const cpaGeral  = cpaDe(totVendas, totGasto)
  const roasGeral = roasDe(totReceita, totGasto)

  const btnOrd = (val: Ordenacao, label: string) => (
    <button
      onClick={() => setOrdenacao(val)}
      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
      style={{
        backgroundColor: ordenacao === val ? GOLD : 'transparent',
        color: ordenacao === val ? '#0A0A0A' : '#888888',
        border: `1px solid ${ordenacao === val ? GOLD : '#222222'}`,
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      {/* ─── Tabela / cards ─────────────────────────────────────────────────── */}
      <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Performance por Anúncio</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] mr-1" style={{ color: '#666666' }}>ordenar:</span>
            {btnOrd('gasto', 'Gasto')}
            {btnOrd('hook', 'Hook')}
            {btnOrd('cpm', 'CPM')}
            {btnOrd('vendas', 'Vendas')}
            {btnOrd('roas', 'ROAS')}
          </div>
        </div>

        {carregando ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded animate-pulse" style={{ backgroundColor: '#1A1A1A' }} />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: '#555555' }}>
            Nenhum anúncio com gasto/impressões no período.
          </div>
        ) : (
          <>
            {/* Desktop: tabela. min-w garante que, quando não couber (notebook/tela média), a tabela
                ROLA na horizontal (overflow-x-auto do pai) em vez de espremer as 11 colunas. */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm" style={{ color: '#DDDDDD' }}>
                <thead>
                  <tr style={{ color: '#777777' }} className="text-[11px] uppercase tracking-wide text-left whitespace-nowrap">
                    <th className="pb-2 font-medium">Anúncio</th>
                    <th className="pb-2 font-medium text-right">Gasto</th>
                    <th className="pb-2 font-medium text-right">CPM</th>
                    <th className="pb-2 font-medium">Hook</th>
                    <th className="pb-2 font-medium">Hold</th>
                    <th className="pb-2 font-medium">Click</th>
                    <th className="pb-2 font-medium text-right">Checkouts</th>
                    <th className="pb-2 pl-4 font-medium text-right" style={{ color: GOLD, borderLeft: '1px solid #2A1E08' }}>Nº Vendas</th>
                    <th className="pb-2 pl-4 font-medium text-right" style={{ color: GOLD }}>R$ Vendas</th>
                    <th className="pb-2 pl-4 font-medium text-right" style={{ color: GOLD }}>CPA</th>
                    <th className="pb-2 pl-4 font-medium text-right" style={{ color: GOLD }}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {adsOrdenados.map((a) => {
                    const vd   = vendasDe(a.ad_name)
                    const cpa  = cpaDe(vd.nVendas, a.gasto)
                    const roas = roasDe(vd.receita, a.gasto)
                    return (
                    <tr key={a.ad_id ?? a.ad_name} style={{ borderTop: '1px solid #1A1A1A' }}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <TipoBadge tipo={a.tipo} />
                          <span className="truncate max-w-[260px]" title={a.ad_name}>{nomeCurto(a.ad_name)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: '#FFFFFF' }}>{formatMoeda(a.gasto)}</td>
                      <td className="py-2.5 text-right tabular-nums whitespace-nowrap">{a.cpm != null ? formatMoeda(a.cpm) : '—'}</td>
                      <td className="py-2.5 pr-3"><TaxaCell valor={a.hook_rate} faixa={FAIXA_HOOK} /></td>
                      <td className="py-2.5 pr-3"><TaxaCell valor={a.hold_rate} faixa={FAIXA_HOLD} /></td>
                      <td className="py-2.5 pr-3"><TaxaCell valor={a.click_rate} faixa={FAIXA_CLICK} /></td>
                      <td className="py-2.5 text-right tabular-nums">{fmtNum(a.checkouts_initiated)}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap" style={{ color: vd.nVendas > 0 ? '#FFFFFF' : '#555555', borderLeft: '1px solid #2A1E08' }}>{fmtNum(vd.nVendas)}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap" style={{ color: vd.receita > 0 ? '#FFFFFF' : '#555555' }}>{vd.receita > 0 ? formatMoeda(vd.receita) : '—'}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap">{cpa != null ? formatMoeda(cpa) : '—'}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap" style={{ color: roas != null && roas >= 1 ? COR_BOM : '#DDDDDD' }}>{roas != null ? roas.toFixed(2) + 'x' : '—'}</td>
                    </tr>
                    )
                  })}

                  {/* Vendas sem anúncio identificável (utm vazio, lixo, ou anúncio fora da tabela).
                      SEMPRE por último, fora da ordenação. Fecha o total com o KPI Nº de Vendas. */}
                  {vendas.length > 0 && (
                    <tr style={{ borderTop: '1px solid #1A1A1A' }}>
                      <td className="py-2.5 pr-3 italic whitespace-nowrap" colSpan={6} style={{ color: '#888888' }}>Sem anúncio identificado</td>
                      <td className="py-2.5 text-right tabular-nums" style={{ color: '#666666' }}>—</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap" style={{ color: '#AAAAAA', borderLeft: '1px solid #2A1E08' }}>{fmtNum(semAnuncio.nVendas)}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums whitespace-nowrap" style={{ color: '#AAAAAA' }}>{semAnuncio.receita > 0 ? formatMoeda(semAnuncio.receita) : '—'}</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums" style={{ color: '#666666' }}>—</td>
                      <td className="py-2.5 pl-4 text-right tabular-nums" style={{ color: '#666666' }}>—</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid #2A2A2A', color: '#AAAAAA' }} className="text-xs">
                    <td className="pt-2.5 font-semibold" style={{ color: '#FFFFFF' }}>{ads.length} anúncios</td>
                    <td className="pt-2.5 text-right tabular-nums font-semibold" style={{ color: '#FFFFFF' }}>{formatMoeda(totGasto)}</td>
                    <td className="pt-2.5 text-right tabular-nums">{cpmGeral != null ? formatMoeda(cpmGeral) : '—'}</td>
                    <td className="pt-2.5" colSpan={4} />
                    <td className="pt-2.5 pl-4 text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: '#FFFFFF', borderLeft: '1px solid #2A1E08' }}>{fmtNum(totVendas)}</td>
                    <td className="pt-2.5 pl-4 text-right tabular-nums font-semibold whitespace-nowrap" style={{ color: '#FFFFFF' }}>{formatMoeda(totReceita)}</td>
                    <td className="pt-2.5 pl-4 text-right tabular-nums whitespace-nowrap">{cpaGeral != null ? formatMoeda(cpaGeral) : '—'}</td>
                    <td className="pt-2.5 pl-4 text-right tabular-nums whitespace-nowrap">{roasGeral != null ? roasGeral.toFixed(2) + 'x' : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2.5">
              {adsOrdenados.map((a) => {
                const vd   = vendasDe(a.ad_name)
                const cpa  = cpaDe(vd.nVendas, a.gasto)
                const roas = roasDe(vd.receita, a.gasto)
                return (
                <div key={a.ad_id ?? a.ad_name} className="rounded-lg p-3" style={{ backgroundColor: '#0D0D0D', border: '1px solid #1E1E1E' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TipoBadge tipo={a.tipo} />
                    <span className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }} title={a.ad_name}>{nomeCurto(a.ad_name)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div className="flex justify-between"><span style={{ color: '#777777' }}>Gasto</span><span style={{ color: '#FFFFFF' }}>{formatMoeda(a.gasto)}</span></div>
                    <div className="flex justify-between"><span style={{ color: '#777777' }}>CPM</span><span>{a.cpm != null ? formatMoeda(a.cpm) : '—'}</span></div>
                    <div className="flex justify-between"><span style={{ color: '#777777' }}>Checkouts</span><span>{fmtNum(a.checkouts_initiated)}</span></div>
                    <div className="flex justify-between"><span style={{ color: '#777777' }}>Click</span><span style={{ color: corTaxa(a.click_rate, FAIXA_CLICK) }}>{fmtPct(a.click_rate)}</span></div>
                    <div className="flex justify-between"><span style={{ color: '#777777' }}>Hook</span><span style={{ color: corTaxa(a.hook_rate, FAIXA_HOOK) }}>{fmtPct(a.hook_rate)}</span></div>
                    <div className="flex justify-between"><span style={{ color: '#777777' }}>Hold</span><span style={{ color: corTaxa(a.hold_rate, FAIXA_HOLD) }}>{fmtPct(a.hold_rate)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mt-2 pt-2" style={{ borderTop: '1px solid #2A1E08' }}>
                    <div className="flex justify-between"><span style={{ color: GOLD }}>Nº Vendas</span><span style={{ color: vd.nVendas > 0 ? '#FFFFFF' : '#555555' }}>{fmtNum(vd.nVendas)}</span></div>
                    <div className="flex justify-between"><span style={{ color: GOLD }}>R$ Vendas</span><span style={{ color: vd.receita > 0 ? '#FFFFFF' : '#555555' }}>{vd.receita > 0 ? formatMoeda(vd.receita) : '—'}</span></div>
                    <div className="flex justify-between"><span style={{ color: GOLD }}>CPA</span><span>{cpa != null ? formatMoeda(cpa) : '—'}</span></div>
                    <div className="flex justify-between"><span style={{ color: GOLD }}>ROAS</span><span style={{ color: roas != null && roas >= 1 ? COR_BOM : '#DDDDDD' }}>{roas != null ? roas.toFixed(2) + 'x' : '—'}</span></div>
                  </div>
                </div>
                )
              })}

              {/* Card "Sem anúncio identificado" — fecha o total com o KPI Nº de Vendas */}
              {vendas.length > 0 && (
                <div className="rounded-lg p-3 italic" style={{ backgroundColor: '#0D0D0D', border: '1px dashed #2A1E08' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: '#888888' }}>Sem anúncio identificado</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs not-italic">
                    <div className="flex justify-between"><span style={{ color: GOLD }}>Nº Vendas</span><span style={{ color: '#AAAAAA' }}>{fmtNum(semAnuncio.nVendas)}</span></div>
                    <div className="flex justify-between"><span style={{ color: GOLD }}>R$ Vendas</span><span style={{ color: '#AAAAAA' }}>{semAnuncio.receita > 0 ? formatMoeda(semAnuncio.receita) : '—'}</span></div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Gráficos ───────────────────────────────────────────────────────── */}
      {!carregando && ads.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Ranking por gasto */}
          <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#FFFFFF' }}>Top anúncios por gasto</p>
            <p className="text-[11px] mb-3" style={{ color: '#666666' }}>onde o investimento está concentrado (top 10)</p>
            <ResponsiveContainer width="100%" height={Math.max(dadosRank.length * 34, 120)}>
              <BarChart data={dadosRank} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fill: '#AAAAAA', fontSize: 11 }} tickLine={false} axisLine={false} interval={0} />
                <Tooltip content={<TooltipRank />} cursor={{ fill: '#1A1A1A' }} />
                <Bar dataKey="gasto" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {dadosRank.map((d, i) => (
                    <Cell key={i} fill={d.tipo === 'video' ? '#4ADE80' : '#60A5FA'} />
                  ))}
                  <LabelList dataKey="gasto" position="right" fill="#CCCCCC" fontSize={11}
                    formatter={(v: React.ReactNode) => formatMoeda(Number(v))} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 pt-3" style={{ borderTop: '1px solid #1E1E1E' }}>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#AAAAAA' }}><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#4ADE80' }} /> Vídeo</span>
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#AAAAAA' }}><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#60A5FA' }} /> Imagem</span>
            </div>
          </div>

          {/* Scatter Hook × Gasto (só vídeo) */}
          <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: '#FFFFFF' }}>Hook Rate × Gasto <span className="font-normal" style={{ color: '#666666' }}>(vídeos)</span></p>
            <p className="text-[11px] mb-3" style={{ color: '#666666' }}>quem prende atenção (↑) vs quanto consome (→) — alvo: alto e à direita</p>
            {dadosScatter.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-center" style={{ color: '#555555' }}>
                Sem anúncios de vídeo com dados no período.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="#1A1A1A" />
                  <XAxis type="number" dataKey="gasto" name="Gasto" tick={{ fill: '#888888', fontSize: 10 }}
                    tickLine={false} axisLine={{ stroke: '#222222' }} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="number" dataKey="hook" name="Hook" tick={{ fill: '#888888', fontSize: 10 }}
                    tickLine={false} axisLine={{ stroke: '#222222' }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip content={<TooltipScatter />} cursor={{ strokeDasharray: '3 3', stroke: '#333333' }} />
                  <Scatter data={dadosScatter} fill={GOLD} isAnimationActive={false} />
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
