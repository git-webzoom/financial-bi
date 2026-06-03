// Agrupa linhas de venda em "1 linha por COMPRA" (mãe + order bumps/upsells).
//
// Usado na /vendas (modo filtro personalizado) e nas tabelas de venda do /dashboard, para que a
// listagem bata com a contagem de "compras distintas" dos KPIs. A lógica saiu de
// VendasClient.montarComprasFiltradas — fonte única, evita cópias divergentes.
//
// Regra (confirmada com o usuário): agrupa por coalesce(venda_principal_id, id); o valor/qtd somam
// SÓ as linhas que passaram no filtro (se a mãe ficou fora do filtro, o valor dela NÃO entra).
// `fetchMaes` busca as mães que não estão entre as linhas filtradas (para exibir nome/dados da
// compra) — injetado pelo chamador para não acoplar o supabase aqui.

export const STATUS_APROVADO = ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed']

// Campos mínimos que a função usa. O chamador passa o tipo `Venda` completo; este shape é só o
// contrato interno (compatível com `Venda` de VendasClient). Sem index signature para aceitar
// interfaces como `Venda` (que não têm `[k: string]`).
export interface LinhaVenda {
  id: string
  venda_principal_id: string | null
  status: string
  valor_venda: number | null
  valor_liquido: number | null
  data_pedido: string | null
  qtd_bumps?: number
  valor_total_grupo?: number
  valor_liquido_total_grupo?: number
}

export async function montarComprasFiltradas<T extends LinhaVenda>(
  linhas: T[],
  fetchMaes: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (linhas.length === 0) return []

  // Agrupa as linhas filtradas por id de compra (mãe).
  const grupos = new Map<string, T[]>()
  for (const l of linhas) {
    const compraId = l.venda_principal_id ?? l.id
    const arr = grupos.get(compraId) ?? []
    arr.push(l)
    grupos.set(compraId, arr)
  }

  // Mães já presentes entre as linhas filtradas; as que faltam (mãe não passou o filtro) buscamos.
  const presentes = new Map(linhas.filter(l => l.venda_principal_id == null).map(l => [l.id, l]))
  const idsFaltantes = Array.from(grupos.keys()).filter(id => !presentes.has(id))
  if (idsFaltantes.length > 0) {
    const maesFaltantes = await fetchMaes(idsFaltantes)
    for (const m of maesFaltantes) presentes.set(m.id, m)
  }

  // Monta uma linha por compra: dados da mãe + agregados das linhas FILTRADAS daquela compra.
  const compras: T[] = []
  for (const [compraId, doGrupo] of Array.from(grupos.entries())) {
    const mae = presentes.get(compraId)
    if (!mae) continue // mãe não encontrada (raro); ignora a compra
    const aprovadasFiltradas = doGrupo.filter(l => STATUS_APROVADO.includes(l.status))
    compras.push({
      ...mae,
      qtd_bumps: doGrupo.filter(l => l.id !== compraId).length,
      valor_total_grupo:         aprovadasFiltradas.reduce((s, l) => s + (l.valor_venda   ?? 0), 0),
      valor_liquido_total_grupo: aprovadasFiltradas.reduce((s, l) => s + (l.valor_liquido ?? 0), 0),
    })
  }
  // Ordena por data do pedido desc (mesma ordem da tabela)
  compras.sort((a, b) => (b.data_pedido ?? '').localeCompare(a.data_pedido ?? ''))
  return compras
}
