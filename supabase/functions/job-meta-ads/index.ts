import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const META_API = 'https://graph.facebook.com/v21.0'

// ad_id, adset_id, campaign_id são obrigatórios para deduplicação correta
const META_FIELDS = [
  'ad_id', 'ad_name',
  'adset_id', 'adset_name',
  'campaign_id', 'campaign_name',
  'date_start', 'date_stop',
  'impressions', 'reach', 'frequency', 'spend',
  'inline_link_clicks',
  'actions',
  'video_p25_watched_actions', 'video_p50_watched_actions',
  'video_p75_watched_actions', 'video_p95_watched_actions',
  'video_p100_watched_actions',
].join(',')

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function dailyRange(): { date_start: string; date_end: string } {
  const now = new Date()
  // Hoje + ontem: atualiza dados do dia atual e corrige ontem caso tenha mudado
  const today = new Date(now)
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  return { date_start: dateStr(yesterday), date_end: dateStr(today) }
}

function weeklyRange(): { date_start: string; date_end: string } {
  const now = new Date()
  // 7 dias: hoje até 6 dias atrás — varredura completa para garantir consistência
  const today = new Date(now)
  const d7 = new Date(today); d7.setDate(today.getDate() - 6)
  return { date_start: dateStr(d7), date_end: dateStr(today) }
}

async function checkRateLimit(resp: Response) {
  const usage = resp.headers.get('X-App-Usage')
  if (!usage) return
  try {
    const { call_count, total_time } = JSON.parse(usage)
    if ((call_count ?? 0) > 80 || (total_time ?? 0) > 80) {
      console.log('Rate limit >80%, aguardando 60s...')
      await new Promise(r => setTimeout(r, 60_000))
    }
  } catch { /* ignore */ }
}

async function getToken(): Promise<{ token: string; expires_at: string | null; tokenRowId: string } | null> {
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('id, vault_key, expires_at')
    .eq('integration', 'meta_ads')
    .eq('ativo', true)
    .maybeSingle()

  if (error || !data?.vault_key) {
    console.error('Token meta_ads nao encontrado:', error?.message)
    return null
  }

  return { token: data.vault_key as string, expires_at: data.expires_at, tokenRowId: data.id }
}

async function* fetchInsights(
  accountId: string,
  token: string,
  dateStart: string,
  dateEnd: string
): AsyncGenerator<Record<string, unknown>> {
  const timeRange = JSON.stringify({ since: dateStart, until: dateEnd })
  let url = `${META_API}/act_${accountId}/insights?` + new URLSearchParams({
    level: 'ad',
    time_increment: '1',
    limit: '500',
    access_token: token,
    time_range: timeRange,
    fields: META_FIELDS,
  }).toString()

  while (url) {
    const resp = await fetch(url)
    await checkRateLimit(resp)

    const json = await resp.json() as {
      data?: Record<string, unknown>[]
      error?: { message: string; code: number }
      paging?: { next?: string }
    }

    if (!resp.ok || json.error) {
      const msg = json.error?.message ?? `HTTP ${resp.status}`
      console.error(`Meta API erro conta ${accountId}: ${msg}`)
      throw new Error(msg)
    }

    for (const row of json.data ?? []) {
      yield row
    }

    url = json.paging?.next ?? ''
  }
}

// Busca reach deduplcado no nível de conta (igual à BM)
async function fetchReachConta(
  accountId: string,
  token: string,
  dateStart: string,
  dateEnd: string
): Promise<Array<{ date_ref: string; reach: number }>> {
  const timeRange = JSON.stringify({ since: dateStart, until: dateEnd })
  const url = `${META_API}/act_${accountId}/insights?` + new URLSearchParams({
    level: 'account',
    time_increment: '1',
    limit: '100',
    access_token: token,
    time_range: timeRange,
    fields: 'date_start,reach',
  }).toString()

  const resp = await fetch(url)
  await checkRateLimit(resp)

  const json = await resp.json() as {
    data?: Array<{ date_start: string; reach?: string }>
    error?: { message: string }
  }

  if (!resp.ok || json.error) {
    console.error(`Meta API reach conta ${accountId}: ${json.error?.message ?? resp.status}`)
    return []
  }

  return (json.data ?? []).map(r => ({
    date_ref: r.date_start,
    reach: parseInt(r.reach ?? '0', 10) || 0,
  }))
}

