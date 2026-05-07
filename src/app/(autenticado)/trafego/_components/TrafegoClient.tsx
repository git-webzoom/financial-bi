'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda, formatDataCurta } from '@/lib/format'
import TrafegoKpis from './TrafegoKpis'
import TrafegoFiltros from './TrafegoFiltros'
import TrafegoGrafico from './TrafegoGrafico'
import TrafegoTabela from './TrafegoTabela'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MetaAccount {
  account_id: string
  nome: string
}

export interface KpisTrafego {
  investido:  number
  impressoes: number
  cliques:    number
  alcance:    number
  leads:      number
}

export interface GraficoDia {
  data:      string
  investido: number
  leads:     number
}

export interface RegistroTrafego {
  id:            string
  ad_account_id: string
  campaign_name: string
  adset_name:    string
  ad_name:       string
  date_ref:      string
  amount_spent:  number | null
  impressions:   number | null
  link_clicks:   number | null
  leads:         number | null
}

export interface FiltrosTrafego {
  inicio:   string
  fim:      string
  conta:    string
  campanha: string
  adset:    string
  pagina:   number
}

interface Props {
  inicial: {
    kpis:           KpisTrafego
    grafico:        GraficoDia[]
    registros:      RegistroTrafego[]
    totalRegistros: number
    metaAccounts:   MetaAccount[]
    campanhas:      string[]
    adsets:         string[]
  }
  filtrosDefault: FiltrosTrafego
  pageSize:       number
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TrafegoClient({ inicial, filtrosDefault, pageSize }: Props) {
  const supabase  = createClient()
  const router    = useRouter()
  const pathname  = usePathname()
  const [, startTransition] = useTransition()

  const [filtros,    setFiltros]    = useState<FiltrosTrafego>(filtrosDefault)
  const [kpis,       setKpis]       = useState(inicial.kpis)
  const [grafico,    setGrafico]    = useState(inicial.grafico)
  const [registros,  setRegistros]  = useState(inicial.registros)
  const [total,      setTotal]      = useState(inicial.totalRegistros)
  const [campanhas,  setCampanhas]  = useState(inicial.campanhas)
  const [adsets,     setAdsets]     = useState(inicial.adsets)
  const [carregando, setCarregando] = useState(false)

  const buscar = useCallback(async (f: FiltrosTrafego) => {
    setCarregando(true)
    try {
      // KPIs
      let kpiQ = supabase
        .from('trafego')
        .select('amount_spent, impressions, link_clicks, reach, leads')
        .gte('date_ref', f.inicio)
        .lte('date_ref', f.fim)
      if (f.conta)    kpiQ = kpiQ.eq('ad_account_id', f.conta)
      if (f.campanha) kpiQ = kpiQ.eq('campaign_name', f.campanha)
      if (f.adset)    kpiQ = kpiQ.eq('adset_name', f.adset)
      const { data: kpiRows } = await kpiQ

      const novosKpis = (kpiRows ?? []).reduce(
        (acc, r) => ({
          investido:  acc.investido  + (r.amount_spent ?? 0),
          impressoes: acc.impressoes + (r.impressions  ?? 0),
          cliques:    acc.cliques    + (r.link_clicks  ?? 0),
          alcance:    acc.alcance    + (r.reach        ?? 0),
          leads:      acc.leads      + (r.leads        ?? 0),
        }),
        { investido: 0, impressoes: 0, cliques: 0, alcance: 0, leads: 0 }
      )
      setKpis(novosKpis)

      // Gráfico
      let gQ = supabase
        .from('trafego')
        .select('date_ref, amount_spent, leads')
        .gte('date_ref', f.inicio)
        .lte('date_ref', f.fim)
        .order('date_ref', { ascending: true })
        .limit(1000)
      if (f.conta)    gQ = gQ.eq('ad_account_id', f.conta)
      if (f.campanha) gQ = gQ.eq('campaign_name', f.campanha)
      if (f.adset)    gQ = gQ.eq('adset_name', f.adset)
      const { data: gRaw } = await gQ

      const gMap = new Map<string, { investido: number; leads: number }>()
      for (const r of gRaw ?? []) {
        const k = r.date_ref as string
        const cur = gMap.get(k) ?? { investido: 0, leads: 0 }
        gMap.set(k, {
          investido: cur.investido + (r.amount_spent ?? 0),
          leads:     cur.leads     + (r.leads        ?? 0),
        })
      }
      setGrafico(Array.from(gMap.entries()).map(([data, v]) => ({ data, ...v })))

      // Campanhas disponíveis
      let cQ = supabase.from('trafego').select('campaign_name')
        .gte('date_ref', f.inicio).lte('date_ref', f.fim)
      if (f.conta) cQ = cQ.eq('ad_account_id', f.conta)
      const { data: cRaw } = await cQ
      setCampanhas(Array.from(new Set((cRaw ?? []).map(r => r.campaign_name).filter(Boolean))).sort() as string[])

      // Adsets disponíveis
      let aQ = supabase.from('trafego').select('adset_name')
        .gte('date_ref', f.inicio).lte('date_ref', f.fim)
      if (f.conta)    aQ = aQ.eq('ad_account_id', f.conta)
      if (f.campanha) aQ = aQ.eq('campaign_name', f.campanha)
      const { data: aRaw } = await aQ
      setAdsets(Array.from(new Set((aRaw ?? []).map(r => r.adset_name).filter(Boolean))).sort() as string[])

      // Tabela
      let tQ = supabase
        .from('trafego')
        .select('id, ad_account_id, campaign_name, adset_name, ad_name, date_ref, amount_spent, impressions, link_clicks, leads', { count: 'exact' })
        .gte('date_ref', f.inicio)
        .lte('date_ref', f.fim)
        .order('date_ref', { ascending: false })
        .range(f.pagina * pageSize, f.pagina * pageSize + pageSize - 1)
      if (f.conta)    tQ = tQ.eq('ad_account_id', f.conta)
      if (f.campanha) tQ = tQ.eq('campaign_name', f.campanha)
      if (f.adset)    tQ = tQ.eq('adset_name', f.adset)
      const { data: tData, count: tCount } = await tQ
      setRegistros(tData ?? [])
      setTotal(tCount ?? 0)

      // Sync URL
      startTransition(() => {
        const p = new URLSearchParams()
        p.set('inicio', f.inicio)
        p.set('fim', f.fim)
        if (f.conta)    p.set('conta', f.conta)
        if (f.campanha) p.set('campanha', f.campanha)
        if (f.adset)    p.set('adset', f.adset)
        if (f.pagina)   p.set('pagina', String(f.pagina))
        router.replace(`${pathname}?${p.toString()}`, { scroll: false })
      })
    } finally {
      setCarregando(false)
    }
  }, [supabase, router, pathname, pageSize])

  function aplicarFiltros(novosFiltros: Partial<FiltrosTrafego>) {
    const f = { ...filtros, ...novosFiltros, pagina: 0 }
    setFiltros(f)
    buscar(f)
  }

  function mudarPagina(novaPagina: number) {
    const f = { ...filtros, pagina: novaPagina }
    setFiltros(f)
    buscar(f)
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Tráfego Pago</h2>
        <p className="text-xs text-gray-400 mt-0.5">Meta Ads — dados sincronizados automaticamente</p>
      </div>

      <TrafegoKpis kpis={kpis} />

      <TrafegoFiltros
        filtros={filtros}
        metaAccounts={inicial.metaAccounts}
        campanhas={campanhas}
        adsets={adsets}
        carregando={carregando}
        onChange={aplicarFiltros}
      />

      <TrafegoGrafico dados={grafico} />

      <TrafegoTabela
        registros={registros}
        metaAccounts={inicial.metaAccounts}
        total={total}
        pagina={filtros.pagina}
        pageSize={pageSize}
        carregando={carregando}
        onPagina={mudarPagina}
      />
    </div>
  )
}

export { formatMoeda, formatDataCurta }
