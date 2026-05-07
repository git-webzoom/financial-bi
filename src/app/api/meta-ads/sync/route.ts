import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('perfil').eq('id', user.id).single()
  if (profile?.perfil !== 'admin')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { account_id } = await req.json()

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/job-meta-ads`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(account_id ? { account_id } : {}),
    }
  )

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? 'Erro ao sincronizar' }, { status: res.status })
  }

  return NextResponse.json(data)
}
