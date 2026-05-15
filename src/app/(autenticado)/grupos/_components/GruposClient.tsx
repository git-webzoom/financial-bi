'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatData } from '@/lib/format'
import { ArrowLeft, Users, LayoutGrid, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import type { SendflowCampanha, SendflowGrupo, GruposKpisSemana } from '../page'
import GruposTabela from './GruposTabela'

interface Props {
  campanhasIniciais: SendflowCampanha[]
  kpisGrupo: GruposKpisSemana
  semanaAtual: number
  semanasDisponiveis: number[]
}

function KpiCard({ label, valor, sub }: { label: string; valor: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl px-5 py-4 flex flex-col gap-1" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#555555' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: '#FFFFFF' }}>{valor}</p>
      {sub && <p className="text-xs" style={{ color: '#888888' }}>{sub}</p>}
    </div>
  )
}

function CampanhaCard({
  campanha,
  onClick,
}: {
  campanha: SendflowCampanha
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl p-5 text-left w-full transition-all"
      style={{
        backgroundColor: hovered ? '#161616' : '#111111',
        border: `1px solid ${hovered ? '#333333' : '#222222'}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate" style={{ color: '#FFFFFF' }}>{campanha.nome}</p>
          <p className="text-xs mt-1 font-mono" style={{ color: '#444444' }}>{campanha.id}</p>
        </div>
        {campanha.ativo
          ? <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>Ativa</span>
          : <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A1A1A', color: '#555555' }}>Inativa</span>
        }
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" style={{ color: '#555555' }} />
          <span className="text-sm font-semibold" style={{ color: '#CCCCCC' }}>{campanha.total_grupos}</span>
          <span className="text-xs" style={{ color: '#555555' }}>grupo{campanha.total_grupos !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" style={{ color: '#555555' }} />
          <span className="text-sm font-semibold" style={{ color: '#CCCCCC' }}>{campanha.total_membros.toLocaleString('pt-BR')}</span>
          <span className="text-xs" style={{ color: '#555555' }}>membros</span>
        </div>
      </div>

      {campanha.synced_at && (
        <p className="text-xs mt-3" style={{ color: '#333333' }}>
          Sync {formatData(campanha.synced_at)}
        </p>
      )}
    </button>
  )
}

export default function GruposClient({ campanhasIniciais, kpisGrupo, semanaAtual, semanasDisponiveis }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [campanhas] = useState<SendflowCampanha[]>(campanhasIniciais)
  const [campanhaAberta, setCampanhaAberta] = useState<SendflowCampanha | null>(null)
  const [grupos, setGrupos] = useState<SendflowGrupo[]>([])
  const [carregandoGrupos, setCarregandoGrupos] = useState(false)

  const semana = kpisGrupo.numero_semana
  const idxSemana = semanasDisponiveis.indexOf(semana)
  const semanaAnterior = semanasDisponiveis[idxSemana + 1] ?? null
  const proximaSemana = idxSemana > 0 ? semanasDisponiveis[idxSemana - 1] : null

  function irParaSemana(n: number) {
    router.push(`?semana=${n}`)
  }

  const carregarGrupos = useCallback(async (campanhaId: string) => {
    setCarregandoGrupos(true)
    const { data } = await supabase
      .from('sendflow_grupos')
      .select('id, campanha_id, nome, link, invite_code, total_membros, count, grupo_cheio, ativo, synced_at')
      .eq('campanha_id', campanhaId)
      .order('count', { ascending: true })
    setGrupos(data ?? [])
    setCarregandoGrupos(false)
  }, [supabase])

  function abrirCampanha(campanha: SendflowCampanha) {
    setCampanhaAberta(campanha)
    setGrupos([])
    carregarGrupos(campanha.id)
  }

  function voltar() {
    setCampanhaAberta(null)
    setGrupos([])
  }

  // ── Visão detalhada de uma campanha ──────────────────────────────────────────
  if (campanhaAberta) {
    return (
      <div className="p-6 space-y-5" style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}>

        {/* Breadcrumb / voltar */}
        <div className="flex items-center gap-3">
          <button
            onClick={voltar}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: '#888888', border: '1px solid #222222', backgroundColor: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLElement).style.borderColor = '#444444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888888'; (e.currentTarget as HTMLElement).style.borderColor = '#222222' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Campanhas
          </button>
          <span style={{ color: '#333333' }}>/</span>
          <span className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{campanhaAberta.nome}</span>
        </div>

        {/* KPIs da campanha */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard
            label="Grupos"
            valor={campanhaAberta.total_grupos}
            sub={`${grupos.filter(g => g.grupo_cheio).length} cheio${grupos.filter(g => g.grupo_cheio).length !== 1 ? 's' : ''}`}
          />
          <KpiCard
            label="Membros"
            valor={campanhaAberta.total_membros.toLocaleString('pt-BR')}
          />
          <KpiCard
            label="Capacidade livre"
            valor={(() => {
              const cheios = grupos.filter(g => g.grupo_cheio).length
              const livres = campanhaAberta.total_grupos - cheios
              return `${livres} grupo${livres !== 1 ? 's' : ''}`
            })()}
            sub="grupos com vagas"
          />
        </div>

        {/* Tabela */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1E1E1E' }}>
            <div>
              <p className="font-semibold" style={{ color: '#FFFFFF' }}>{campanhaAberta.nome}</p>
              <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
                {carregandoGrupos
                  ? 'Carregando...'
                  : `${grupos.filter(g => g.ativo).length} grupo${grupos.filter(g => g.ativo).length !== 1 ? 's' : ''} ativo${grupos.filter(g => g.ativo).length !== 1 ? 's' : ''}`
                }
              </p>
            </div>
            <button
              onClick={() => carregarGrupos(campanhaAberta.id)}
              disabled={carregandoGrupos}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg disabled:opacity-40"
              style={{ color: '#888888', border: '1px solid #222222' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregandoGrupos ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
          <GruposTabela grupos={grupos} carregando={carregandoGrupos} />
        </div>
      </div>
    )
  }

  // ── Lista de campanhas (tela principal) ───────────────────────────────────────
  return (
    <div className="p-6 space-y-5" style={{ backgroundColor: '#0A0A0A', minHeight: '100vh' }}>

      {/* Seletor de semana */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#FFFFFF' }}>Grupos Captação Webnário</h2>
          <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
            Atualizado em tempo real via webhook Sendflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => semanaAnterior && irParaSemana(semanaAnterior)}
            disabled={!semanaAnterior}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
            style={{ border: '1px solid #222222', color: '#888888', backgroundColor: 'transparent' }}
            onMouseEnter={e => { if (semanaAnterior) (e.currentTarget as HTMLElement).style.color = '#FFFFFF' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-4 py-1.5 rounded-lg text-sm font-semibold" style={{ border: '1px solid #333333', color: '#FFFFFF', backgroundColor: '#111111' }}>
            Semana {semana}
            {semana === semanaAtual && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A2A1A', color: '#4ADE80' }}>Atual</span>
            )}
          </div>
          <button
            onClick={() => proximaSemana && irParaSemana(proximaSemana)}
            disabled={!proximaSemana}
            className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
            style={{ border: '1px solid #222222', color: '#888888', backgroundColor: 'transparent' }}
            onMouseEnter={e => { if (proximaSemana) (e.currentTarget as HTMLElement).style.color = '#FFFFFF' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <KpiCard
          label={`Entraram no grupo · Semana ${semana}`}
          valor={kpisGrupo.adicionados.toLocaleString('pt-BR')}
          sub="entradas na semana (pode ter re-entradas)"
        />
        <KpiCard
          label={`No grupo agora · Semana ${semana}`}
          valor={kpisGrupo.no_grupo_agora.toLocaleString('pt-BR')}
          sub="entradas menos saídas na semana"
        />
      </div>

      <div>
        <h3 className="text-sm font-bold" style={{ color: '#FFFFFF' }}>Campanhas</h3>
        <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
          Sincronizado via Sendflow · atualiza automaticamente a cada 1h
        </p>
      </div>

      {campanhas.length === 0 ? (
        <div className="rounded-xl flex flex-col items-center justify-center py-16 gap-3" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
          <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Nenhuma campanha configurada</p>
          <p className="text-xs text-center max-w-sm" style={{ color: '#555555' }}>
            Adicione campanhas em Configurações → Sendflow e execute um Sync Grupos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {campanhas.map(c => (
            <CampanhaCard key={c.id} campanha={c} onClick={() => abrirCampanha(c)} />
          ))}
        </div>
      )}
    </div>
  )
}
