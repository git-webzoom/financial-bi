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

// POST /api/sendflow/campanha — add campaign by ID (fetches name from Sendflow API)
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  if (!id?.trim()) {
    return NextResponse.json({ error: 'ID da campanha é obrigatório' }, { status: 400 })
  }

  const admin = adminClient()

  // Get Sendflow token
  const { data: tokenData } = await admin
    .from('integration_tokens')
    .select('vault_key, config')
    .eq('integration', 'sendflow')
    .eq('ativo', true)
    .maybeSingle()

  if (!tokenData?.vault_key) {
    return NextResponse.json({ error: 'Token Sendflow não configurado' }, { status: 400 })
  }

  const baseUrl = (tokenData.config as { base_url?: string })?.base_url ?? 'https://sendflow.pro/sendapi'

  // Fetch campaign from Sendflow API
  const res = await fetch(`${baseUrl}/releases/${id.trim()}`, {
    headers: { Authorization: `Bearer ${tokenData.vault_key}` },
  })

  if (!res.ok) {
    if (res.status === 404) {
      return NextResponse.json({ error: 'Campanha não encontrada na Sendflow' }, { status: 404 })
    }
    return NextResponse.json({ error: `Erro na API Sendflow: ${res.status}` }, { status: 502 })
  }

  const campData = await res.json() as Record<string, unknown>

  if ((campData as { code?: string }).code === 'rate-limit-exceeded') {
    return NextResponse.json({ error: 'Rate limit da Sendflow — tente novamente em instantes' }, { status: 429 })
  }

  const nome = String(campData.name ?? id.trim())
  const ativo = campData.archived !== true

  const { error } = await admin
    .from('sendflow_campanhas')
    .upsert(
      {
        id:         id.trim(),
        nome,
        ativo,
        monitorada: true,
        raw:        campData,
        synced_at:  new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: id.trim(), nome, ativo })
}

// PATCH /api/sendflow/campanha — update coletar_metricas flag
export async function PATCH(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, coletar_metricas } = await req.json()
  if (!id?.trim() || typeof coletar_metricas !== 'boolean') {
    return NextResponse.json({ error: 'id e coletar_metricas são obrigatórios' }, { status: 400 })
  }

  const admin = adminClient()

  const { error } = await admin
    .from('sendflow_campanhas')
    .update({ coletar_metricas })
    .eq('id', id.trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE /api/sendflow/campanha — unmonitor campaign (sets monitorada = false)
export async function DELETE(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  if (!id?.trim()) {
    return NextResponse.json({ error: 'ID da campanha é obrigatório' }, { status: 400 })
  }

  const admin = adminClient()

  const { error } = await admin
    .from('sendflow_campanhas')
    .update({ monitorada: false })
    .eq('id', id.trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
