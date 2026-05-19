import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verificarAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('perfil').eq('id', user.id).single()
  if (profile?.perfil !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const mode = body.mode === 'lookback' ? 'lookback' : 'daily'

  const edgeFnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/job-sendflow-metricas`

  const res = await fetch(edgeFnUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ mode }),
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    return NextResponse.json(
      { error: json.error ?? `Edge function retornou ${res.status}` },
      { status: 500 }
    )
  }

  return NextResponse.json(json)
}
