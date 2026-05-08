import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function adminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

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

  const { token, base_url } = await req.json()
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 })
  }
  if (!base_url?.trim()) {
    return NextResponse.json({ error: 'URL base é obrigatória' }, { status: 400 })
  }

  // Normaliza: remove trailing slash e /api/3 se o usuário colou a URL completa
  const normalizedUrl = base_url.trim().replace(/\/api\/3\/?$/, '').replace(/\/$/, '')

  const admin = adminClient()

  const { error } = await admin
    .from('integration_tokens')
    .upsert(
      {
        integration:      'activecampaign',
        vault_key:        token.trim(),
        ativo:            true,
        config:           { base_url: normalizedUrl },
        last_sync_at:     null,
        last_sync_status: null,
      },
      { onConflict: 'integration' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
