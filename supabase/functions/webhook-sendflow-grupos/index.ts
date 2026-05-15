import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const WEBHOOK_TOKEN = Deno.env.get('SENDFLOW_WEBHOOK_TOKEN') ?? ''
const CAP_ID = 'OEZjXU3Pish6qR8gF7fv'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // Autenticação via header sendtok
  const sendtok = req.headers.get('sendtok') ?? ''
  if (WEBHOOK_TOKEN && sendtok !== WEBHOOK_TOKEN) {
    return json({ error: 'unauthorized' }, 401)
  }

  let raw: Record<string, unknown>
  try {
    raw = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  // Suporta payload direto { id, event, data, ... } ou aninhado { body: { id, event, data }, headers: {...} }
  const body = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body))
    ? raw.body as Record<string, unknown>
    : raw

  const event = body.event as string | undefined
  const data = body.data as Record<string, unknown> | undefined

  // Ignora eventos que não sejam de entrada/saída
  if (event !== 'group.updated.members.added' && event !== 'group.updated.members.removed') {
    return json({ ok: true, skipped: true, reason: 'event_ignored' })
  }

  // Ignora campanhas que não sejam a CAP
  if (data?.campaignId !== CAP_ID) {
    return json({ ok: true, skipped: true, reason: 'campaign_ignored' })
  }

  const eventoId   = body.id as string | undefined
  const numero     = data.number as string | undefined
  const grupoId    = data.groupId as string | undefined
  const criadoEm   = data.createdAt as string | undefined

  if (!numero || !grupoId || !criadoEm) {
    return json({ error: 'missing required fields' }, 400)
  }

  const tipo = event === 'group.updated.members.added' ? 'added' : 'removed'

  const { error: upsertErr } = await supabase
    .from('sendflow_eventos_grupo')
    .upsert({
      evento_id:   eventoId ?? null,
      campanha_id: CAP_ID,
      grupo_id:    grupoId,
      numero,
      tipo,
      criado_em:   criadoEm,
      raw:         raw,
    }, { onConflict: 'evento_id' })

  if (upsertErr) {
    console.error('Erro ao gravar evento:', upsertErr)
    return json({ error: 'db error', detail: upsertErr.message }, 500)
  }

  // Recalcula KPIs da semana atual
  const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
  if (semanaAtual) {
    await supabase.rpc('upsert_grupos_kpis_semana', { p_numero: semanaAtual })
  }

  return json({ ok: true, tipo, numero })
})
