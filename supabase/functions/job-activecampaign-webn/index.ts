import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const FIELD_MAP: Record<string, string> = {
  '14':  'utm_campaign',
  '16':  'utm_term',
  '17':  'utm_content',
  '36':  'utm_medium',
  '74':  'utm_id',
  '332': 'utm_source',
  '265': 'data_cadastro',
  '255': 'ultima_interacao',
  '256': 'limite_engajamento',
  '257': 'temperatura',
  '258': 'ultimo_envio_email',
  '259': 'emails_enviados',
  '260': 'emails_abertos',
  '261': 'data_abertura_email',
  '262': 'ultimo_clique',
  '263': 'cliques_email',
  '277': 'numeros_recadastro',
  '293': 'dispositivo',
  '294': 'estado',
  '295': 'cidade',
  '264': 'nome_evento',
  '266': 'data_evento',
}

const INT_FIELDS = new Set(['emails_enviados', 'emails_abertos', 'cliques_email', 'numeros_recadastro'])
const TS_FIELDS  = new Set([
  'data_cadastro', 'ultima_interacao', 'ultimo_envio_email',
  'data_abertura_email', 'ultimo_clique', 'data_evento',
])

// ─── Rate limit ───────────────────────────────────────────────────────────────

let _lastCall = 0

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function acGet(
  baseUrl: string,
  token: string,
  path: string,
  attempt = 0
): Promise<Record<string, unknown>> {
  const now = Date.now()
  const wait = 250 - (now - _lastCall)
  if (wait > 0) await delay(wait)
  _lastCall = Date.now()

  const resp = await fetch(`${baseUrl}/api/3${path}`, {
    headers: { 'Api-Token': token },
  })

  if (resp.status === 429) {
    if (attempt >= 3) throw new Error(`Rate limit persistente em ${path}`)
    console.warn(`429 em ${path} — aguardando 60s (tentativa ${attempt + 1})`)
    await delay(60_000)
    return acGet(baseUrl, token, path, attempt + 1)
  }

  if (!resp.ok) throw new Error(`AC ${resp.status} em ${path}: ${await resp.text()}`)

  return resp.json() as Promise<Record<string, unknown>>
}

// ─── Token ────────────────────────────────────────────────────────────────────

interface TokenData { token: string; tokenId: string; baseUrl: string }

async function getToken(): Promise<TokenData | null> {
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('id, vault_key, config')
    .eq('integration', 'activecampaign')
    .eq('ativo', true)
    .maybeSingle()

  if (error || !data?.vault_key) {
    console.error('Token não encontrado:', error?.message)
    return null
  }

  const baseUrl = (data.config as Record<string, string> | null)?.base_url
  if (!baseUrl) { console.error('URL base não configurada'); return null }

  return { token: data.vault_key as string, tokenId: data.id as string, baseUrl }
}

// ─── Tag ─────────────────────────────────────────────────────────────────────

