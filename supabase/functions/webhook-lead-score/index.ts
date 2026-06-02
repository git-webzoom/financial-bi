import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Lead Score WEBN — webhook inbound chamado DIRETO do navegador do lead (formulário
// de pesquisa da landing). Por isso precisa de CORS/OPTIONS. verify_jwt = false.
//
// Fluxo: grava raw → normaliza nomes do form p/ variáveis → upsert_contato →
//        calcular_lead_score → upsert em lead_score (onConflict contato_id) → marca raw.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// nome do campo no form → variável da scorecard (lead_score_pontos.variavel).
// genero/capital/sonho/diferencial_tasso NÃO entram (não pontuam — só são guardados em respostas).
const MAP: Record<string, string> = {
  idade: 'idade',
  escolaridade: 'escolaridade',
  profissional: 'profissao',
  renda: 'renda',
  investe_cripto: 'cripto',
  valor_investido: 'valor',
  disponivel_mes: 'disponivel_mes',
  tempo_tasso: 'conhece',
  objetivo_cripto: 'objetivo',
  dificuldade_cripto: 'dificuldade',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  // grava o raw SEMPRE (mesmo sem email) — auditoria/reprocesso
  const { data: raw } = await supabase
    .from('raw_lead_score')
    .insert({ payload: body })
    .select('id')
    .single()
  const rawId = raw?.id ?? null

  const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : ''
  if (!email) {
    if (rawId) {
      await supabase.from('raw_lead_score').update({ error: 'email required' }).eq('id', rawId)
    }
    return json({ error: 'email required' }, 400)
  }

  const nome = typeof body.nome === 'string' ? body.nome.trim() || null : null
  const telefone =
    typeof body.telefone === 'string' && body.telefone !== 'null'
      ? body.telefone.trim() || null
      : null
  const respFromForm = (body.respostas ?? {}) as Record<string, string>

  // normaliza p/ as variáveis pontuáveis (só os 10 campos do MAP)
  const respScore: Record<string, string> = {}
  for (const [campo, variavel] of Object.entries(MAP)) {
    if (respFromForm[campo]) respScore[variavel] = respFromForm[campo]
  }

  // upsert do contato (chave = email) → contato_id
  const { data: contatoId, error: contatoErr } = await supabase.rpc('upsert_contato', {
    p_email: email,
    p_nome: nome,
    p_telefone: telefone,
  })
  if (contatoErr || !contatoId) {
    console.error('upsert_contato error:', contatoErr)
    if (rawId) {
      await supabase
        .from('raw_lead_score')
        .update({ error: `upsert_contato: ${contatoErr?.message ?? 'no id'}` })
        .eq('id', rawId)
    }
    return json({ error: 'contact upsert failed' }, 500)
  }

  // calcula o score a partir das respostas normalizadas
  const { data: score, error: scoreErr } = await supabase.rpc('calcular_lead_score', {
    p_respostas: respScore,
  })
  if (scoreErr || !score) {
    console.error('calcular_lead_score error:', scoreErr)
    if (rawId) {
      await supabase
        .from('raw_lead_score')
        .update({ error: `calcular_lead_score: ${scoreErr?.message ?? 'no result'}` })
        .eq('id', rawId)
    }
    return json({ error: 'score failed' }, 500)
  }

  const s = score as { pontos_total: number; faixa: string; breakdown: unknown }

  const { error: upErr } = await supabase.from('lead_score').upsert(
    {
      contato_id: contatoId,
      email,
      respostas: respFromForm, // guarda TODAS as 14 (inclui as não pontuadas)
      breakdown: s.breakdown,
      pontos_total: s.pontos_total,
      faixa: s.faixa,
      raw_id: rawId,
    },
    { onConflict: 'contato_id' },
  )
  if (upErr) {
    console.error('lead_score upsert error:', upErr)
    if (rawId) {
      await supabase
        .from('raw_lead_score')
        .update({ error: `lead_score upsert: ${upErr.message}` })
        .eq('id', rawId)
    }
    return json({ error: 'save failed' }, 500)
  }

  if (rawId) {
    await supabase
      .from('raw_lead_score')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('id', rawId)
  }

  return json({ received: true, faixa: s.faixa, pontos_total: s.pontos_total }, 200)
})
