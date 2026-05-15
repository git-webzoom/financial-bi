import { createClient } from '@/lib/supabase/server'
import ProdutosClient from './_components/ProdutosClient'

const BATCH = 1000

async function fetchAll<T>(
  supabase: ReturnType<typeof createClient>,
  table: string,
  columns: string,
  filters: Record<string, string> = {},
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  while (true) {
    let q = supabase.from(table).select(columns).order('nome', { ascending: true }).range(from, from + BATCH - 1)
    for (const [col, val] of Object.entries(filters)) {
      if (val === 'not.is.null') q = q.not(col, 'is', null)
      else q = q.eq(col, val)
    }
    const { data, error } = await q
    if (error || !data?.length) break
    rows.push(...(data as T[]))
    if (data.length < BATCH) break
    from += BATCH
  }
  return rows
}

export default async function ProdutosPage() {
  const supabase = createClient()

  const [produtos, ofertas] = await Promise.all([
    fetchAll(supabase, 'produtos', 'id, marketplace_id, marketplace, nome, ativo, created_at, updated_at'),
    fetchAll(supabase, 'ofertas',  'id, produto_id, mg_offer_id, nome, checkout_url, valor, moeda, ativa, pagamentos, parcelas_default, funil, mg_created_at, updated_at'),
  ])

  return (
    <ProdutosClient
      initialProdutos={(produtos as any) ?? []}
      initialOfertas={(ofertas as any) ?? []}
    />
  )
}
