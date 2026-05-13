import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import WebnarioClient from './_components/WebnarioClient'

export default async function WebnarioPage({
  searchParams,
}: {
  searchParams: { semana?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: semanaAtual } = await supabase.rpc('get_semana_webnario_ativa')
  const semanaDefault = semanaAtual as number ?? 172

  const semana = searchParams.semana ? parseInt(searchParams.semana, 10) : semanaDefault
  const semanaValida = isNaN(semana) ? semanaDefault : semana

  const { data: periodoRaw } = await supabase.rpc('get_periodo_semana', { p_numero: semanaValida })
  const periodo = Array.isArray(periodoRaw) ? periodoRaw[0] ?? null : periodoRaw ?? null

  return (
    <WebnarioClient
      semanaAtual={semanaDefault}
      semanaInicial={semanaValida}
      periodoInicial={periodo ?? null}
    />
  )
}
