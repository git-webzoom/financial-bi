import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrafegoClient from './_components/TrafegoClient'

function dataISO(d: Date) {
  return d.toISOString().split('T')[0]
}

export default async function TrafegoPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Intervalo padrão: últimos 30 dias
  const hoje = new Date()
  const d30  = new Date(hoje); d30.setDate(hoje.getDate() - 30)
  const inicio = searchParams.inicio ?? dataISO(d30)
  const fim    = searchParams.fim    ?? dataISO(hoje)

  const conta    = searchParams.conta    ?? ''
  const campanha = searchParams.campanha ?? ''
  const adset    = searchParams.adset    ?? ''
  const pagina   = Number(searchParams.pagina ?? '0')
  const PAGE_SIZE = 25

  // Contas de anúncio para o filtro
  const { data: metaAccounts } = await supabase
    .from('meta_ad_accounts')
    .select('account_id, nome')
    .order('nome')

  // Campanhas distintas (filtradas por conta se houver)
  let campanhasQuery = supabase
    .from('trafego')
    .select('campaign_name')
    .gte('date_ref', inicio)
    .lte('date_ref', fim)
  if (conta) campanhasQuery = campanhasQuery.eq('ad_account_id', conta)
  const { data: campanhasRaw } = await campanhasQuery
  const campanhas = Array.from(new Set((campanhasRaw ?? []).map(r => r.campaign_name).filter(Boolean))).sort()

  // Adsets distintos (filtrados por campanha se houver)
  let adsetsQuery = supabase
    .from('trafego')
    .select('adset_name')
    .gte('date_ref', inicio)
    .lte('date_ref', fim)
  if (conta)    adsetsQuery = adsetsQuery.eq('ad_account_id', conta)
  if (campanha) adsetsQuery = adsetsQuery.eq('campaign_name', campanha)
  const { data: adsetsRaw } = await adsetsQuery
  const adsets = Array.from(new Set((adsetsRaw ?? []).map(r => r.adset_name).filter(Boolean))).sort()

  // KPIs agregados
  let kpiQuery = supabase
    .from('trafego')
    .select('amount_spent, impressions, link_clicks, reach, leads')
    .gte('date_ref', inicio)
    .lte('date_ref', fim)
  if (conta)    kpiQuery = kpiQuery.eq('ad_account_id', conta)
  if (campanha) kpiQuery = kpiQuery.eq('campaign_name', campanha)
  if (adset)    kpiQuery = kpiQuery.eq('adset_name', adset)
  const { data: kpiRows } = await kpiQuery

  const kpis = (kpiRows ?? []).reduce(
    (acc, r) => ({
      investido:   acc.investido   + (r.amount_spent ?? 0),
      impressoes:  acc.impressoes  + (r.impressions  ?? 0),
      cliques:     acc.cliques     + (r.link_clicks  ?? 0),
      alcance:     acc.alcance     + (r.reach        ?? 0),
      leads:       acc.leads       + (r.leads        ?? 0),
    }),
    { investido: 0, impressoes: 0, cliques: 0, alcance: 0, leads: 0 }
  )

  // Gráfico: investimento e leads por dia
  let graficoQuery = supabase
    .from('trafego')
    .select('date_ref, amount_spent, leads')
    .gte('date_ref', inicio)
    .lte('date_ref', fim)
    .order('date_ref', { ascending: true })
    .limit(1000)
  if (conta)    graficoQuery = graficoQuery.eq('ad_account_id', conta)
  if (campanha) graficoQuery = graficoQuery.eq('campaign_name', campanha)
  if (adset)    graficoQuery = graficoQuery.eq('adset_name', adset)
  const { data: graficoRaw } = await graficoQuery

  // Agrupa por dia
  const graficoMap = new Map<string, { investido: number; leads: number }>()
  for (const r of graficoRaw ?? []) {
    const k = r.date_ref as string
    const cur = graficoMap.get(k) ?? { investido: 0, leads: 0 }
    graficoMap.set(k, {
      investido: cur.investido + (r.amount_spent ?? 0),
      leads:     cur.leads     + (r.leads        ?? 0),
    })
  }
  const grafico = Array.from(graficoMap.entries()).map(([data, v]) => ({ data, ...v }))

  // Tabela paginada
  let tabelaQuery = supabase
    .from('trafego')
    .select('id, ad_account_id, campaign_name, adset_name, ad_name, date_ref, amount_spent, impressions, link_clicks, leads', { count: 'exact' })
    .gte('date_ref', inicio)
    .lte('date_ref', fim)
    .order('date_ref', { ascending: false })
    .range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE - 1)
  if (conta)    tabelaQuery = tabelaQuery.eq('ad_account_id', conta)
  if (campanha) tabelaQuery = tabelaQuery.eq('campaign_name', campanha)
  if (adset)    tabelaQuery = tabelaQuery.eq('adset_name', adset)
  const { data: registros, count: totalRegistros } = await tabelaQuery

  return (
    <TrafegoClient
      inicial={{
        kpis,
        grafico,
        registros:      registros ?? [],
        totalRegistros: totalRegistros ?? 0,
        metaAccounts:   metaAccounts ?? [],
        campanhas,
        adsets,
      }}
      filtrosDefault={{ inicio, fim, conta, campanha, adset, pagina }}
      pageSize={PAGE_SIZE}
    />
  )
}
