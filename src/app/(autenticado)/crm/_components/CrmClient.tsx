'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SeletorSemana from './SeletorSemana'
import CrmKpis from './CrmKpis'
import CrmGraficosOrigem from './CrmGraficosOrigem'
import CrmFiltros from './CrmFiltros'
import CrmTabela from './CrmTabela'
import CrmPainelDetalhe from './CrmPainelDetalhe'

export interface InscritoCrm {
  id: string
  contato_id: string
  crm_id: string
  numero_semana: number
  data_inscricao: string | null
  email: string
  nome: string | null
  telefone: string | null
  utm_source: string | null
  utm_campaign: string | null
  utm_medium: string | null
  utm_content: string | null
  utm_term: string | null
  utm_id: string | null
  temperatura: string | null
  estado: string | null
  cidade: string | null
  data_cadastro: string | null
  emails_enviados: number | null
  emails_abertos: number | null
  cliques_email: number | null
  ultima_interacao: string | null
  data_abertura_email: string | null
  ultimo_clique: string | null
  ultimo_envio_email: string | null
  limite_engajamento: string | null
  numeros_recadastro: number | null
  comprou: boolean
  valor_compras_total: number
  outras_semanas: number[]
  lead_faixa: string | null
  lead_pontos: number | null
}

export interface FiltrosCrm {
  busca: string
  sources: string[]
  campaigns: string[]
  tipo: 'todos' | 'novos' | 'recorrentes' | 'compradores'
  temperatura: string
  sourceGrafico: string | null
  campaignGrafico: string | null
}

interface Props {
  semanaAtual: number
  semanaInicial: number
  periodoInicial: { data_inicio: string; data_fim: string; data_evento: string } | null
}

async function buscarDadosSemana(
  supabase: ReturnType<typeof createClient>,
  numeroSemana: number
): Promise<{ periodo: { data_inicio: string; data_fim: string; data_evento: string } | null; inscritos: InscritoCrm[] }> {
  await supabase.rpc('ensure_semana_existe', { p_numero: numeroSemana })

  const [{ data: periodoRaw }, { data: inscritosJson }, { data: comprasRaw }] = await Promise.all([
    supabase.rpc('get_periodo_semana', { p_numero: numeroSemana }),
    supabase.rpc('get_inscritos_semana', { p_numero: numeroSemana }),
    supabase.rpc('get_compradores_semana', { p_numero: numeroSemana }),
  ])

  const periodo = Array.isArray(periodoRaw) ? periodoRaw[0] ?? null : periodoRaw ?? null
  const lista = (inscritosJson as unknown as Record<string, unknown>[]) ?? []

  const contatoIds = lista.map((i) => i.contato_id).filter(Boolean) as string[]

  const [{ data: outrasJson }, { data: scoresJson }] = contatoIds.length > 0
    ? await Promise.all([
        supabase.rpc('get_outras_semanas_contatos', { p_contato_ids: contatoIds, p_numero: numeroSemana }),
        supabase.rpc('get_lead_scores', { p_contato_ids: contatoIds }),
      ])
    : [{ data: [] }, { data: [] }]
  const outrasRaw = (outrasJson as unknown as { contato_id: string; numero_semana: number }[]) ?? []

  const scoresRaw = (scoresJson as unknown as { contato_id: string; pontos_total: number; faixa: string }[]) ?? []
  const scorePorContato: Record<string, { faixa: string; pontos: number }> = {}
  for (const s of scoresRaw) {
    scorePorContato[s.contato_id] = { faixa: s.faixa, pontos: s.pontos_total }
  }

  const compradoresSet = new Set((comprasRaw ?? []).map((v: { contato_id: string }) => v.contato_id))
  const totalPorContato: Record<string, number> = {}
  for (const v of comprasRaw ?? []) {
    totalPorContato[(v as { contato_id: string; valor_total: number }).contato_id] = (v as { contato_id: string; valor_total: number }).valor_total ?? 0
  }

  const outrasPorContato: Record<string, number[]> = {}
  for (const os of outrasRaw) {
    if (!outrasPorContato[os.contato_id]) outrasPorContato[os.contato_id] = []
    outrasPorContato[os.contato_id].push(os.numero_semana)
  }

  const inscritos = (lista.map((i) => {
    const contatoId = String(i.contato_id ?? '')
    return {
      id: i.id as string, contato_id: contatoId, crm_id: i.crm_id as string ?? '',
      numero_semana: i.numero_semana as number, data_inscricao: i.data_inscricao as string ?? null,
      email: i.crm_email ?? '', nome: i.crm_nome ?? null, telefone: i.crm_telefone ?? null,
      utm_source: i.utm_source ?? null, utm_campaign: i.utm_campaign ?? null,
      utm_medium: i.utm_medium ?? null, utm_content: i.utm_content ?? null,
      utm_term: i.utm_term ?? null, utm_id: i.utm_id ?? null,
      temperatura: i.crm_temperatura ?? null, estado: i.crm_estado ?? null,
      cidade: i.crm_cidade ?? null, data_cadastro: i.crm_data_cadastro ?? null,
      emails_enviados: i.crm_emails_enviados ?? null, emails_abertos: i.crm_emails_abertos ?? null,
      cliques_email: i.crm_cliques_email ?? null, ultima_interacao: i.crm_ultima_interacao ?? null,
      data_abertura_email: i.crm_data_abertura_email ?? null, ultimo_clique: i.crm_ultimo_clique ?? null,
      ultimo_envio_email: i.crm_ultimo_envio_email ?? null, limite_engajamento: i.crm_limite_engajamento ?? null,
      numeros_recadastro: i.crm_numeros_recadastro ?? null,
      comprou: compradoresSet.has(contatoId), valor_compras_total: totalPorContato[contatoId] ?? 0,
      outras_semanas: outrasPorContato[contatoId] ?? [],
      lead_faixa: scorePorContato[contatoId]?.faixa ?? null,
      lead_pontos: scorePorContato[contatoId]?.pontos ?? null,
    }
  })) as unknown as InscritoCrm[]

  return { periodo, inscritos }
}

