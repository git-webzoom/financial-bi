import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const AC_BASE = 'https://financialmove.api-us1.com/api/3'

// ─── Mapa de custom fields do AC → coluna crm ────────────────────────────────
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

// Campos inteiros
const INT_FIELDS = new Set(['emails_enviados', 'emails_abertos', 'cliques_email', 'numeros_recadastro'])
// Campos timestamptz
const TS_FIELDS  = new Set([
  'data_cadastro', 'ultima_interacao', 'ultimo_envio_email',
  'data_abertura_email', 'ultimo_clique', 'data_evento',
])

// ─── HTTP com rate limit (250ms entre chamadas, retry em 429) ────────────────

let _lastCall = 0

async function acGet(
  token: string,
  path: string,
  attempt = 0
): Promise<Record<string, unknown>> {
  const now = Date.now()
  const wait = 250 - (now - _lastCall)
  if (wait > 0) await delay(wait)
  _lastCall = Date.now()

  const resp = await fetch(`${AC_BASE}${path}`, {
    headers: { 'Api-Token': token },
  })

  if (resp.status === 429) {
    if (attempt >= 3) throw new Error(`Rate limit persistente em ${path}`)
    console.warn(`429 em ${path} — aguardando 60s (tentativa ${attempt + 1})`)
    await delay(60_000)
    return acGet(token, path, attempt + 1)
  }

  if (!resp.ok) {
    throw new Error(`AC ${resp.status} em ${path}`)
  }

  return resp.json() as Promise<Record<string, unknown>>
}

function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

// ─── Busca token do AC ────────────────────────────────────────────────────────

async function getToken(): Promise<{ token: string; tokenId: string } | null> {
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('id, vault_key')
    .eq('integration', 'activecampaign')
    .eq('ativo', true)
    .maybeSingle()

  if (error || !data?.vault_key) {
    console.error('Token activecampaign não encontrado:', error?.message)
    return null
  }
  return { token: data.vault_key as string, tokenId: data.id as string }
}

// ─── Busca tag no AC pelo nome exato ─────────────────────────────────────────

async function buscarTag(
  token: string,
  nomeSemana: number
): Promise<{ id: string; tag: string } | null> {
  const nomeTag = `TL - VIP WEBN 07 [22 Q4] - INSCRITO - SEMANA ${nomeSemana}`
  const json = await acGet(token, `/tags?search=${encodeURIComponent(nomeTag)}`)
  const tags = (json.tags ?? []) as Array<{ id: string; tag: string }>
  const found = tags.find(t => t.tag === nomeTag)
  if (!found) {
    console.warn(`Tag não encontrada para semana ${nomeSemana}: "${nomeTag}"`)
    return null
  }
  return found
}

// ─── Busca todos os contactTags de uma tag (paginado) ────────────────────────

interface ContactTag {
  contact: string
  tag: string
  cdate: string
}

async function buscarContactTags(
  token: string,
  tagId: string
): Promise<ContactTag[]> {
  const resultado: ContactTag[] = []
  let offset = 0

  while (true) {
    const json = await acGet(
      token,
      `/contactTags?filters[tag]=${tagId}&limit=100&offset=${offset}`
    )
    const items = (json.contactTags ?? []) as ContactTag[]
    if (items.length === 0) break
    resultado.push(...items)
    if (items.length < 100) break
    offset += 100
  }

  return resultado
}

// ─── Busca dados completos de um contato ─────────────────────────────────────

interface AcContact {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  cdate: string
}

interface AcFieldValue {
  field: string
  value: string
}

async function buscarContato(
  token: string,
  contactId: string
): Promise<{ contact: AcContact; fieldValues: AcFieldValue[] }> {
  const json = await acGet(token, `/contacts/${contactId}?include=fieldValues`)
  return {
    contact:     json.contact as AcContact,
    fieldValues: (json.fieldValues ?? []) as AcFieldValue[],
  }
}

// ─── Mapeia fieldValues para colunas crm ─────────────────────────────────────