async function processAccount(
  account: { id: string; account_id: string; nome: string },
  token: string,
  dateStart: string,
  dateEnd: string
): Promise<{ fetched: number; inserted: number; errors: number; errorMsg?: string }> {
  let fetched = 0, inserted = 0, errors = 0
  let errorMsg: string | undefined

  const { data: jobRun } = await supabase
    .from('integration_job_runs')
    .insert({
      integration:      'meta_ads',
      account_id:       account.account_id,
      status:           'running',
      started_at:       new Date().toISOString(),
      date_range_start: dateStart,
      date_range_end:   dateEnd,
    })
    .select('id')
    .single()

  const jobRunId = jobRun?.id

  // Mapa de deduplicação dentro do mesmo job: ad_id+date -> maior spend visto
  // Isso evita processar duplicatas que a Meta retorna na paginação
  const seenAdDate = new Map<string, number>()

  try {
    for await (const row of fetchInsights(account.account_id, token, dateStart, dateEnd)) {
      fetched++

      const adId    = (row.ad_id as string) ?? ''
      const dateRef = (row.date_start as string) ?? ''
      const spend   = parseFloat((row.spend as string) ?? '0')

      // Deduplicação intra-job: se já vimos esse ad+date com spend maior, pula
      if (adId) {
        const key = `${adId}::${dateRef}`
        const prevSpend = seenAdDate.get(key)
        if (prevSpend !== undefined && prevSpend >= spend) {
          // Duplicata com valor menor — ignora sem contar como erro
          fetched-- // não conta como registro útil
          continue
        }
        seenAdDate.set(key, spend)
      }

      const payload = { ...row, ad_account_id: account.account_id }
      const rawId = crypto.randomUUID()

      const { error: rawErr } = await supabase
        .from('raw_trafego')
        .insert({
          id: rawId,
          payload,
          ad_account_id: account.account_id,
          date_ref: row.date_start,
          job_run_id: jobRunId,
        })

      if (rawErr) {
        console.error('Erro ao inserir raw_trafego:', rawErr.message)
        errors++
        continue
      }

      inserted++
    }

    // Busca reach deduplcado no nível de conta e salva em trafego_reach
    try {
      const reachDias = await fetchReachConta(account.account_id, token, dateStart, dateEnd)
      for (const { date_ref, reach } of reachDias) {
        await supabase.from('trafego_reach').upsert(
          { ad_account_id: account.account_id, date_ref, reach },
          { onConflict: 'ad_account_id,date_ref' }
        )
      }
    } catch (e) {
      console.warn(`Reach conta ${account.account_id}:`, e instanceof Error ? e.message : e)
    }

    const syncStatus = errors > 0 && fetched === 0 ? 'error' : 'success'

    await Promise.all([
      supabase.from('meta_ad_accounts')
        .update({ last_sync_at: new Date().toISOString(), last_sync_status: syncStatus })
        .eq('id', account.id),
      jobRunId ? supabase.from('integration_job_runs').update({
        status:           syncStatus,
        finished_at:      new Date().toISOString(),
        records_fetched:  fetched,
        records_inserted: inserted,  // raws gravados — processamento ocorre via cron em background
        records_error:    errors,
      }).eq('id', jobRunId) : Promise.resolve(),
    ])

  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`Erro na conta ${account.account_id}:`, errorMsg)

    await Promise.all([
      supabase.from('meta_ad_accounts')
        .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'error' })
        .eq('id', account.id),
      jobRunId ? supabase.from('integration_job_runs').update({
        status:           'error',
        finished_at:      new Date().toISOString(),
        records_fetched:  fetched,
        records_inserted: inserted,
        records_error:    errors + 1,
        error_message:    errorMsg,
      }).eq('id', jobRunId) : Promise.resolve(),
    ])

    errors++
  }

  return { fetched, inserted, errors, errorMsg }
}

Deno.serve(async (req: Request) => {
  let body: Record<string, string> = {}
  try { body = await req.json() } catch { /* body opcional */ }

  // Prioridade: date_start/date_end explícitos > mode > daily (padrão)
  const { date_start, date_end } = body.date_start
    ? { date_start: body.date_start, date_end: body.date_end }
    : body.mode === 'weekly'
      ? weeklyRange()
      : dailyRange()

  const filterAccountId: string | undefined = body.account_id

  const tokenData = await getToken()
  if (!tokenData) {
    return new Response(JSON.stringify({ error: 'Token nao encontrado' }), { status: 500 })
  }

  let accountsQuery = supabase
    .from('meta_ad_accounts')
    .select('id, account_id, nome')
    .eq('ativo', true)

  if (filterAccountId) {
    accountsQuery = accountsQuery.eq('account_id', filterAccountId)
  }

  const { data: accounts, error: accErr } = await accountsQuery
  if (accErr || !accounts?.length) {
    return new Response(JSON.stringify({ error: 'Nenhuma conta ativa' }), { status: 404 })
  }

  let totalFetched = 0, totalInserted = 0, totalErrors = 0
  const errorMsgs: string[] = []

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i]
    console.log(`Processando conta ${i + 1}/${accounts.length}: ${account.nome} (act_${account.account_id})`)
    const result = await processAccount(account, tokenData.token, date_start, date_end)
    totalFetched  += result.fetched
    totalInserted += result.inserted
    totalErrors   += result.errors
    if (result.errorMsg) errorMsgs.push(`${account.nome}: ${result.errorMsg}`)

    if (i < accounts.length - 1) {
      await new Promise(r => setTimeout(r, 2_000))
    }
  }

  await supabase.from('integration_tokens').update({
    last_sync_at:     new Date().toISOString(),
    last_sync_status: totalErrors > 0 && totalFetched === 0 ? 'error' : 'success',
  }).eq('id', tokenData.tokenRowId)

  return new Response(JSON.stringify({
    status:           totalErrors > 0 && totalFetched === 0 ? 'error' : 'success',
    records_fetched:  totalFetched,
    records_inserted: totalInserted,
    records_error:    totalErrors,
    errors:           errorMsgs,
  }), { headers: { 'Content-Type': 'application/json' } })
})
