import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const BASE_URL = 'https://sendflow.pro/sendapi'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// Retorna ["YYYY-MM-DD"] com apenas hoje
function dailyDates(): string[] {
  return [dateStr(new Date())]
}

// Retorna os últimos N dias inclusive hoje: ["YYYY-MM-DD", ...]
function lookbackDates(days = 5): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    result.push(dateStr(d))
  }
  return result
}

// Converte "DDMMYYYY" → "YYYY-MM-DD"
function parseSendflowDate(raw: string): string | null {
  if (raw.length !== 8) return null
  const dd = raw.slice(0, 2)
  const mm = raw.slice(2, 4)
  const yyyy = raw.slice(4, 8)
  if (isNaN(Number(dd)) || isNaN(Number(mm)) || isNaN(Number(yyyy))) return null
  return `${yyyy}-${mm}-${dd}`
}

async function getToken(): Promise<string | null> {
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('vault_key')
    .eq('integration', 'sendflow')
    .eq('ativo', true)
    .maybeSingle()

  if (error || !data?.vault_key) {
    console.error('Token Sendflow não encontrado:', error)
    return null
  }
  return data.vault_key
}

async function registrarJobRun(
  status: 'success' | 'error',
  recordsFetched: number,
  recordsInserted: number,
  errorMessage?: string,
) {
  await supabase.from('integration_job_runs').insert({
    integration: 'sendflow',
    status,
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    records_fetched: recordsFetched,
    records_inserted: recordsInserted,
    error_message: errorMessage ?? null,
  })

  await supabase
    .from('integration_tokens')
    .update({ last_sync_at: new Date().toISOString(), last_sync_status: status })
    .eq('integration', 'sendflow')
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({})) as { mode?: string; days?: number }
  const mode = body.mode === 'lookback' ? 'lookback' : 'daily'
  const days = (mode === 'lookback' && body.days && body.days > 0) ? body.days : 5

  const targetDates = new Set(mode === 'lookback' ? lookbackDates(days) : dailyDates())

  const token = await getToken()
  if (!token) {
    await registrarJobRun('error', 0, 0, 'Token Sendflow não configurado ou inativo')
    return json({ error: 'token not found' }, 500)
  }

  const headers = { Authorization: `Bearer ${token}` }

  const { data: campanhas } = await supabase
    .from('sendflow_campanhas')
    .select('id')
    .eq('coletar_metricas', true)

  if (!campanhas?.length) {
    await registrarJobRun('success', 0, 0)
    return json({ ok: true, message: 'Nenhuma campanha com coleta de métricas ativa' })
  }

  let totalFetched = 0
  let totalUpserted = 0
  const erros: string[] = []

  for (const camp of campanhas) {
    try {
      await delay(500)
      const res = await fetch(`${BASE_URL}/releases/${camp.id}/analytics`, { headers })

      if (!res.ok) {
        if (res.status === 429) {
          const errBody = await res.json() as { retryAfterMs?: number }
          const waitMs = errBody.retryAfterMs ?? 60_000
          console.log(`Rate limit analytics ${camp.id}, aguardando ${waitMs}ms`)
          await delay(waitMs + 1000)
          erros.push(`campanha ${camp.id}: rate limit`)
          continue
        }
        erros.push(`campanha ${camp.id}: ${res.status}`)
        continue
      }

      const analytics = await res.json() as {
        add?:    { total?: number; dates?: Record<string, number> }
        remove?: { total?: number; dates?: Record<string, number> }
        clicks?: { total?: number; dates?: Record<string, number> }
      }

      const addDates    = analytics.add?.dates    ?? {}
      const removeDates = analytics.remove?.dates ?? {}
      const clicksDates = analytics.clicks?.dates ?? {}

      // Une todas as datas retornadas pela API e filtra pelo range desejado
      const todasDatas = Array.from(new Set([
        ...Object.keys(addDates),
        ...Object.keys(removeDates),
        ...Object.keys(clicksDates),
      ]))

      for (const rawDate of todasDatas) {
        const data = parseSendflowDate(rawDate)
        if (!data) continue
        if (!targetDates.has(data)) continue  // ignora datas fora do range

        totalFetched++

        const { error: upsertErr } = await supabase
          .from('sendflow_metricas')
          .upsert({
            campanha_id: camp.id,
            data,
            adicionados: addDates[rawDate]    ?? 0,
            removidos:   removeDates[rawDate] ?? 0,
            cliques:     clicksDates[rawDate] ?? 0,
            synced_at:   new Date().toISOString(),
          }, { onConflict: 'campanha_id,data' })

        if (!upsertErr) totalUpserted++
        else erros.push(`campanha ${camp.id} data ${data}: ${upsertErr.message}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`campanha ${camp.id}: ${msg}`)
    }
  }

  const status = erros.length > 0 && totalUpserted === 0 ? 'error' : 'success'
  await registrarJobRun(status, totalFetched, totalUpserted, erros.length ? erros.slice(0, 3).join('; ') : undefined)

  // Recalcula KPIs das semanas afetadas pelo range processado
  const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
  if (semanaAtual) {
    await supabase.rpc('upsert_grupos_kpis_semana', { p_numero: semanaAtual })
    if (mode === 'lookback') {
      await supabase.rpc('upsert_grupos_kpis_semana', { p_numero: semanaAtual - 1 })
    }
  }

  console.log(`[${mode}] Concluído: ${totalUpserted}/${totalFetched} registros, ${erros.length} erros`)
  return json({ ok: true, mode, fetched: totalFetched, upserted: totalUpserted, erros })
})
