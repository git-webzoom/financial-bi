import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const MG_API = 'https://digitalmanager.guru/api/v2'

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
    .eq('integration', 'manager_guru')
    .eq('ativo', true)
    .maybeSingle()

  if (error || !data?.vault_key) return null
  return data.vault_key
}

async function registrarJobRun(
  status: 'success' | 'error',
  recordsFetched: number,
  recordsInserted: number,
  errorMessage?: string,
) {
  await supabase.from('integration_job_runs').insert({
    integration:      'manager_guru',
    status,
    started_at:       new Date().toISOString(),
    finished_at:      new Date().toISOString(),
    records_fetched:  recordsFetched,
    records_inserted: recordsInserted,
    error_message:    errorMessage ?? null,
  })
  await supabase
    .from('integration_tokens')
    .update({ last_sync_at: new Date().toISOString(), last_sync_status: status })
    .eq('integration', 'manager_guru')
}

interface MgPage<T> {
  data: T[]
  has_more_pages: number
  next_cursor: string | null
  total_rows: number
}

interface MgProduct {
  id: string
  name: string
  is_active: number
  marketplace_id: string
  marketplace_name: string
  [key: string]: unknown
}

interface MgOffer {
  id: string
  name: string
  friendly_url?: string
  checkout_url?: string
  value?: number
  currency?: string
  is_active: number
  payment_types?: string[]
  installments?: { default?: number; max_without_interest?: number }
  created_at?: number
  updated_at?: number
  [key: string]: unknown
}

async function fetchAllPages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const all: T[] = []
  let cursor: string | null = null

  do {
    const params = new URLSearchParams({ per_page: '50' })
    if (cursor) params.set('cursor', cursor)

    const resp = await fetch(`${url}?${params}`, { headers })
    if (!resp.ok) throw new Error(`${url} → ${resp.status}: ${await resp.text()}`)

    const page = await resp.json() as MgPage<T>
    all.push(...page.data)
    cursor = page.has_more_pages ? page.next_cursor : null
  } while (cursor)

  return all
}

function unixToIso(ts?: number | null): string | null {
  return ts ? new Date(ts * 1000).toISOString() : null
}

// Processa ofertas de um produto em batch (upsert único)
async function syncOfertas(
  produtoId: string,
  offers: MgOffer[],
): Promise<{ upserted: number; erros: string[] }> {
  if (!offers.length) return { upserted: 0, erros: [] }

  const rows = offers.map(o => ({
    produto_id:       produtoId,
    mg_offer_id:      o.id,
    nome:             o.name,
    friendly_url:     o.friendly_url ?? null,
    checkout_url:     o.checkout_url ?? null,
    valor:            o.value ?? 0,
    moeda:            (o.currency ?? 'BRL').slice(0, 3),
    ativa:            o.is_active === 1,
    pagamentos:       Array.isArray(o.payment_types) ? o.payment_types : null,
    parcelas_default: o.installments?.default ?? null,
    max_sem_juros:    o.installments?.max_without_interest ?? null,
    funil:            null,
    mg_created_at:    unixToIso(o.created_at),
    mg_updated_at:    unixToIso(o.updated_at),
    updated_at:       new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('ofertas')
    .upsert(rows, { onConflict: 'produto_id,mg_offer_id', ignoreDuplicates: false })

  if (error) return { upserted: 0, erros: [`ofertas produto ${produtoId}: ${error.message}`] }
  return { upserted: rows.length, erros: [] }
}

Deno.serve(async () => {
  const token = await getToken()
  if (!token) {
    await registrarJobRun('error', 0, 0, 'Token Manager Guru não configurado ou inativo')
    return json({ error: 'token not found' }, 500)
  }

  const headers = { Authorization: `Bearer ${token}` }
  let productsFetched = 0
  let offersFetched = 0
  let upserted = 0
  const erros: string[] = []

  try {
    // 1. Busca todos os produtos (paginação por cursor)
    const products = await fetchAllPages<MgProduct>(`${MG_API}/products/`, headers)
    productsFetched = products.length
    console.log(`Produtos obtidos da API: ${productsFetched}`)

    // 2. Upsert em batch de todos os produtos de uma vez
    const produtoRows = products.map(p => ({
      id:             p.id,          // UUID do MG usado como PK
      marketplace:    p.marketplace_name ?? 'manager_guru',
      marketplace_id: p.marketplace_id ?? p.id,
      nome:           p.name,
      ativo:          p.is_active === 1,
      updated_at:     new Date().toISOString(),
    }))

    const { error: prodErr } = await supabase
      .from('produtos')
      .upsert(produtoRows, { onConflict: 'id', ignoreDuplicates: false })

    if (prodErr) {
      throw new Error(`Upsert produtos: ${prodErr.message}`)
    }
    upserted += productsFetched
    console.log(`Produtos upserted: ${productsFetched}`)

    // 3. Busca e upsert de ofertas — 5 produtos em paralelo por vez
    const CONCURRENCY = 5
    for (let i = 0; i < products.length; i += CONCURRENCY) {
      const batch = products.slice(i, i + CONCURRENCY)

      await Promise.all(batch.map(async p => {
        try {
          const offers = await fetchAllPages<MgOffer>(`${MG_API}/products/${p.id}/offers`, headers)
          offersFetched += offers.length

          const result = await syncOfertas(p.id, offers)
          upserted += result.upserted
          erros.push(...result.erros)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          erros.push(`produto ${p.id}: ${msg}`)
        }
      }))

      console.log(`Ofertas: ${i + batch.length}/${products.length} produtos processados`)
    }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    erros.push(msg)
    await registrarJobRun('error', productsFetched, offersFetched, erros.slice(0, 3).join('; '))
    return json({ error: msg, erros }, 500)
  }

  const status = erros.length > 0 && upserted === 0 ? 'error' : 'success'
  await registrarJobRun(
    status,
    productsFetched,   // records_fetched = nº de produtos
    offersFetched,     // records_inserted = nº de ofertas
    erros.length ? erros.slice(0, 5).join('; ') : undefined,
  )

  console.log(`Concluído: ${productsFetched} produtos, ${offersFetched} ofertas, ${upserted} upserts, ${erros.length} erros`)
  return json({ ok: true, products: productsFetched, offers: offersFetched, upserted, erros })
})
