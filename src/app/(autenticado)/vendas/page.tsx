import { createClient } from '@/lib/supabase/server'
import VendasClient from './_components/VendasClient'

const PAGE_SIZE = 20

function dataISOLocal(date: Date): string {
  return date.toISOString().split('T')[0]
}

export default async function VendasPage() {
  const supabase = createClient()

  const hoje = new Date()
  const trintaDiasAtras = new Date()
  trintaDiasAtras.setDate(hoje.getDate() - 30)

  const dataFim   = dataISOLocal(hoje)
  const dataInicio = dataISOLocal(trintaDiasAtras)
  const inicio = dataInicio + 'T00:00:00-03:00'
  const fim    = dataFim    + 'T23:59:59-03:00'

  // Produtos distintos que foram vendidos — tudo vem de vendas
  const { data: produtosRaw } = await supabase
    .from('vendas')
    .select('produto_id, nome_oferta')
    .not('produto_id', 'is', null)

  // Busca os nomes na tabela produtos para montar o filtro
  const produtoIds = Array.from(new Set((produtosRaw ?? []).map((r) => r.produto_id).filter(Boolean)))
  const { data: produtosNomes } = produtoIds.length > 0
    ? await supabase.from('produtos').select('id, nome').in('id', produtoIds)
    : { data: [] }

  // Monta lista única: usa nome da tabela produtos se existir, senão nome_oferta como fallback
  const produtos = produtoIds.map((id) => ({
    id: id as string,
    nome: produtosNomes?.find((p) => p.id === id)?.nome ?? id,
  })).sort((a, b) => a.nome.localeCompare(b.nome))

  // Primeira página — select simples sem join (FKs foram removidas)
  const { data: vendas, count } = await supabase
    .from('vendas')
    .select('*', { count: 'exact' })
    .gte('data_pedido', inicio)
    .lte('data_pedido', fim)
    .order('data_pedido', { ascending: false })
    .range(0, PAGE_SIZE - 1)

  // KPIs iniciais — agregado no banco para evitar limite de 1000 linhas
  const { data: k } = await supabase.rpc('get_kpis_vendas', {
    p_inicio:      inicio,
    p_fim:         fim,
    p_produto_id:  null,
    p_marketplace: null,
  })

  const bruto   = k?.faturamentoBruto  ?? 0
  const nVendas = k?.totalVendas       ?? 0

  const initialKpis = {
    faturamentoBruto:   bruto,
    faturamentoLiquido: k?.faturamentoLiquido ?? 0,
    totalVendas:        nVendas,
    ticketMedio:        nVendas > 0 ? bruto / nVendas : 0,
    reembolsos:         k?.reembolsos  ?? 0,
    chargebacks:        k?.chargebacks ?? 0,
  }

  return (
    <VendasClient
      produtos={produtos}
      initialVendas={(vendas as any) ?? []}
      initialTotal={count ?? 0}
      initialKpis={initialKpis}
      dataInicioDefault={dataInicio}
      dataFimDefault={dataFim}
    />
  )
}
