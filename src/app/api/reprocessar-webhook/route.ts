import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TABELAS_PERMITIDAS = ['raw_vendas', 'raw_webnario', 'raw_grupos_wpp'] as const
type TabelaPermitida = typeof TABELAS_PERMITIDAS[number]

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('perfil')
    .eq('id', user.id)
    .single()

  if (profile?.perfil !== 'admin') {
    return NextResponse.json({ error: 'acesso negado' }, { status: 403 })
  }

  const { tabela } = await req.json()

  if (!TABELAS_PERMITIDAS.includes(tabela as TabelaPermitida)) {
    return NextResponse.json({ error: 'tabela inválida' }, { status: 400 })
  }

  const { error, data } = await supabase
    .from(tabela as TabelaPermitida)
    .update({ processed: false, error: null })
    .eq('processed', false)
    .not('error', 'is', null)
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reprocessados: data?.length ?? 0 })
}
