import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const META_API = 'https://graph.facebook.com/v21.0'

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

async function checkRateLimit(resp: Response) {
  const usage = resp.headers.get('X-App-Usage')
  if (!usage) return
  try {
    const { call_count, total_time } = JSON.parse(usage)
    if ((call_count ?? 0) > 80 || (total_time ?? 0) > 80) {
      console.log('[resync] Rate limit >80%, aguardando 60s...')
      await new Promise(r => setTimeout(r, 60_000))
    }
  } catch { /* ignore */ }
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
      console.error(`[resync] Meta API erro conta ${accountId}: ${msg}`)
      throw new Error(msg)
    }

    for (const row of json.data ?? []) yield row
    url = json.paging?.next ?? ''
  }
}

async function resyncAccount(
  account: { id: string; account_id: string; nome: string },
  token: string,
  dateStart: string,
  dateEnd: string
): Promise<void> {
  console.log(`[resync] → ${account.nome} (${dateStart} → ${dateEnd})`)

  let fetched = 0, inserted = 0, errors = 0
  const seenAdDate = new Map<string, number>()

  const { data: jobRun } = await supabase
    .from('integration_job_runs')
    .insert({
      integration:      'meta_ads_resync',
      account_id:       account.account_id,
      status:           'running',
      started_at:       new Date().toISOString(),
      date_range_start: dateStart,
      date_range_end:   dateEnd,
    })
    .select('id')
    .single()

  const jobRunId = jobRun?.id

  try {
    for await (const row of fetchInsights(account.account_id, token, dateStart, dateEnd)) {
      fetched++

      const adId  = (row.ad_id as string) ?? ''
      const date  = (row.date_start as string) ?? ''
      const spend = parseFloat((row.spend as string) ?? '0')

      if (adId) {
        const key = `${adId}::${date}`
        const prev = seenAdDate.get(key)
        if (prev !== undefined && prev >= spend) { fetched--; continue }
        seenAdDate.set(key, spend)
      }

      const { error: rawErr } = await supabase.from('raw_trafego').insert({
        id:            crypto.randomUUID(),
        payload:       { ...row, ad_account_id: account.account_id },
        ad_account_id: account.account_id,
        date_ref:      row.date_start,
        job_run_id:    jobRunId,
      })

      if (rawErr) { console.error('[resync] raw insert:', rawErr.message); errors++; continue }
      inserted++
    }

    const status = errors > 0 && fetched === 0 ? 'error' : 'success'
    if (jobRunId) {
      await supabase.from('integration_job_runs').update({
        status, finished_at: new Date().toISOString(),
        records_fetched: fetched, records_inserted: inserted, records_error: errors,
      }).eq('id', jobRunId)
    }

    console.log(`[resync] ✓ ${account.nome}: ${inserted} raws inseridos, ${errors} erros`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[resync] ✗ ${account.nome}: ${msg}`)
    if (jobRunId) {
      await supabase.from('integration_job_runs').update({
        status: 'error', finished_at: new Date().toISOString(),
        records_fetched: fetched, records_inserted: inserted,
        records_error: errors + 1, error_message: msg,
      }).eq('id', jobRunId)
    }
  }
}

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any

Deno.serve(async (req: Request) => {
  let body: Record<string, string> = {}
  try { body = await req.json() } catch { /* body opcional */ }

  // Default: últimos 15 dias
  const today = new Date()
  const d15   = new Date(today); d15.setDate(today.getDate() - 15)
  const dateStart = body.date_start ?? dateStr(d15)
  const dateEnd   = body.date_end   ?? dateStr(today)

  // Token Meta
  const { data: tokenData } = await supabase
    .from('integration_tokens')
    .select('vault_key')
    .eq('integration', 'meta_ads')
    .eq('ativo', true)
    .maybeSingle()

  if (!tokenData?.vault_key) {
    return new Response(JSON.stringify({ error: 'Token meta_ads não encontrado' }), { status: 500 })
  }
  const token = tokenData.vault_key as string

  // Contas ativas
  const { data: accounts } = await supabase
    .from('meta_ad_accounts')
    .select('id, account_id, nome')
    .eq('ativo', true)
    .order('nome')

  if (!accounts?.length) {
    return new Response(JSON.stringify({ error: 'Nenhuma conta ativa' }), { status: 404 })
  }

  const nomes = accounts.map(a => a.nome)
  console.log(`[resync] Iniciando background resync ${dateStart} → ${dateEnd} | ${accounts.length} contas`)

  // Processa todas as contas em BACKGROUND — não bloqueia a resposta HTTP
  EdgeRuntime.waitUntil((async () => {
    for (let i = 0; i < accounts.length; i++) {
      await resyncAccount(accounts[i], token, dateStart, dateEnd)
      // Pausa entre contas para não pressionar rate limit
      if (i < accounts.length - 1) {
        await new Promise(r => setTimeout(r, 5_000))
      }
    }
    console.log('[resync] Todas as contas concluídas!')
  })())

  // Retorna imediatamente — processamento continua em background
  return new Response(JSON.stringify({
    status:     'iniciado',
    date_start: dateStart,
    date_end:   dateEnd,
    contas:     nomes,
    mensagem:   'Resync iniciado em background. Acompanhe em integration_job_runs.',
  }), { headers: { 'Content-Type': 'application/json' } })
})
