'use client'

import { useState, useEffect, useRef } from 'react'
import { X, ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { InscritoCrm, FiltrosCrm } from './CrmClient'

interface Props {
  inscritos: InscritoCrm[]
  filtros: FiltrosCrm
  onChange: (f: FiltrosCrm) => void
}

function MultiSelect({
  label, opcoes, selecionados, onToggle, onLimpar,
}: {
  label: string
  opcoes: string[]
  selecionados: string[]
  onToggle: (v: string) => void
  onLimpar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm w-full"
        style={{
          backgroundColor: '#0A0A0A', border: `1px solid ${selecionados.length > 0 ? '#C9A84C' : '#333333'}`,
          color: selecionados.length > 0 ? '#C9A84C' : '#888888', minWidth: 130,
        }}
      >
        <span className="flex-1 text-left truncate">
          {selecionados.length === 0 ? label : `${label} (${selecionados.length})`}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
      </button>

      {aberto && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-lg overflow-hidden"
          style={{ backgroundColor: '#111111', border: '1px solid #333333', minWidth: 220, maxHeight: 280, overflowY: 'auto' }}
        >
          {selecionados.length > 0 && (
            <button
              onClick={() => { onLimpar(); setAberto(false) }}
              className="w-full px-3 py-2 text-xs text-left flex items-center gap-1.5"
              style={{ color: '#F87171', borderBottom: '1px solid #222222' }}
            >
              <X className="w-3 h-3" />Limpar seleção
            </button>
          )}
          {opcoes.map(op => (
            <button
              key={op}
              onClick={() => onToggle(op)}
              className="w-full px-3 py-2 text-sm text-left flex items-center gap-2"
              style={{
                backgroundColor: selecionados.includes(op) ? '#1A1A1A' : 'transparent',
                color: selecionados.includes(op) ? '#C9A84C' : '#FFFFFF',
              }}
              onMouseEnter={e => { if (!selecionados.includes(op)) (e.currentTarget as HTMLElement).style.backgroundColor = '#141414' }}
              onMouseLeave={e => { if (!selecionados.includes(op)) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              <span
                className="w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center"
                style={{ borderColor: selecionados.includes(op) ? '#C9A84C' : '#444444', backgroundColor: selecionados.includes(op) ? '#C9A84C22' : 'transparent' }}
              >
                {selecionados.includes(op) && <span style={{ color: '#C9A84C', fontSize: 10 }}>✓</span>}
              </span>
              <span className="truncate">{op || '(sem valor)'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CrmFiltros({ inscritos, filtros, onChange }: Props) {
  const [buscaLocal, setBuscaLocal] = useState(filtros.busca)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  function onBusca(v: string) {
    setBuscaLocal(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onChange({ ...filtros, busca: v }), 300)
  }

  const sources   = Array.from(new Set(inscritos.map(i => i.utm_source ?? ''))).filter(Boolean).sort()
  const campaigns = Array.from(new Set(inscritos.map(i => i.utm_campaign ?? ''))).filter(Boolean).sort()

  const temFiltro = filtros.busca || filtros.sources.length || filtros.campaigns.length ||
    filtros.tipo !== 'todos' || filtros.temperatura

  const contFiltrosAtivos = [
    filtros.sources.length > 0,
    filtros.campaigns.length > 0,
    filtros.tipo !== 'todos',
    !!filtros.temperatura,
  ].filter(Boolean).length

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A', border: '1px solid #333333', color: '#FFFFFF',
    borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem', outline: 'none',
  }
  const selectStyle: React.CSSProperties = {
    ...inputStyle, appearance: 'none', paddingRight: '2rem', cursor: 'pointer',
  }

  function limparTudo() {
    setBuscaLocal('')
    onChange({ busca: '', sources: [], campaigns: [], tipo: 'todos', temperatura: '', sourceGrafico: null, campaignGrafico: null })
  }

  return (
    <div style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#0A0A0A' }}>
      {/* Barra superior: busca + toggle filtros (mobile) */}
      <div className="px-4 md:px-5 py-3 flex items-center gap-2">
        <input
          type="text"
          value={buscaLocal}
          onChange={e => onBusca(e.target.value)}
          placeholder="Buscar nome ou email…"
          style={{ ...inputStyle, flex: 1 }}
          onFocus={e => (e.target.style.borderColor = '#C9A84C')}
          onBlur={e => (e.target.style.borderColor = '#333333')}
        />

        {/* Botão filtros — visível só no mobile (md:hidden) */}
        <button
          onClick={() => setFiltrosAbertos(v => !v)}
          className="md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm shrink-0"
          style={{
            backgroundColor: '#0A0A0A',
            border: `1px solid ${contFiltrosAtivos > 0 ? '#C9A84C' : '#333333'}`,
            color: contFiltrosAtivos > 0 ? '#C9A84C' : '#888888',
          }}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {contFiltrosAtivos > 0 && (
            <span className="w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}>
              {contFiltrosAtivos}
            </span>
          )}
        </button>

        {/* Filtros inline no desktop */}
        <div className="hidden md:flex items-center gap-2 flex-wrap">
          <MultiSelect
            label="utm_source"
            opcoes={sources}
            selecionados={filtros.sources}
            onToggle={v => onChange({ ...filtros, sources: filtros.sources.includes(v) ? filtros.sources.filter(s => s !== v) : [...filtros.sources, v] })}
            onLimpar={() => onChange({ ...filtros, sources: [] })}
          />
          <MultiSelect
            label="utm_campaign"
            opcoes={campaigns}
            selecionados={filtros.campaigns}
            onToggle={v => onChange({ ...filtros, campaigns: filtros.campaigns.includes(v) ? filtros.campaigns.filter(c => c !== v) : [...filtros.campaigns, v] })}
            onLimpar={() => onChange({ ...filtros, campaigns: [] })}
          />
          <select value={filtros.tipo} onChange={e => onChange({ ...filtros, tipo: e.target.value as FiltrosCrm['tipo'] })} style={selectStyle}>
            <option value="todos">Todos</option>
            <option value="novos">Apenas novos</option>
            <option value="recorrentes">Apenas recorrentes</option>
            <option value="compradores">Apenas compradores</option>
          </select>
          <select value={filtros.temperatura} onChange={e => onChange({ ...filtros, temperatura: e.target.value })} style={selectStyle}>
            <option value="">Temperatura</option>
            <option value="Quente">Quente</option>
            <option value="Morno">Morno</option>
            <option value="Frio">Frio</option>
          </select>
          {temFiltro && (
            <button
              onClick={limparTudo}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid #333333', color: '#F87171', backgroundColor: 'transparent' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              <X className="w-3.5 h-3.5" />Limpar
            </button>
          )}
        </div>
      </div>

      {/* Painel de filtros expandido — apenas mobile */}
      {filtrosAbertos && (
        <div className="md:hidden px-4 pb-3 flex flex-col gap-2" style={{ borderTop: '1px solid #1E1E1E' }}>
          <div className="pt-3 grid grid-cols-2 gap-2">
            <MultiSelect
              label="utm_source"
              opcoes={sources}
              selecionados={filtros.sources}
              onToggle={v => onChange({ ...filtros, sources: filtros.sources.includes(v) ? filtros.sources.filter(s => s !== v) : [...filtros.sources, v] })}
              onLimpar={() => onChange({ ...filtros, sources: [] })}
            />
            <MultiSelect
              label="utm_campaign"
              opcoes={campaigns}
              selecionados={filtros.campaigns}
              onToggle={v => onChange({ ...filtros, campaigns: filtros.campaigns.includes(v) ? filtros.campaigns.filter(c => c !== v) : [...filtros.campaigns, v] })}
              onLimpar={() => onChange({ ...filtros, campaigns: [] })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={filtros.tipo} onChange={e => onChange({ ...filtros, tipo: e.target.value as FiltrosCrm['tipo'] })} style={{ ...selectStyle, width: '100%' }}>
              <option value="todos">Todos</option>
              <option value="novos">Apenas novos</option>
              <option value="recorrentes">Apenas recorrentes</option>
              <option value="compradores">Apenas compradores</option>
            </select>
            <select value={filtros.temperatura} onChange={e => onChange({ ...filtros, temperatura: e.target.value })} style={{ ...selectStyle, width: '100%' }}>
              <option value="">Temperatura</option>
              <option value="Quente">Quente</option>
              <option value="Morno">Morno</option>
              <option value="Frio">Frio</option>
            </select>
          </div>
          {temFiltro && (
            <button
              onClick={() => { limparTudo(); setFiltrosAbertos(false) }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm w-full"
              style={{ border: '1px solid #333333', color: '#F87171', backgroundColor: 'transparent' }}
            >
              <X className="w-3.5 h-3.5" />Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}
