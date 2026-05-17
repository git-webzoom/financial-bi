export type Operador = 'contem' | 'nao_contem' | 'igual' | 'comeca_com' | 'maior_que' | 'menor_que'
export type Modulo   = 'trafego' | 'vendas'

export interface RegraFiltro {
  id?:        string
  filtro_id?: string
  campo:      string
  operador:   Operador
  valor:      string
  ordem:      number
}

export interface FiltroPersonalizado {
  id:         string
  nome:       string
  modulo:     Modulo
  ativo:      boolean
  criado_por: string | null
  created_at: string
  regras:     RegraFiltro[]
}

export const CAMPOS_POR_MODULO: Record<Modulo, { value: string; label: string }[]> = {
  trafego: [
    { value: 'campaign_name', label: 'Nome da campanha' },
    { value: 'adset_name',    label: 'Nome do conjunto' },
    { value: 'ad_name',       label: 'Nome do anúncio'  },
    { value: 'ad_account_id', label: 'Conta de anúncio' },
  ],
  vendas: [
    { value: 'nome_oferta',  label: 'Nome da oferta'  },
    { value: 'status',       label: 'Status'           },
    { value: 'pagamento',    label: 'Pagamento'        },
    { value: 'marketplace',  label: 'Marketplace'      },
    { value: 'utm_source',       label: 'UTM Source'       },
    { value: 'utm_campaign',     label: 'UTM Campaign'     },
    { value: 'assinatura_ciclo', label: 'Ciclo'            },
  ],
}

export const OPERADORES: { value: Operador; label: string }[] = [
  { value: 'contem',     label: 'contém'     },
  { value: 'nao_contem', label: 'não contém' },
  { value: 'igual',      label: 'igual a'    },
  { value: 'comeca_com', label: 'começa com' },
  { value: 'maior_que',  label: 'maior que'  },
  { value: 'menor_que',  label: 'menor que'  },
]
