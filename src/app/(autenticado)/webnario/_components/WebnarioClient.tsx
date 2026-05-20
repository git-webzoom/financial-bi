'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import SeletorSemana from '@/app/(autenticado)/crm/_components/SeletorSemana'
import WebnarioKpis from './WebnarioKpis'
import WebnarioTabela from './WebnarioTabela'

export interface PresencaWebn {
  id: string
  contato_id: string
  numero_semana: number
  email: string
  nome: string | null
  telefone: string | null
  data_acesso: string | null
  viu_pitch: boolean
  data_pitch: string | null
  comprou: boolean
  valor_compras_total: number
}

interface Props {
  semanaAtual: number
  semanaInicial: number
  periodoInicial: { data_inicio: string; data_fim: string; data_evento: string } | null
}

async function buscarDadosSemana(
  supabase: ReturnType<typeof createClient>,
  numeroSemana: number
): Promise<{ periodo: { data_inicio: string; data_fim: string; data_evento: string } | null; presencas: PresencaWebn[] }> {
  await supabase.rpc('ensure_semana_existe', { p_numero: numeroSemana })

  const [{ data: periodoRaw }, { data: presencasRaw }, { data: comprasRaw }] = await Promise.all([
    supabase.rpc('get_periodo_semana', { p_numero: numeroSemana }),
    supabase
      .from('webinario_presencas')
      .select(`
        id, contato_id, numero_semana,
        data_acesso, viu_pitch, data_pitch,
        contato:contato_id ( email, nome, telefone )
      `)
      .eq('numero_semana', numeroSemana)
      .order('data_acesso', { ascending: false }),
    supabase.rpc('get_compradores_semana', { p_numero: numeroSemana }),
  ])

  const periodo = Array.isArray(periodoRaw) ? periodoRaw[0] ?? null : periodoRaw ?? null
  const lista = presencasRaw ?? []

  const compradoresSet = new Set((comprasRaw ?? []).map((v: { contato_id: string }) => v.contato_id))
  const totalPorContato: Record<string, number> = {}
  for (const v of comprasRaw ?? []) {
    totalPorContato[(v as { contato_id: string; valor_total: number }).contato_id] = (v as { contato_id: string; valor_total: number }).valor_total ?? 0
  }

  const presencas: PresencaWebn[] = lista.map((i) => {
    const contato = (i.contato as unknown as Record<string, unknown>) ?? {}
    return {
      id: i.id as string,
      contato_id: i.contato_id as string ?? '',
      numero_semana: i.numero_semana as number,
      email: contato.email as string ?? '',
      nome: contato.nome as string ?? null,
      telefone: contato.telefone as string ?? null,
      data_acesso: i.data_acesso as string ?? null,
      viu_pitch: i.viu_pitch as boolean ?? false,
      data_pitch: i.data_pitch as string ?? null,
      comprou: compradoresSet.has(i.contato_id as string),
      valor_compras_total: totalPorContato[i.contato_id as string] ?? 0,
    }
  })

  return { periodo, presencas }
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  border: '1px solid #2A2A2A',
  borderRadius: '0.5rem',
  color: '#FFFFFF',
  fontSize: '0.875rem',
  padding: '0.375rem 0.75rem',
  outline: 'none',
  height: '2.25rem',
}

export default function WebnarioClient({ semanaAtual, semanaInicial, periodoInicial }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [semana, setSemana] = useState(semanaInicial)
  const [periodo, setPeriodo] = useState(periodoInicial)
  const [presencas, setPresencas] = useState<PresencaWebn[]>([])
  const [carregando, setCarregando] = useState(true)
  const semanaCarregada = useRef<number | null>(null)

  const [busca, setBusca] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  useEffect(() => {
    if (semanaCarregada.current === semanaInicial) return
    semanaCarregada.current = semanaInicial
    setCarregando(true)
    buscarDadosSemana(supabase, semanaInicial).then(({ periodo: p, presencas: ps }) => {
      setPeriodo(p)
      setPresencas(ps)
      setSemana(semanaInicial)
      setCarregando(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaInicial])

  const carregarSemana = useCallback(async (novaS: number) => {
    setCarregando(true)
    setBusca('')
    setDataInicio('')
    setDataFim('')
    semanaCarregada.current = novaS

    const { periodo: p, presencas: ps } = await buscarDadosSemana(supabase, novaS)
    setPeriodo(p)
    setPresencas(ps)
    setSemana(novaS)
    setCarregando(false)

    const params = new URLSearchParams(searchParams.toString())
    params.set('semana', String(novaS))
    router.push(`?${params.toString()}`, { scroll: false })
  }, [supabase, router, searchParams])

  const presencasFiltradas = useMemo(() => {
    return presencas.filter((p) => {
      if (busca) {
        const q = busca.toLowerCase()
        if (!p.nome?.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false
      }
      if (dataInicio && p.data_acesso) {
        if (p.data_acesso < dataInicio) return false
      }
      if (dataFim && p.data_acesso) {
        // inclusivo: comparar até 23:59:59 do dia
        if (p.data_acesso.slice(0, 10) > dataFim) return false
      }
      return true
    })
  }, [presencas, busca, dataInicio, dataFim])

  const limparFiltros = () => {
    setBusca('')
    setDataInicio('')
    setDataFim('')
  }

  const temFiltro = busca || dataInicio || dataFim

  return (
    <div className="p-6 space-y-5" style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}>

      <SeletorSemana
        semana={semana}
        semanaAtual={semanaAtual}
        periodo={periodo}
        carregando={carregando}
        onMudar={carregarSemana}
      />

      <WebnarioKpis presencas={presencas} carregando={carregando} />

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div>
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>
              Presença ao Vivo — Semana {semana}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
              {carregando ? 'Carregando...' : presencasFiltradas.length < presencas.length
                ? `${presencasFiltradas.length} de ${presencas.length} acessos`
                : `${presencas.length > 0 ? `${presencas.length} acesso${presencas.length > 1 ? 's' : ''} registrado${presencas.length > 1 ? 's' : ''}` : 'Aguardando dados da Hotwebnar'}`}
            </p>
          </div>
          {presencas.length > 0 && (
            <button
              onClick={() => {
                const BOM = '﻿'
                const cabecalho = ['nome', 'email', 'telefone', 'data_acesso', 'viu_pitch', 'data_pitch', 'comprou', 'valor_compras_total']
                const linhas = presencasFiltradas.map(p => [
                  p.nome ?? '', p.email, p.telefone ?? '',
                  p.data_acesso ?? '', p.viu_pitch ? 'Sim' : 'Não',
                  p.data_pitch ?? '', p.comprou ? 'Sim' : 'Não',
                  String(p.valor_compras_total),
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                const csv = BOM + [cabecalho.join(','), ...linhas].join('\n')
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                const d = new Date()
                a.href = url
                a.download = `webnario-semana-${semana}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
            >
              Exportar CSV
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #1A1A1A' }}>
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ ...inputStyle, minWidth: '220px', flex: 1 }}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#555555' }}>De</span>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
            <span className="text-xs" style={{ color: '#555555' }}>até</span>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>
          {temFiltro && (
            <button
              onClick={limparFiltros}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ color: '#888888', border: '1px solid #2A2A2A', backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
            >
              Limpar
            </button>
          )}
        </div>

        <WebnarioTabela presencas={presencasFiltradas} carregando={carregando} />
      </div>
    </div>
  )
}
