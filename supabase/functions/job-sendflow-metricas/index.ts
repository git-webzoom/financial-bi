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

// Converte "DDMMYYYY" → "YYYY-MM-DD"
function parseSendflowDate(raw: string): string | null {
  if (raw.length !== 8) return null
  const dd = raw.slice(0, 2)
  const mm = raw.slice(2, 4)
  const yyyy = raw.slice(4, 8)
  // Valida minimamente
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

Deno.serve(async () => {
  const token = await getToken()
  if (!token) {
    await registrarJobRun('error', 0, 0, 'Token Sendflow não configurado ou inativo')
    return json({ error: 'token not found' }, 500)
  }

  const headers = { Authorization: `Bearer ${token}` }

  // Buscar apenas campanhas ativas
  const { data: campanhas } = await supabase
    .from('sendflow_campanhas')
    .select('id')
    .eq('monitorada', true)

  if (!campanhas?.length) {
    await registrarJobRun('success', 0, 0)
    return json({ ok: true, message: 'Nenhuma campanha ativa' })
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

      // Estrutura: { add: {total, dates: {"DDMMYYYY": N}}, remove: {total, dates}, clicks: {total, dates} }
      const analytics = await res.json() as {
        add?:    { total?: number; dates?: Record<string, number> }
        remove?: { total?: number; dates?: Record<string, number> }
        clicks?: { total?: number; dates?: Record<string, number> }
      }

      const addDates    = analytics.add?.dates    ?? {}
      const removeDates = analytics.remove?.dates ?? {}
      const clicksDates = analytics.clicks?.dates ?? {}

      // União de todas as datas
      const todasDatasArr = Array.from(new Set([
        ...Object.keys(addDates),
        ...Object.keys(removeDates),
        ...Object.keys(clicksDates),
      ]))

      totalFetched += todasDatasArr.length

      for (const rawDate of todasDatasArr) {
        const data = parseSendflowDate(rawDate)
        if (!data) continue

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
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`campanha ${camp.id}: ${msg}`)
    }
  }

  const status = erros.length > 0 && totalUpserted === 0 ? 'error' : 'success'
  const errorMessage = erros.length ? erros.slice(0, 3).join('; ') : undefined
  await registrarJobRun(status, totalFetched, totalUpserted, errorMessage)

  // Atualiza KPIs das últimas 2 semanas na tabela grupos_kpis_semana
  const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
  if (semanaAtual) {
    await supabase.rpc('upsert_grupos_kpis_semana', { p_numero: semanaAtual })
    await supabase.rpc('upsert_grupos_kpis_semana', { p_numero: semanaAtual - 1 })
  }

  console.log(`Concluído: ${totalUpserted}/${totalFetched} registros, ${erros.length} erros`)
  return json({ ok: true, fetched: totalFetched, upserted: totalUpserted, erros })
})
