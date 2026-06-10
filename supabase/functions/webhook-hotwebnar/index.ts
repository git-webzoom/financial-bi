import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const WEBHOOK_SECRET = Deno.env.get('HOTWEBNAR_WEBHOOK_SECRET') ?? ''

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  // Autenticação via campo no body (padrão Hotwebnar)
  if (WEBHOOK_SECRET && body.api_token !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  if (!email) return json({ error: 'email required' }, 400)

  const nome = typeof body.nome === 'string' ? body.nome.trim() || null : null
  const telefone = typeof body.telefone === 'string' && body.telefone !== 'null' ? body.telefone.trim() || null : null
  const tag = typeof body.tag === 'string' ? body.tag.trim() : 'Acessou'

  // Semana do webinário = aquela cujo data_evento (terça ao vivo) está
  // nos últimos 6 dias ou hoje BRT. Cobre terça 00:00 até segunda 23:59 BRT.
  const { data: numeroSemana, error: semanaErr } = await supabase.rpc('get_semana_webnario_ativa')
  if (semanaErr || !numeroSemana) {
    console.error('get_semana_webnario_ativa error:', semanaErr)
    return json({ error: 'failed to get active webinar week' }, 500)
  }

  // Blindagem: garante que a régua da semana exista ANTES do upsert, evitando o erro 500/FK
  // que perdia os primeiros acessos quando a semana nova ainda não tinha sido criada.
  // ensure_semana_existe é idempotente (ON CONFLICT DO NOTHING); falha aqui não é fatal,
  // o upsert (com retry abaixo) ainda cobre o caso.
  const { error: ensureErr } = await supabase.rpc('ensure_semana_existe', { p_numero: numeroSemana })
  if (ensureErr) console.error('ensure_semana_existe error:', ensureErr)

  // Upsert de presença
  let { error: upsertErr } = await supabase.rpc('upsert_presenca_webn', {
    p_email:          email,
    p_nome:           nome,
    p_telefone:       telefone,
    p_tag:            tag,
    p_numero_semana:  numeroSemana,
  })

  // Rede de segurança: se ainda violar o FK (23503), cria a semana e tenta uma vez mais.
  if (upsertErr && (upsertErr as { code?: string }).code === '23503') {
    console.error('upsert violou FK (23503); criando semana e tentando novamente:', numeroSemana)
    await supabase.rpc('ensure_semana_existe', { p_numero: numeroSemana })
    ;({ error: upsertErr } = await supabase.rpc('upsert_presenca_webn', {
      p_email:          email,
      p_nome:           nome,
      p_telefone:       telefone,
      p_tag:            tag,
      p_numero_semana:  numeroSemana,
    }))
  }

  if (upsertErr) {
    console.error('upsert_presenca_webn error:', upsertErr)
    return json({ error: 'failed to save presence' }, 500)
  }

  return json({ received: true, semana: numeroSemana, tag }, 200)
})
