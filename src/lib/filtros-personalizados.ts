export type Operador = 'contem' | 'nao_contem' | 'igual' | 'comeca_com' | 'maior_que' | 'menor_que' | 'maior_igual' | 'menor_igual'
export type Modulo   = 'trafego' | 'vendas'
// Como as regras de um filtro são combinadas entre si: 'and' = todas, 'or' = qualquer.
export type LogicaFiltro = 'and' | 'or'

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
  logica:     LogicaFiltro
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
  { value: 'contem',      label: 'contém'          },
  { value: 'nao_contem',  label: 'não contém'      },
  { value: 'igual',       label: 'igual a'         },
  { value: 'comeca_com',  label: 'começa com'      },
  { value: 'maior_que',   label: 'maior que'       },
  { value: 'maior_igual', label: 'maior ou igual a'},
  { value: 'menor_que',   label: 'menor que'       },
  { value: 'menor_igual', label: 'menor ou igual a'},
]

// Protege o valor dentro de uma string `.or()` do PostgREST: `,` `.` `(` `)` `:` são
// caracteres estruturais lá dentro; envolvendo em aspas duplas (com escape das aspas
// internas) o PostgREST trata o conteúdo como literal. Dentro de `ilike` numa string
// `.or()`, o coringa é `*` (não `%`) — quem chama já monta o padrão com `*`.
function orVal(v: string): string {
  return `"${String(v).replace(/"/g, '\\"')}"`
}

// Aplica as regras de um filtro personalizado a um query builder do Supabase.
// - logica 'and' (default): comportamento histórico — encadeia as condições (= AND). Não mexer.
// - logica 'or': combina TODAS as regras num único `.or(...)` (= OR entre si). Esse `.or()`
//   fica em AND com os demais filtros da query (data, produto_id, etc.), que é o desejado.
// ATENÇÃO: existe um espelho desta função em trafego/_components/TrafegoClient.tsx e uma
// versão SQL em get_trafego_ads_aba — mantenha a semântica das três em sincronia.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function aplicarRegras(q: any, regras: RegraFiltro[], logica: LogicaFiltro = 'and'): any {
  if (logica !== 'or') {
    for (const { campo, operador, valor } of regras) {
      const n = Number(valor)
      switch (operador) {
        case 'contem':      q = q.ilike(campo, `%${valor}%`); break
        case 'nao_contem':  q = q.not(campo, 'ilike', `%${valor}%`); break
        case 'igual':       q = q.eq(campo, valor); break
        case 'comeca_com':  q = q.ilike(campo, `${valor}%`); break
        case 'maior_que':   q = q.gt(campo, n); break
        case 'maior_igual': q = q.gte(campo, n); break
        // "menor que/ou igual" inclui registros SEM valor (NULL): no Postgres `NULL <= n` é falso,
        // mas uma compra avulsa (sem ciclo de assinatura) deve passar no filtro "Sem Renovação".
        case 'menor_que':   q = q.or(`${campo}.lt.${n},${campo}.is.null`); break
        case 'menor_igual': q = q.or(`${campo}.lte.${n},${campo}.is.null`); break
      }
    }
    return q
  }

  // Modo OR: uma única .or() com todas as condições (o coringa em ilike é `*`, não `%`).
  const conds: string[] = []
  for (const { campo, operador, valor } of regras) {
    const n = Number(valor)
    switch (operador) {
      case 'contem':      conds.push(`${campo}.ilike.${orVal(`*${valor}*`)}`); break
      case 'nao_contem':  conds.push(`${campo}.not.ilike.${orVal(`*${valor}*`)}`); break
      case 'igual':       conds.push(`${campo}.eq.${orVal(valor)}`); break
      case 'comeca_com':  conds.push(`${campo}.ilike.${orVal(`${valor}*`)}`); break
      case 'maior_que':   conds.push(`${campo}.gt.${n}`); break
      case 'maior_igual': conds.push(`${campo}.gte.${n}`); break
      // Os registros NULL (ver comentário acima) já são absorvidos: aqui é tudo OR entre si.
      case 'menor_que':   conds.push(`${campo}.lt.${n}`, `${campo}.is.null`); break
      case 'menor_igual': conds.push(`${campo}.lte.${n}`, `${campo}.is.null`); break
    }
  }
  if (conds.length) q = q.or(conds.join(','))
  return q
}
