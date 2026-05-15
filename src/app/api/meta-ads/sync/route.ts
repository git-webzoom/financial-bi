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

  const { account_id, mode } = await req.json()

  const payload: Record<string, string> = {}
  if (account_id) payload.account_id = account_id
  if (mode)       payload.mode       = mode

  // Fire-and-forget: não aguarda a edge function terminar para evitar timeout da Vercel (60s)
  fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/job-meta-ads`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  ).catch(() => { /* erro será registrado no integration_job_runs pela edge function */ })

  return NextResponse.json({ ok: true, message: 'Sync iniciado. Acompanhe o progresso em Configurações → Integrações.' })
}
