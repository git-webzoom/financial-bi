import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const MANAGER_GURU_API_TOKEN = Deno.env.get('MANAGER_GURU_API_TOKEN')!

Deno.serve(async (req: Request) => {
  // ── Parse do body ────────────────────────────────────────────────────────
  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  // ── Autenticação via api_token no body ───────────────────────────────────
  if (!MANAGER_GURU_API_TOKEN || body.api_token !== MANAGER_GURU_API_TOKEN) {
    return json({ error: 'unauthorized' }, 401)
  }

  const webhookType: string = body.webhook_type ?? ''

  // ── Roteamento ───────────────────────────────────────────────────────────
  if (webhookType === 'transaction') {
    await handleTransaction(body)
    return json({ received: true }, 200)
  }

  if (webhookType === 'subscription') {
    await handleSubscription(body)
    return json({ received: true }, 200)
  }

  // Tipo desconhecido — aceitar sem errar para não causar reenvio
  return json({ received: true }, 200)
})

// ─────────────────────────────────────────────────────────────────────────────
// Transação
// ─────────────────────────────────────────────────────────────────────────────

async function handleTransaction(body: Record<string, any>) {
  // Chave única por transação + status — permite que reembolso/chargeback
  // da mesma transação seja gravado e processado normalmente.
  const confirmedAt = body.dates?.confirmed_at ?? 'null'
  const idempotencyKey = `${body.id}_${body.status ?? body.webhook_type}_${confirmedAt}`

  // Idempotência: só ignora se for exatamente o mesmo evento (mesmo id + mesmo status)
  const { data: existing } = await supabase
    .from('raw_vendas')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing) return

  // Gravar RAW
  const { data: raw, error: rawError } = await supabase
    .from('raw_vendas')
    .insert({ payload: body, idempotency_key: idempotencyKey })
    .select('id')
    .single()

  if (rawError || !raw) {
    console.error('Erro ao gravar raw_vendas:', rawError?.message)
    return
  }

  // Processar em background — não bloqueia o 200
  processVenda(raw.id)

  // Atualiza status da integração
  supabase.from('integration_tokens')
    .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'success' })
    .eq('integration', 'manager_guru')
}

async function processVenda(rawId: string) {
  const { error } = await supabase.rpc('process_venda', { raw_id: rawId })
  if (error) {
    console.error(`Erro em process_venda(${rawId}):`, error.message)
    await supabase
      .from('raw_vendas')
      .update({ error: error.message })
      .eq('id', rawId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Assinatura
// ─────────────────────────────────────────────────────────────────────────────

async function handleSubscription(body: Record<string, any>) {
  const idempotencyKey = `${body.id}_${body.webhook_type}`

  const { data: existing } = await supabase
    .from('raw_assinaturas')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase
    .from('raw_assinaturas')
    .insert({ payload: body, idempotency_key: idempotencyKey })

  if (error) {
    console.error('Erro ao gravar raw_assinaturas:', error.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitário
// ─────────────────────────────────────────────────────────────────────────────

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
