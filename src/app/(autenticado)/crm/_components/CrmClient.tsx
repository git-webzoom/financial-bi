'use client'

import { useState, useCallback, useMemo } from 'react'
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
  inscritosIniciais: InscritoCrm[]
}

export default function CrmClient({ semanaAtual, semanaInicial, periodoInicial, inscritosIniciais }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [semana, setSemana] = useState(semanaInicial)
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [inscritos, setInscritos] = useState<InscritoCrm[]>(inscritosIniciais)
  const [carregando, setCarregando] = useState(false)
  const [inscritoSelecionado, setInscritoSelecionado] = useState<InscritoCrm | null>(null)

  const [filtros, setFiltros] = useState<FiltrosCrm>({
    busca: '',
    sources: [],
    campaigns: [],
    tipo: 'todos',
    temperatura: '',
    sourceGrafico: null,
    campaignGrafico: null,
  })

  const carregarSemana = useCallback(async (novaS: number) => {
    setCarregando(true)
    setFiltros(f => ({ ...f, sourceGrafico: null, campaignGrafico: null }))

    await supabase.rpc('ensure_semana_existe', { p_numero: novaS })
    const { data: periodoRaw } = await supabase.rpc('get_periodo_semana', { p_numero: novaS })
    const novoPeriodo = Array.isArray(periodoRaw) ? periodoRaw[0] ?? null : periodoRaw ?? null
    setPeriodo(novoPeriodo)

    const { data: novosInscritos } = await supabase
      .from('webinario_inscritos')
      .select(`
        id, numero_semana, data_inscricao,
        utm_source, utm_campaign, utm_medium, utm_content, utm_term, utm_id,
        crm:crm_id (
          id, email, nome, telefone,
          temperatura, estado, cidade, data_cadastro,
          emails_enviados, emails_abertos, cliques_email,
          ultima_interacao, data_abertura_email, ultimo_clique,
          ultimo_envio_email, limite_engajamento, numeros_recadastro
        ),
        contatos:contato_id ( id )
      `)
      .eq('numero_semana', novaS)
      .order('data_inscricao', { ascending: false })

    const lista = novosInscritos ?? []
    const emails = lista.map((i) => ((i.crm as unknown as Record<string,unknown>))?.email as string).filter(Boolean)
    const contatoIds = lista.map((i) => ((i.contatos as unknown as Record<string,unknown>))?.id as string).filter(Boolean)

    const [comprasRes, outrasRes] = await Promise.all([
      emails.length > 0
        ? supabase.from('vendas').select('email_contato, valor_liquido').in('email_contato', emails).in('status', ['approved','complete','completed','paid','active','confirmed'])
        : { data: [] },
      contatoIds.length > 0
        ? supabase.from('webinario_inscritos').select('contato_id, numero_semana').in('contato_id', contatoIds).neq('numero_semana', novaS)
        : { data: [] },
    ])

    const compradoresSet = new Set((comprasRes.data ?? []).map((v) => v.email_contato))
    const totalPorEmail: Record<string, number> = {}
    for (const v of comprasRes.data ?? []) {
      totalPorEmail[v.email_contato] = (totalPorEmail[v.email_contato] ?? 0) + (v.valor_liquido ?? 0)
    }

    const outrasPorContato: Record<string, number[]> = {}
    for (const os of outrasRes.data ?? []) {
      if (!outrasPorContato[os.contato_id]) outrasPorContato[os.contato_id] = []
      outrasPorContato[os.contato_id].push(os.numero_semana)
    }

    const enriquecidos: InscritoCrm[] = lista.map((i) => {
      const crm = (i.crm as unknown as Record<string, unknown>) ?? {}
      const contato = (i.contatos as unknown as { id?: string }) ?? {}
      const email = crm.email as string ?? ''
      const contatoId = contato.id ?? ''
      return {
        id: i.id as string, contato_id: contatoId, crm_id: crm.id as string ?? '',
        numero_semana: i.numero_semana as number, data_inscricao: i.data_inscricao as string ?? null,
        email, nome: crm.nome as string ?? null, telefone: crm.telefone as string ?? null,
        // UTMs de captação — congeladas no webinario_inscritos
        utm_source: i.utm_source as string ?? null, utm_campaign: i.utm_campaign as string ?? null,
        utm_medium: i.utm_medium as string ?? null, utm_content: i.utm_content as string ?? null,
        utm_term: i.utm_term as string ?? null, utm_id: i.utm_id as string ?? null,
        // Engajamento — sempre atualizado do crm
        temperatura: crm.temperatura as string ?? null, estado: crm.estado as string ?? null,
        cidade: crm.cidade as string ?? null, data_cadastro: crm.data_cadastro as string ?? null,
        emails_enviados: crm.emails_enviados as number ?? null, emails_abertos: crm.emails_abertos as number ?? null,
        cliques_email: crm.cliques_email as number ?? null, ultima_interacao: crm.ultima_interacao as string ?? null,
        data_abertura_email: crm.data_abertura_email as string ?? null, ultimo_clique: crm.ultimo_clique as string ?? null,
        ultimo_envio_email: crm.ultimo_envio_email as string ?? null, limite_engajamento: crm.limite_engajamento as string ?? null,
        numeros_recadastro: crm.numeros_recadastro as number ?? null,
        comprou: compradoresSet.has(email), valor_compras_total: totalPorEmail[email] ?? 0,
        outras_semanas: outrasPorContato[contatoId] ?? [],
      }
    })

    setInscritos(enriquecidos)
    setSemana(novaS)
    setCarregando(false)

    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', String(novaS))
    router.push(`?${params.toString()}`, { scroll: false })
  }, [supabase, router, searchParams])

  // Filtros aplicados
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
    <div className="p-6 space-y-5" style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}>

      {/* Seletor de Semana */}
      <SeletorSemana
        semana={semana}
        semanaAtual={semanaAtual}
        periodo={periodo}
        carregando={carregando}
        onMudar={carregarSemana}
      />

      {/* KPIs */}
      <CrmKpis inscritos={inscritos} carregando={carregando} />

      {/* Gráficos */}
      <CrmGraficosOrigem
        inscritos={inscritos}
        carregando={carregando}
        sourceAtivo={filtros.sourceGrafico}
        campaignAtivo={filtros.campaignGrafico}
        onSource={(s) => setFiltros(f => ({ ...f, sourceGrafico: f.sourceGrafico === s ? null : s }))}
        onCampaign={(c) => setFiltros(f => ({ ...f, campaignGrafico: f.campaignGrafico === c ? null : c }))}
      />

      {/* Filtros + Tabela */}
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

      {/* Painel lateral */}
      {inscritoSelecionado && (
        <CrmPainelDetalhe
          inscrito={inscritoSelecionado}
          onClose={() => setInscritoSelecionado(null)}
        />
      )}
    </div>
  )
}
