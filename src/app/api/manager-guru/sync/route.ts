import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function verificarAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('perfil').eq('id', user.id).single()
  if (profile?.perfil !== 'admin') return null
  return user
}

export async function POST() {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_KEY!

  const resp = await fetch(`${supabaseUrl}/functions/v1/job-manager-guru`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: '{}',
  })

  const data = await resp.json()
  if (!resp.ok) return NextResponse.json(data, { status: resp.status })
  return NextResponse.json(data)
}