async function buscarTag(
  baseUrl: string, token: string, semana: number
): Promise<{ id: string; tag: string } | null> {
  const nomeTag = `TL - VIP WEBN 07 [22 Q4] - INSCRITO - SEMANA ${semana}`
  const json = await acGet(baseUrl, token, `/tags?search=${encodeURIComponent(nomeTag)}`)
  const found = ((json.tags ?? []) as Array<{ id: string; tag: string }>).find(t => t.tag === nomeTag)
  if (!found) console.warn(`Tag não encontrada: "${nomeTag}"`)
  return found ?? null
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface AcContact {
  id: string; email: string; firstName: string; lastName: string; phone: string; cdate: string
}
interface AcFieldValue { contact: string; field: string; value: string }

// ─── Busca uma página de contatos (1 chamada HTTP) ────────────────────────────

async function buscarPagina(
  baseUrl: string, token: string, tagId: string, offset: number
): Promise<{ contacts: AcContact[]; fieldValues: AcFieldValue[]; total: number }> {
  const json = await acGet(baseUrl, token, `/contacts?tagid=${tagId}&include=fieldValues&limit=100&offset=${offset}`)
  return {
    contacts:    (json.contacts    ?? []) as AcContact[],
    fieldValues: (json.fieldValues ?? []) as AcFieldValue[],
    total:       (json.meta as Record<string, number>)?.total ?? 0,
  }
}

// ─── Mapeamento de campos ─────────────────────────────────────────────────────

function mapearFields(contactId: string, fieldValues: AcFieldValue[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const fv of fieldValues) {
    if (fv.contact !== contactId) continue
    const col = FIELD_MAP[fv.field]
    if (!col || !fv.value) continue
    if (INT_FIELDS.has(col)) {
      const n = parseInt(fv.value, 10)
      if (!isNaN(n)) result[col] = n
    } else if (TS_FIELDS.has(col)) {
      const d = new Date(fv.value)
      if (!isNaN(d.getTime())) result[col] = d.toISOString()
    } else {
      result[col] = fv.value
    }
  }
  return result
}

// ─── Processa um lote (100 contatos) ─────────────────────────────────────────

async function processarLote(
  contacts: AcContact[], fieldValues: AcFieldValue[],
  semana: number, tagNome: string, tagId: string
): Promise<{ inserted: number; errors: number }> {
  let inserted = 0, errors = 0

  for (const ac of contacts) {
    try {
      const email = ac.email?.toLowerCase().trim()
      if (!email) { errors++; continue }

      const nome  = [ac.firstName, ac.lastName].filter(Boolean).join(' ') || null
      const campos = mapearFields(String(ac.id), fieldValues)

      const { data: contatoId, error: e1 } = await supabase.rpc('upsert_contato', {
        p_email: email, p_nome: nome,
        p_telefone: ac.phone || null, p_ac_contact_id: String(ac.id),
      })
      if (e1) throw new Error(`upsert_contato: ${e1.message}`)

      const { data: crmData, error: e2 } = await supabase
        .from('crm')
        .upsert({
          contato_id: contatoId as string, ac_contact_id: String(ac.id),
          email, nome, telefone: ac.phone || null,
          ...campos, updated_at: new Date().toISOString(),
        }, { onConflict: 'ac_contact_id' })
        .select('id').single()
      if (e2) throw new Error(`crm: ${e2.message}`)

      // Upsert via RPC: insere com UTMs na primeira vez, atualiza UTMs apenas se ainda NULL
      // Garante que UTMs de tráfego (captação) nunca são sobrescritas por UTMs de venda
      const { error: e3 } = await supabase.rpc('upsert_inscrito_webn', {
        p_contato_id:    contatoId as string,
        p_crm_id:        crmData?.id as string,
        p_numero_semana: semana,
        p_tag_ac:        tagNome,
        p_ac_tag_id:     tagId,
        p_data_inscricao: ac.cdate ? new Date(ac.cdate).toISOString() : null,
        p_utm_source:    (campos.utm_source   as string) || null,
        p_utm_campaign:  (campos.utm_campaign as string) || null,
        p_utm_medium:    (campos.utm_medium   as string) || null,
        p_utm_content:   (campos.utm_content  as string) || null,
        p_utm_term:      (campos.utm_term     as string) || null,
        p_utm_id:        (campos.utm_id       as string) || null,
      })
      if (e3) throw new Error(`inscritos: ${e3.message}`)

      inserted++
    } catch (e) {
      console.error(`Contato ${ac.id}:`, e instanceof Error ? e.message : e)
      errors++
    }
  }

  return { inserted, errors }
}

// ─── Processamento completo de uma semana (sem limite de tempo) ───────────────

async function processarSemana(
  baseUrl: string, token: string, tokenId: string,
  semana: number, jobRunId: string
): Promise<void> {
  let totalFetched = 0, totalInserted = 0, totalErrors = 0

  try {
    await supabase.rpc('ensure_semana_existe', { p_numero: semana })

    const tagInfo = await buscarTag(baseUrl, token, semana)
    if (!tagInfo) {
      await supabase.from('integration_job_runs').update({
        status: 'error', finished_at: new Date().toISOString(),
        error_message: `Tag não encontrada para semana ${semana}`,
      }).eq('id', jobRunId)
      return
    }

    console.log(`Semana ${semana}: tag "${tagInfo.tag}" (id=${tagInfo.id})`)

    // Primeira página — descobre o total
    const primeira = await buscarPagina(baseUrl, token, tagInfo.id, 0)
    const total = primeira.total
    console.log(`Semana ${semana}: ${total} contatos`)

    if (primeira.contacts.length > 0) {
      totalFetched += primeira.contacts.length
      const r = await processarLote(primeira.contacts, primeira.fieldValues, semana, tagInfo.tag, tagInfo.id)
      totalInserted += r.inserted
      totalErrors   += r.errors
    }

    // Páginas restantes
    let offset = 100
    while (offset < total) {
      const pagina = await buscarPagina(baseUrl, token, tagInfo.id, offset)
      if (pagina.contacts.length === 0) break

      totalFetched += pagina.contacts.length
      const r = await processarLote(pagina.contacts, pagina.fieldValues, semana, tagInfo.tag, tagInfo.id)
      totalInserted += r.inserted
      totalErrors   += r.errors

      console.log(`Semana ${semana}: ${Math.min(offset + 100, total)}/${total} processados`)
      offset += 100
    }

    const finalStatus = totalErrors > 0 && totalFetched === 0 ? 'error'
      : totalErrors > 0 ? 'partial' : 'success'

    await supabase.from('integration_job_runs').update({
      status: finalStatus, finished_at: new Date().toISOString(),
      records_fetched: totalFetched, records_inserted: totalInserted, records_error: totalErrors,
    }).eq('id', jobRunId)

    await supabase.from('integration_tokens').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: finalStatus === 'error' ? 'error' : 'success',
    }).eq('id', tokenId)

    console.log(`Semana ${semana}: concluído — ${totalInserted} inseridos, ${totalErrors} erros`)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Erro fatal:', msg)

    await supabase.from('integration_job_runs').update({
      status: 'error', finished_at: new Date().toISOString(), error_message: msg,
      records_fetched: totalFetched, records_inserted: totalInserted, records_error: totalErrors + 1,
    }).eq('id', jobRunId)

    await supabase.from('integration_tokens').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'error',
    }).eq('id', tokenId)
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  let body: { semanas?: number[] } = {}
  try { body = await req.json() } catch { /* body opcional */ }

  const tokenData = await getToken()
  if (!tokenData) {
    return new Response(
      JSON.stringify({ error: 'Token ou URL base não configurados' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const { token, tokenId, baseUrl } = tokenData

  // Determina semanas a processar
  let semanas: number[]
  if (body.semanas?.length) {
    semanas = body.semanas
  } else {
    const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
    semanas = [semanaAtual as number]
  }

  // Cria um job run por semana
  const jobRuns: Array<{ semana: number; jobRunId: string }> = []
  for (const semana of semanas) {
    const { data: jobRun } = await supabase
      .from('integration_job_runs')
      .insert({ integration: 'activecampaign_webn', status: 'running', started_at: new Date().toISOString() })
      .select('id').single()
    if (jobRun?.id) jobRuns.push({ semana, jobRunId: jobRun.id as string })
  }

  // Processa em background — responde imediatamente, sem timeout
  const trabalho = async () => {
    for (const { semana, jobRunId } of jobRuns) {
      await processarSemana(baseUrl, token, tokenId, semana, jobRunId)
    }
  }

  // @ts-ignore — EdgeRuntime disponível no Supabase Edge
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(trabalho())
  } else {
    trabalho() // fallback local
  }

  return new Response(
    JSON.stringify({
      status: 'started',
      semanas,
      jobs: jobRuns.map(j => j.jobRunId),
      message: `Processando ${semanas.length} semana(s) em background. Acompanhe pelo log de integrações.`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
