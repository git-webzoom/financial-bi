'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { montarAbas } from '@/lib/dashboard-abas'
import type { DashboardAba } from '@/lib/dashboard-abas'
import TpwClient from './_components/TpwClient'
import WebinarioClient from './_components/WebinarioClient'

// Aba "Webnário" é caso à parte (será construída separadamente) — fica fixa,
// fora da tabela dashboard_abas. As demais abas vêm do banco.
const WEBN_KEY = '__webnario__'

function botaoEstilo(ativo: boolean): React.CSSProperties {
  return {
    backgroundColor: ativo ? '#C9A84C' : 'transparent',
    color: ativo ? '#0A0A0A' : '#888888',
  }
}

export default function DashboardPage() {
  const supabase = createClient()

  const [abas,       setAbas]       = useState<DashboardAba[]>([])
  const [carregando, setCarregando] = useState(true)
  const [abaAtivaId, setAbaAtivaId] = useState<string>(WEBN_KEY)

  useEffect(() => {
    async function carregarAbas() {
      const { data: abasRaw } = await supabase
        .from('dashboard_abas')
        .select('id, nome, tipo_mockup, ordem, ativo')
        .eq('ativo', true)
        .order('ordem')
        .order('nome')

      const ids = (abasRaw ?? []).map(a => a.id)
      const { data: vincRaw } = ids.length > 0
        ? await supabase
            .from('dashboard_aba_filtros')
            .select('aba_id, papel, filtro_id')
            .in('aba_id', ids)
        : { data: [] }

      setAbas(montarAbas(abasRaw ?? [], vincRaw ?? []))
      setCarregando(false)
    }
    carregarAbas()
  }, [supabase])

  // Se a aba ativa foi removida/desativada num recarregamento, volta para o Webnário.
  useEffect(() => {
    if (abaAtivaId !== WEBN_KEY && !abas.some(a => a.id === abaAtivaId)) {
      setAbaAtivaId(WEBN_KEY)
    }
  }, [abas, abaAtivaId])

  const abaAtiva = abas.find(a => a.id === abaAtivaId) ?? null

  return (
    <div className="p-6 space-y-6">

      {/* Abas */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        {/* Webnário — fixa (placeholder; construída à parte) */}
        <button
          key={WEBN_KEY}
          onClick={() => setAbaAtivaId(WEBN_KEY)}
          className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
          style={botaoEstilo(abaAtivaId === WEBN_KEY)}
        >
          Webinário
        </button>

        {/* Abas dinâmicas (dashboard_abas) */}
        {abas.map((aba) => (
          <button
            key={aba.id}
            onClick={() => setAbaAtivaId(aba.id)}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-all"
            style={botaoEstilo(abaAtivaId === aba.id)}
          >
            {aba.nome}
          </button>
        ))}

        {carregando && (
          <span className="px-3 py-2 text-xs self-center" style={{ color: '#555555' }}>carregando…</span>
        )}
      </div>

      {/* Conteúdo das abas */}
      {abaAtivaId === WEBN_KEY && <WebinarioClient />}

      {abaAtiva?.tipo_mockup === 'venda_direta' && (
        <TpwClient
          key={abaAtiva.id}
          filtroTrafegoId={abaAtiva.filtrosPorPapel.trafego ?? null}
          filtroVendasId={abaAtiva.filtrosPorPapel.vendas ?? null}
        />
      )}

      {abaAtiva?.tipo_mockup === 'captacao' && (
        <div
          className="rounded-xl flex flex-col items-center justify-center py-20 px-6 text-center"
          style={{ backgroundColor: '#111111', border: '1px dashed #222222' }}
        >
          <p className="text-sm" style={{ color: '#888888' }}>Mockup de Captação em construção</p>
        </div>
      )}

    </div>
  )
}
