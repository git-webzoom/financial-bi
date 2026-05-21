import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GruposClient from './_components/GruposClient'

export interface SendflowCampanha {
  id: string
  nome: string
  total_grupos: number
  total_membros: number
  ativo: boolean
  synced_at: string | null
  created_at: string
}

export interface SendflowGrupo {
  id: string
  campanha_id: string
  nome: string
  link: string | null
  invite_code: string | null
  total_membros: number
  count: number
  grupo_cheio: boolean
  ativo: boolean
  synced_at: string | null
}

export interface GruposKpisSemana {
  numero_semana: number
  adicionados: number
  removidos: number
  no_grupo_agora: number
  membros_inicio_semana: number
}

export default async function GruposPage({
  searchParams,
}: {
  searchParams: { semana?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: campanhasRaw },
    { data: semanaAtual },
    { data: kpisRaw },
  ] = await Promise.all([
    supabase.from('sendflow_campanhas').select('id, nome, total_grupos, total_membros, ativo, synced_at, created_at').order('created_at', { ascending: false }),
    supabase.rpc('get_semana_atual'),
    supabase.from('grupos_kpis_semana').select('numero_semana, adicionados, removidos, no_grupo_agora, membros_inicio_semana').order('numero_semana', { ascending: false }),
  ])

  let semanaDefault = semanaAtual as number | null
  if (!semanaDefault) {
    const { data: ultima } = await supabase
      .from('webinario_semanas').select('numero').order('numero', { ascending: false }).limit(1).single()
    semanaDefault = (ultima?.numero as number) ?? 1
  }
  const semanaParam = searchParams.semana ? parseInt(searchParams.semana, 10) : null
  const semanaNum = semanaParam && !isNaN(semanaParam) ? semanaParam : semanaDefault

  const kpis: GruposKpisSemana[] = kpisRaw ?? []
  const kpiSemana = kpis.find(k => k.numero_semana === semanaNum) ?? { numero_semana: semanaNum, adicionados: 0, removidos: 0, no_grupo_agora: 0, membros_inicio_semana: 0 }

  const campanhas: SendflowCampanha[] = campanhasRaw ?? []

  return (
    <GruposClient
      campanhasIniciais={campanhas}
      kpisGrupo={kpiSemana}
      semanaAtual={semanaDefault}
      semanasDisponiveis={kpis.map(k => k.numero_semana)}
    />
  )
}
