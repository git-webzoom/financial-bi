import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from './_components/Sidebar'
import Header from './_components/Header'

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
    <div className="flex min-h-screen">
      <Sidebar nomeUsuario={nomeUsuario} isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col min-w-0" style={{ backgroundColor: '#F3F4F6' }}>
        <Header nomeUsuario={nomeUsuario} />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
