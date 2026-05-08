import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const TABELAS_PERMITIDAS = ['raw_vendas', 'raw_webnario', 'raw_grupos_wpp'] as const
type TabelaPermitida = typeof TABELAS_PERMITIDAS[number]

export async function GET(req: NextRequest) {
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

  const tabela = req.nextUrl.searchParams.get('tabela') as TabelaPermitida | null
  if (!tabela || !TABELAS_PERMITIDAS.includes(tabela)) {
    return NextResponse.json({ error: 'tabela inválida' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from(tabela)
    .select('id, error, payload, received_at')
    .eq('processed', false)
    .not('error', 'is', null)
    .order('received_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ webhooks: data ?? [] })
}
