import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LayoutShell from './_components/LayoutShell'

export default async function LayoutAutenticado({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('nome, perfil')
    .eq('id', user.id)
    .single()

  const nomeUsuario = profile?.nome ?? user.email ?? 'Usuário'
  const isAdmin = profile?.perfil === 'admin'

  return (
    <LayoutShell nomeUsuario={nomeUsuario} isAdmin={isAdmin}>
      {children}
    </LayoutShell>
  )
}
