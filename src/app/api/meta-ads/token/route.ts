import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('perfil').eq('id', user.id).single()
  if (profile?.perfil !== 'admin')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { token, expires_at } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  // Usa service role para ignorar RLS
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: existing } = await admin
    .from('integration_tokens')
    .select('id')
    .eq('integration', 'meta_ads')
    .maybeSingle()

  if (existing?.id) {
    await admin.from('integration_tokens').update({
      vault_key:        token,
      expires_at:       expires_at || null,
      ativo:            true,
      updated_at:       new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await admin.from('integration_tokens').insert({
      integration: 'meta_ads',
      vault_key:   token,
      expires_at:  expires_at || null,
      ativo:       true,
    })
  }

  return NextResponse.json({ ok: true })
}
