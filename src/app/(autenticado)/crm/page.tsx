import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CrmClient from './_components/CrmClient'

export default async function CrmPage({
  searchParams,
}: {
  searchParams: { semana?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: semanaAtual } = await supabase.rpc('get_semana_atual')
  const semanaDefault = semanaAtual as number ?? 172

  const semana = searchParams.semana ? parseInt(searchParams.semana, 10) : semanaDefault
  const semanaValida = isNaN(semana) ? semanaDefault : semana

  await supabase.rpc('ensure_semana_existe', { p_numero: semanaValida })

  const { data: periodoRaw } = await supabase.rpc('get_periodo_semana', { p_numero: semanaValida })
  const periodo = Array.isArray(periodoRaw) ? periodoRaw[0] ?? null : periodoRaw ?? null

  return (
    <CrmClient
      semanaAtual={semanaDefault}
      semanaInicial={semanaValida}
      periodoInicial={periodo ?? null}
    />
  )
}
