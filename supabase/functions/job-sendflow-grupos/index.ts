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

// Busca semana atual (numeração captacao) e ativa campanha Cap-{semana} na Sendflow
async function autoSelecionarCampanhaCap(headers: Record<string, string>): Promise<string | null> {
  // Semana atual de captacao
  const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
  if (!semanaAtual) {
    console.warn('[grupos] get_semana_atual retornou null — sem auto-seleção')
    return null
  }

  const nomeProcurado = `Cap-${semanaAtual}`
  console.log(`[grupos] Procurando campanha "${nomeProcurado}" na Sendflow API`)

  // Lista todas as campanhas (releases) disponíveis na Sendflow
  const res = await fetch(`${BASE_URL}/releases`, { headers })
  if (!res.ok) {
    console.error(`[grupos] GET /releases → ${res.status}`)
    return null
  }

  const releases = await res.json() as Array<Record<string, unknown>>
  if (!Array.isArray(releases)) {
    console.error('[grupos] GET /releases não retornou array')
    return null
  }

  // Encontra a campanha cujo nome começa com o padrão Cap-{semana}
  const campanha = releases.find(r => {
    const nome = String(r.name ?? '')
    return nome === nomeProcurado || nome.startsWith(`${nomeProcurado} `) || nome.startsWith(`${nomeProcurado}-`)
  })

  if (!campanha) {
    console.warn(`[grupos] Campanha "${nomeProcurado}" não encontrada. Campanhas disponíveis: ${releases.map(r => r.name).join(', ')}`)
    return null
  }

  const campanhaId = String(campanha.id ?? '')
  const campanhaNome = String(campanha.name ?? '')
  console.log(`[grupos] Encontrada: "${campanhaNome}" (id=${campanhaId})`)

  // Upsert a nova campanha no banco
  await supabase
    .from('sendflow_campanhas')
    .upsert({
      id: campanhaId,
      nome: campanhaNome,
      monitorada: true,
      ativo: campanha.archived !== true,
      raw: campanha,
      synced_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  // Remove monitorada=true de outras campanhas Cap- da semana anterior
  // (deixa apenas a atual como monitorada)
  await supabase
    .from('sendflow_campanhas')
    .update({ monitorada: false })
    .neq('id', campanhaId)
    .like('nome', 'Cap-%')

  console.log(`[grupos] Campanha "${campanhaNome}" marcada como monitorada`)
  return campanhaId
}

Deno.serve(async () => {
  const token = await getToken()
  if (!token) {
    await registrarJobRun('error', 0, 0, 'Token Sendflow não configurado ou inativo')
    return json({ error: 'token not found' }, 500)
  }

  const headers = { Authorization: `Bearer ${token}` }

  // Auto-seleciona campanha Cap-{semana_atual} antes de sincronizar grupos
  await autoSelecionarCampanhaCap(headers)
  await delay(300)

  // Só campanhas que o usuário marcou para monitorar
  const { data: campanhas, error: campErr } = await supabase
    .from('sendflow_campanhas')
    .select('id')
    .eq('monitorada', true)

  if (campErr || !campanhas?.length) {
    await registrarJobRun('success', 0, 0, campanhas?.length === 0 ? 'Nenhuma campanha monitorada cadastrada' : undefined)
    return json({ ok: true, message: 'Nenhuma campanha monitorada' })
  }

  console.log(`Campanhas monitoradas: ${campanhas.length}`)

  let gruposFetched = 0
  let upserted = 0
  const erros: string[] = []

  for (const camp of campanhas) {
    try {
      // Busca dados atuais da campanha
      const resCamp = await fetch(`${BASE_URL}/releases/${camp.id}`, { headers })
      if (!resCamp.ok) {
        erros.push(`campanha ${camp.id}: GET /releases/${camp.id} → ${resCamp.status}`)
        continue
      }
      const campData = await resCamp.json() as Record<string, unknown>

      if (campData.code === 'rate-limit-exceeded') {
        const waitMs = Number((campData as { retryAfterMs?: number }).retryAfterMs ?? 60_000)
        await delay(waitMs + 1000)
        erros.push(`campanha ${camp.id}: rate limit`)
        continue
      }

      // Busca grupos
      await delay(300)
      const resGrupos = await fetch(`${BASE_URL}/releases/${camp.id}/groups`, { headers })
      if (!resGrupos.ok) {
        erros.push(`campanha ${camp.id}: GET /groups → ${resGrupos.status}`)
        continue
      }
      const grupos = await resGrupos.json() as Record<string, unknown>[]

      if (!Array.isArray(grupos)) {
        erros.push(`campanha ${camp.id}: /groups não retornou array`)
        continue
      }

      gruposFetched += grupos.length

      // IDs que vieram da API agora
      const idsAtivos = grupos.map(g => String(g.id ?? '')).filter(Boolean)

      // Atualiza nome e totais da campanha
      const totalMembros = grupos.reduce((s, g) => s + Number(g.participantsAmount ?? 0), 0)
      await supabase
        .from('sendflow_campanhas')
        .update({
          nome: String(campData.name ?? ''),
          ativo: campData.archived !== true,
          total_grupos: grupos.length,
          total_membros: totalMembros,
          raw: campData,
          synced_at: new Date().toISOString(),
        })
        .eq('id', camp.id)

      for (const g of grupos) {
        const grupoId = String(g.id ?? '')
        if (!grupoId) continue

        const inviteCode = g.inviteCode ? String(g.inviteCode) : null
        const link = inviteCode ? `https://chat.whatsapp.com/${inviteCode}` : null

        const { error: upsertErr } = await supabase
          .from('sendflow_grupos')
          .upsert({
            id: grupoId,
            campanha_id: camp.id,
            nome: String(g.name ?? ''),
            link,
            invite_code: inviteCode,
            total_membros: Number(g.participantsAmount ?? 0),
            count: Number(g.count ?? 0),
            grupo_cheio: g.full === true,
            gid: g.gid ? String(g.gid) : null,
            ativo: true,
            raw: g,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'id' })

        if (!upsertErr) upserted++
      }

      // Remove do banco grupos que não existem mais na API
      if (idsAtivos.length > 0) {
        await supabase
          .from('sendflow_grupos')
          .delete()
          .eq('campanha_id', camp.id)
          .not('id', 'in', `(${idsAtivos.map(id => `"${id}"`).join(',')})`)
      } else {
        // API retornou 0 grupos — remove todos desta campanha
        await supabase
          .from('sendflow_grupos')
          .delete()
          .eq('campanha_id', camp.id)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      erros.push(`campanha ${camp.id}: ${msg}`)
    }
  }

  const status = erros.length > 0 && upserted === 0 ? 'error' : 'success'
  await registrarJobRun(status, gruposFetched, upserted, erros.length ? erros.slice(0, 3).join('; ') : undefined)
  console.log(`Concluído: ${upserted} grupos de ${campanhas.length} campanhas`)
  return json({ ok: true, grupos: upserted, erros })
})
