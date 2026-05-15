'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SlidersHorizontal, X } from 'lucide-react'
import type { FiltroPersonalizado, Modulo } from '@/lib/filtros-personalizados'

interface Props {
  modulo:    Modulo
  onAplicar: (filtro: FiltroPersonalizado | null) => void
}

export default function FiltrosPersonalizadosBar({ modulo, onAplicar }: Props) {
  const supabase = createClient()
  const [filtros, setFiltros] = useState<FiltroPersonalizado[]>([])
  const [ativoId, setAtivoId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data: filtrosData } = await supabase
      .from('filtros_personalizados')
      .select('id, nome, modulo, ativo, criado_por, created_at')
      .eq('modulo', modulo)
      .eq('ativo', true)
      .order('nome')

    if (!filtrosData || filtrosData.length === 0) { setFiltros([]); return }

    const ids = filtrosData.map(f => f.id)
    const { data: regrasData } = await supabase
      .from('filtros_personalizados_regras')
      .select('id, filtro_id, campo, operador, valor, ordem')
      .in('filtro_id', ids)
      .order('ordem')

    setFiltros(filtrosData.map(f => ({
      ...f,
      regras: (regrasData ?? []).filter(r => r.filtro_id === f.id),
    })))
  }, [supabase, modulo])

  useEffect(() => { carregar() }, [carregar])

  function selecionar(filtro: FiltroPersonalizado) {
    if (ativoId === filtro.id) {
      setAtivoId(null)
      onAplicar(null)
    } else {
      setAtivoId(filtro.id)
      onAplicar(filtro)
    }
  }

  function limpar() {
    setAtivoId(null)
    onAplicar(null)
  }

  if (filtros.length === 0) return null

  return (
    <div
      className="rounded-xl px-5 py-3 flex flex-wrap items-center gap-3"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: '#C9A84C' }} />
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>
          Filtros personalizados
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtros.map(f => {
          const ativo = f.id === ativoId
          return (
            <button
              key={f.id}
              onClick={() => selecionar(f)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={ativo
                ? { backgroundColor: '#C9A84C', color: '#000000', border: '1px solid #C9A84C' }
                : { backgroundColor: 'transparent', color: '#888888', border: '1px solid #333333' }
              }
              onMouseEnter={e => {
                if (!ativo) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                  ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
                }
              }}
              onMouseLeave={e => {
                if (!ativo) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#888888'
                }
              }}
            >
              {f.nome}
            </button>
          )
        })}
      </div>

      {ativoId && (
        <button
          onClick={limpar}
          className="flex items-center gap-1 text-xs ml-auto shrink-0 transition-colors"
          style={{ color: '#555555' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
        >
          <X className="w-3.5 h-3.5" />
          Limpar
        </button>
      )}
    </div>
  )
}