export default function CrmClient({ semanaAtual, semanaInicial, periodoInicial }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [semana, setSemana] = useState(semanaInicial)
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [inscritos, setInscritos] = useState<InscritoCrm[]>([])
  const [carregando, setCarregando] = useState(true)
  const [inscritoSelecionado, setInscritoSelecionado] = useState<InscritoCrm | null>(null)
  const [reprocessando, setReprocessando] = useState(false)
  const [avisoRescore, setAvisoRescore] = useState<string | null>(null)
  const semanaCarregada = useRef<number | null>(null)

  const [filtros, setFiltros] = useState<FiltrosCrm>({
    busca: '',
    sources: [],
    campaigns: [],
    tipo: 'todos',
    temperatura: '',
    sourceGrafico: null,
    campaignGrafico: null,
  })

  // Carrega dados sempre no cliente, na montagem e ao trocar de semana
  useEffect(() => {
    if (semanaCarregada.current === semanaInicial) return
    semanaCarregada.current = semanaInicial
    setCarregando(true)
    buscarDadosSemana(supabase, semanaInicial).then(({ periodo: p, inscritos: i }) => {
      setPeriodo(p)
      setInscritos(i)
      setSemana(semanaInicial)
      setCarregando(false)
    })
  // supabase é estável entre renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaInicial])

  const carregarSemana = useCallback(async (novaS: number) => {
    setCarregando(true)
    setFiltros(f => ({ ...f, sourceGrafico: null, campaignGrafico: null }))
    semanaCarregada.current = novaS

    const { periodo: p, inscritos: i } = await buscarDadosSemana(supabase, novaS)
    setPeriodo(p)
    setInscritos(i)
    setSemana(novaS)
    setCarregando(false)

    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', String(novaS))
    router.push(`?${params.toString()}`, { scroll: false })
  }, [supabase, router, searchParams])

  // Re-score em lote: recalcula TODOS os leads com os pontos atuais da scorecard
  // (RPC reprocessar_lead_scores). Use após editar lead_score_pontos. Recarrega a
  // semana atual ao final para os badges refletirem os scores novos.
  const recalcularScores = useCallback(async () => {
    if (reprocessando) return
    if (!window.confirm(
      'Recalcular o Lead Score de TODOS os leads?\n\n' +
      'Isso SÓ precisa ser feito se os valores de pontuação foram alterados. ' +
      'Se a pontuação não mudou, não há necessidade de recalcular (o resultado será o mesmo).\n\n' +
      'Deseja continuar?'
    )) return

    setReprocessando(true)
    setAvisoRescore(null)
    const { data, error } = await supabase.rpc('reprocessar_lead_scores')
    if (error) {
      setReprocessando(false)
      setAvisoRescore('Erro ao recalcular. Tente novamente.')
      return
    }

    const r = (data ?? {}) as { total_processados?: number; pontos_mudaram?: number; faixas_mudaram?: number }
    setAvisoRescore(
      `${r.total_processados ?? 0} leads reprocessados · ${r.pontos_mudaram ?? 0} com pontos alterados · ${r.faixas_mudaram ?? 0} mudaram de faixa.`
    )

    // recarrega a semana visível para refletir os novos scores
    const { periodo: p, inscritos: i } = await buscarDadosSemana(supabase, semana)
    setPeriodo(p)
    setInscritos(i)
    setReprocessando(false)
  }, [supabase, semana, reprocessando])

  const inscritosFiltrados = useMemo(() => {
    return inscritos.filter((i) => {
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase()
        if (!i.nome?.toLowerCase().includes(q) && !i.email.toLowerCase().includes(q)) return false
      }
      if (filtros.sources.length > 0 && !filtros.sources.includes(i.utm_source ?? '')) return false
      if (filtros.campaigns.length > 0 && !filtros.campaigns.includes(i.utm_campaign ?? '')) return false
      if (filtros.temperatura && i.temperatura !== filtros.temperatura) return false
      if (filtros.sourceGrafico && i.utm_source !== filtros.sourceGrafico) return false
      if (filtros.campaignGrafico && i.utm_campaign !== filtros.campaignGrafico) return false
      if (filtros.tipo === 'novos' && i.outras_semanas.length > 0) return false
      if (filtros.tipo === 'recorrentes' && i.outras_semanas.length === 0) return false
      if (filtros.tipo === 'compradores' && !i.comprou) return false
      return true
    })
  }, [inscritos, filtros])

  return (
    <div className="p-4 md:p-6 space-y-5" style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}>

      <SeletorSemana
        semana={semana}
        semanaAtual={semanaAtual}
        periodo={periodo}
        carregando={carregando}
        onMudar={carregarSemana}
      />

      <CrmKpis inscritos={inscritos} carregando={carregando} />

      <CrmGraficosOrigem
        inscritos={inscritos}
        carregando={carregando}
        sourceAtivo={filtros.sourceGrafico}
        campaignAtivo={filtros.campaignGrafico}
        onSource={(s) => setFiltros(f => ({ ...f, sourceGrafico: f.sourceGrafico === s ? null : s }))}
        onCampaign={(c) => setFiltros(f => ({ ...f, campaignGrafico: f.campaignGrafico === c ? null : c }))}
      />

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div>
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>
              Inscritos da Semana {semana}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
              {inscritosFiltrados.length} de {inscritos.length} inscritos
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {avisoRescore && (
              <span className="text-xs px-2.5 py-1 rounded-md" style={{ backgroundColor: '#0F1A2A', color: '#60A5FA' }}>
                {avisoRescore}
              </span>
            )}
            <button
              onClick={recalcularScores}
              disabled={reprocessando}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#1A1A1A', color: '#C9A84C', border: '1px solid #333333' }}
              onMouseEnter={e => { if (!reprocessando) (e.currentTarget as HTMLElement).style.borderColor = '#C9A84C' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#333333'}
              title="Recalcula o Lead Score de todos os leads com a pontuação atual. Use após editar a tabela de pontos."
            >
              {reprocessando ? 'Recalculando…' : 'Recalcular scores'}
            </button>
            <button
              onClick={() => {
                const BOM = '﻿'
                const cabecalho = ['nome','email','telefone','data_cadastro','utm_source','utm_campaign','utm_medium','utm_content','utm_term','utm_id','temperatura','estado','cidade','comprou','valor_compras_total','semanas_participou']
                const linhas = inscritosFiltrados.map(i => [
                  i.nome ?? '', i.email, i.telefone ?? '', i.data_cadastro ?? '',
                  i.utm_source ?? '', i.utm_campaign ?? '', i.utm_medium ?? '',
                  i.utm_content ?? '', i.utm_term ?? '', i.utm_id ?? '',
                  i.temperatura ?? '', i.estado ?? '', i.cidade ?? '',
                  i.comprou ? 'Sim' : 'Não',
                  String(i.valor_compras_total),
                  [semana, ...i.outras_semanas].join(';'),
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                const csv = BOM + [cabecalho.join(','), ...linhas].join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                const d = new Date()
                a.href = url
                a.download = `inscritos-semana-${semana}-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <CrmFiltros
          inscritos={inscritos}
          filtros={filtros}
          onChange={setFiltros}
        />

        <CrmTabela
          inscritos={inscritosFiltrados}
          carregando={carregando}
          onSelecionar={setInscritoSelecionado}
        />
      </div>

      {inscritoSelecionado && (
        <CrmPainelDetalhe
          inscrito={inscritoSelecionado}
          onClose={() => setInscritoSelecionado(null)}
        />
      )}
    </div>
  )
}
