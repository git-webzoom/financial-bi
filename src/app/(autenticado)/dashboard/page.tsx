'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { montarAbas } from '@/lib/dashboard-abas'
import type { DashboardAba } from '@/lib/dashboard-abas'
import TpwClient from './_components/TpwClient'
import WebinarioClient from './_components/WebinarioClient'
import SeletorAbas from './_components/SeletorAbas'

// Aba "Webnário" é caso à parte (será construída separadamente) — fica fixa,
// fora da tabela dashboard_abas. As demais abas vêm do banco.
const WEBN_KEY = '__webnario__'

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
    <div className="p-4 md:p-6 space-y-5 md:space-y-6">

      {/* Abas — Webinário fixa antes das dinâmicas (dashboard_abas) */}
      <SeletorAbas
        abas={[{ id: WEBN_KEY, nome: 'Webinário' }, ...abas.map(a => ({ id: a.id, nome: a.nome }))]}
        ativaId={abaAtivaId}
        onSelect={setAbaAtivaId}
        carregando={carregando}
      />

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