function mapearFields(fieldValues: AcFieldValue[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const fv of fieldValues) {
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

// ─── Upsert contato + crm + webinario_inscritos ───────────────────────────────

async function processarContato(
  acContact: AcContact,
  fieldValues: AcFieldValue[],
  cdate: string,
  semana: number,
  tagNome: string,
  tagId: string,
): Promise<'inserted' | 'skipped' | 'error'> {
  try {
    const email = acContact.email?.toLowerCase().trim()
    if (!email) return 'error'

    const nome = [acContact.firstName, acContact.lastName].filter(Boolean).join(' ') || null
    const campos = mapearFields(fieldValues)

    // 3d — upsert contato
    const { data: contatoData, error: contatoErr } = await supabase.rpc('upsert_contato', {
      p_email:         email,
      p_nome:          nome,
      p_telefone:      acContact.phone || null,
      p_ac_contact_id: String(acContact.id),
    })
    if (contatoErr) throw new Error(`upsert_contato: ${contatoErr.message}`)
    const contatoId = contatoData as string

    // 3e — upsert crm
    const crmPayload: Record<string, unknown> = {
      contato_id:    contatoId,
      ac_contact_id: String(acContact.id),
      email,
      nome,
      telefone:      acContact.phone || null,
      ...campos,
      updated_at:    new Date().toISOString(),
    }

    const { data: crmData, error: crmErr } = await supabase
      .from('crm')
      .upsert(crmPayload, { onConflict: 'ac_contact_id' })
      .select('id')
      .single()

    if (crmErr) throw new Error(`crm upsert: ${crmErr.message}`)
    const crmId = crmData?.id as string

    // 3f — insert webinario_inscritos (DO NOTHING em conflito unique)
    const { error: inscErr } = await supabase
      .from('webinario_inscritos')
      .upsert({
        contato_id:    contatoId,
        crm_id:        crmId,
        numero_semana: semana,
        tag_ac:        tagNome,
        ac_tag_id:     tagId,
        data_inscricao: cdate ? new Date(cdate).toISOString() : null,
      }, { onConflict: 'contato_id,numero_semana', ignoreDuplicates: true })

    if (inscErr) {
      throw new Error(`webinario_inscritos upsert: ${inscErr.message}`)
    }

    return 'inserted'
  } catch (e) {
    console.error(`Erro no contato ${acContact.id}:`, e instanceof Error ? e.message : e)
    return 'error'
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  let body: { semanas?: number[]; force?: boolean } = {}
  try { body = await req.json() } catch { /* body opcional */ }

  // Busca token
  const tokenData = await getToken()
  if (!tokenData) {
    return new Response(
      JSON.stringify({ error: 'Token activecampaign não encontrado' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const { token, tokenId } = tokenData

  // Cria job run
  const { data: jobRun } = await supabase
    .from('integration_job_runs')
    .insert({
      integration: 'activecampaign_webn',
      status:      'running',
      started_at:  new Date().toISOString(),
    })
    .select('id')
    .single()
  const jobRunId = jobRun?.id as string | undefined

  let totalFetched  = 0
  let totalInserted = 0
  let totalErrors   = 0

  try {
    // Determinar semanas
    let semanas: number[]
    if (body.semanas?.length) {
      semanas = body.semanas
    } else {
      const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
      const atual = semanaAtual as number
      semanas = [atual, atual - 1, atual - 2, atual - 3, atual - 4]
    }

    console.log(`Processando semanas: ${semanas.join(', ')}`)

    for (const semana of semanas) {
      try {
        // Garantir que a semana existe
        await supabase.rpc('ensure_semana_existe', { p_numero: semana })

        // 3a — buscar tag
        const tagInfo = await buscarTag(token, semana)
        if (!tagInfo) continue

        console.log(`Semana ${semana}: tag "${tagInfo.tag}" (id=${tagInfo.id})`)

        // 3b — buscar contactTags
        const contactTags = await buscarContactTags(token, tagInfo.id)
        console.log(`Semana ${semana}: ${contactTags.length} contatos encontrados`)
        totalFetched += contactTags.length

        // 3c..3f — processar cada contato
        for (const ct of contactTags) {
          try {
            const { contact, fieldValues } = await buscarContato(token, ct.contact)
            const result = await processarContato(
              contact,
              fieldValues,
              ct.cdate,
              semana,
              tagInfo.tag,
              tagInfo.id,
            )
            if (result === 'inserted') totalInserted++
            if (result === 'error')    totalErrors++
          } catch (e) {
            console.error(`Erro ao processar contact ${ct.contact}:`, e instanceof Error ? e.message : e)
            totalErrors++
          }
        }

      } catch (e) {
        console.error(`Erro na semana ${semana}:`, e instanceof Error ? e.message : e)
        totalErrors++
      }
    }

    const finalStatus = totalErrors > 0 && totalFetched === 0
      ? 'error'
      : totalErrors > 0
        ? 'partial'
        : 'success'

    // Atualiza job run
    if (jobRunId) {
      await supabase.from('integration_job_runs').update({
        status:           finalStatus,
        finished_at:      new Date().toISOString(),
        records_fetched:  totalFetched,
        records_inserted: totalInserted,
        records_error:    totalErrors,
      }).eq('id', jobRunId)
    }

    // Atualiza token
    await supabase.from('integration_tokens').update({
      last_sync_at:     new Date().toISOString(),
      last_sync_status: finalStatus === 'error' ? 'error' : 'success',
    }).eq('id', tokenId)

    return new Response(JSON.stringify({
      status:           finalStatus,
      records_fetched:  totalFetched,
      records_inserted: totalInserted,
      records_error:    totalErrors,
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Erro fatal:', msg)

    if (jobRunId) {
      await supabase.from('integration_job_runs').update({
        status:        'error',
        finished_at:   new Date().toISOString(),
        error_message: msg,
        records_fetched:  totalFetched,
        records_inserted: totalInserted,
        records_error:    totalErrors + 1,
      }).eq('id', jobRunId)
    }

    await supabase.from('integration_tokens').update({
      last_sync_at:     new Date().toISOString(),
      last_sync_status: 'error',
    }).eq('id', tokenId)

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
