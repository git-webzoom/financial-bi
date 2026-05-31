// Abas dinâmicas do dashboard — tipos e mapa de extensibilidade.
// Cada aba usa um TIPO DE MOCKUP (template) e vínculos a filtros já existentes
// em filtros_personalizados, identificados por um "papel" (role).
//   - venda_direta: papéis 'trafego' e 'vendas' (é o dash TPW)
//   - captacao:     FUTURO (papéis novos: leads_tag, sendflow, ...)

export type TipoMockup  = 'venda_direta' | 'captacao'
// O banco aceita papel livre (text); esta união existe só para DX no frontend.
export type PapelFiltro = 'trafego' | 'vendas' | 'leads_tag' | 'sendflow'

export interface VinculoFiltro {
  papel:     PapelFiltro
  filtro_id: string | null
}

export interface DashboardAba {
  id:              string
  nome:            string
  tipo_mockup:     TipoMockup
  ordem:           number
  ativo:           boolean
  vinculos:        VinculoFiltro[]                                    // bruto (1 por papel)
  filtrosPorPapel: Partial<Record<PapelFiltro, string | null>>       // derivado p/ consumo fácil
}

// Ponto ÚNICO de extensibilidade: dirige o formulário de Configurações
// E a leitura dos filtros no dashboard. Para habilitar a Captação no futuro,
// basta preencher a lista de 'captacao' (e habilitá-la em TIPOS_MOCKUP).
export const PAPEIS_POR_MOCKUP: Record<
  TipoMockup,
  { papel: PapelFiltro; modulo: 'trafego' | 'vendas'; label: string }[]
> = {
  venda_direta: [
    { papel: 'trafego', modulo: 'trafego', label: 'Filtro de Tráfego' },
    { papel: 'vendas',  modulo: 'vendas',  label: 'Filtro de Vendas'  },
  ],
  captacao: [], // FUTURO
}

export const TIPOS_MOCKUP: { value: TipoMockup; label: string; disponivel: boolean }[] = [
  { value: 'venda_direta', label: 'Venda Direta', disponivel: true  },
  { value: 'captacao',     label: 'Captação',     disponivel: false }, // em breve
]

// Linhas cruas vindas do Supabase (dashboard_abas + dashboard_aba_filtros).
interface AbaRow {
  id:          string
  nome:        string
  tipo_mockup: string
  ordem:       number
  ativo:       boolean
}
interface VinculoRow {
  aba_id:    string
  papel:     string
  filtro_id: string | null
}

// Agrupa os vínculos por aba e deriva o dicionário filtrosPorPapel.
// Reaproveitado pelo dashboard e pela página de Configurações.
export function montarAbas(abasRaw: AbaRow[], vinculosRaw: VinculoRow[]): DashboardAba[] {
  return abasRaw.map(a => {
    const vinculos: VinculoFiltro[] = vinculosRaw
      .filter(v => v.aba_id === a.id)
      .map(v => ({ papel: v.papel as PapelFiltro, filtro_id: v.filtro_id }))

    const filtrosPorPapel: Partial<Record<PapelFiltro, string | null>> = {}
    for (const v of vinculos) filtrosPorPapel[v.papel] = v.filtro_id

    return {
      id:          a.id,
      nome:        a.nome,
      tipo_mockup: a.tipo_mockup as TipoMockup,
      ordem:       a.ordem,
      ativo:       a.ativo,
      vinculos,
      filtrosPorPapel,
    }
  })
}
