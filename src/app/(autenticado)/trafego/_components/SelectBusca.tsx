'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface Opcao {
  value: string
  label: string
}

interface Props {
  opcoes:           Opcao[]
  value:            string
  placeholder:      string
  placeholderBusca?: string
  onChange:         (v: string) => void
  disabled?:        boolean
}

export default function SelectBusca({
  opcoes, value, placeholder, placeholderBusca = 'Buscar...', onChange, disabled,
}: Props) {
  const [aberto,  setAberto]  = useState(false)
  const [busca,   setBusca]   = useState('')
  const ref       = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const selecionado = opcoes.find(o => o.value === value)

  const filtradas = busca.trim()
    ? opcoes.filter(o => o.label.toLowerCase().includes(busca.toLowerCase()))
    : opcoes

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false)
        setBusca('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50)
  }, [aberto])

  function selecionar(v: string) {
    onChange(v)
    setAberto(false)
    setBusca('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAberto(v => !v)}
        className="flex items-center justify-between gap-2 w-full min-w-[200px] rounded-lg px-3 py-2 text-sm text-left outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{
          backgroundColor: '#111111',
          border: '1px solid #222222',
          color: selecionado ? '#FFFFFF' : '#555555',
        }}
      >
        <span className="truncate">
          {selecionado ? selecionado.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); selecionar('') }}
              style={{ color: '#555555' }}
              className="hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${aberto ? 'rotate-180' : ''}`}
            style={{ color: '#555555' }}
          />
        </div>
      </button>

      {aberto && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[240px] rounded-xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: '#111111', border: '1px solid #333333' }}
        >
          {/* Campo de busca */}
          <div
            className="px-3 py-2 flex items-center gap-2"
            style={{ borderBottom: '1px solid #1E1E1E' }}
          >
            <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#555555' }} />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={placeholderBusca}
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: '#FFFFFF' }}
            />
            {busca && (
              <button onClick={() => setBusca('')} style={{ color: '#555555' }} className="hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-56 overflow-y-auto">
            <div
              onClick={() => selecionar('')}
              className="px-3 py-2 text-sm cursor-pointer transition-colors"
              style={{ color: !value ? '#C9A84C' : '#888888' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              {placeholder}
            </div>
            {filtradas.length === 0 ? (
              <p className="px-3 py-3 text-xs text-center" style={{ color: '#555555' }}>Nenhum resultado.</p>
            ) : filtradas.map(o => (
              <div
                key={o.value}
                onClick={() => selecionar(o.value)}
                className="px-3 py-2 text-sm cursor-pointer truncate transition-colors"
                style={{
                  color: o.value === value ? '#C9A84C' : '#FFFFFF',
                  backgroundColor: o.value === value ? '#1A1A1A' : 'transparent',
                  fontWeight: o.value === value ? 500 : 400,
                }}
                title={o.label}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = o.value === value ? '#1A1A1A' : 'transparent'}
              >
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
