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

// GET — lista todos os usuários
export async function GET() {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const admin = adminClient()
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, nome, perfil, ativo, created_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Busca emails na auth.users via admin API
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap = new Map((authUsers?.users ?? []).map(u => [u.id, u.email]))

  const usuarios = (profiles ?? []).map(p => ({
    ...p,
    email: emailMap.get(p.id) ?? null,
  }))

  return NextResponse.json({ usuarios })
}

// POST — criar novo usuário
export async function POST(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { nome, email, senha, perfil } = await req.json()

  if (!nome?.trim() || !email?.trim() || !senha?.trim()) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (!['admin', 'user'].includes(perfil)) {
    return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 })
  }
  if (senha.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const admin = adminClient()

  // Cria o usuário no auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: senha,
    email_confirm: true,
  })

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Este e-mail já está cadastrado.'
      : authError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // Cria o perfil
  const { error: profileError } = await admin.from('profiles').insert({
    id:     authData.user.id,
    nome:   nome.trim(),
    perfil: perfil,
    ativo:  true,
  })

  if (profileError) {
    // Rollback: remove o usuário do auth se o perfil falhou
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({
    usuario: {
      id:         authData.user.id,
      nome:       nome.trim(),
      email:      email.trim(),
      perfil:     perfil,
      ativo:      true,
      created_at: authData.user.created_at,
    }
  })
}

// PATCH — atualizar perfil ou ativo
export async function PATCH(req: NextRequest) {
  const user = await verificarAdmin()
  if (!user) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id, nome, perfil, ativo, senha } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const admin = adminClient()

  // Atualiza perfil
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nome    !== undefined) updates.nome   = nome.trim()
  if (perfil  !== undefined) updates.perfil = perfil
  if (ativo   !== undefined) updates.ativo  = ativo

  const { error: profileError } = await admin.from('profiles').update(updates).eq('id', id)
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  // Atualiza senha se fornecida
  if (senha) {
    if (senha.length < 6) return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    const { error: senhaError } = await admin.auth.admin.updateUserById(id, { password: senha })
    if (senhaError) return NextResponse.json({ error: senhaError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — remover usuário
export async function DELETE(req: NextRequest) {
  const adminUser = await verificarAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  // Não permite apagar a si mesmo
  if (id === adminUser.id) {
    return NextResponse.json({ error: 'Você não pode remover sua própria conta.' }, { status: 400 })
  }

  const admin = adminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
