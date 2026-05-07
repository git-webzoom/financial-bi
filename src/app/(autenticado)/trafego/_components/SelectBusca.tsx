'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

interface Opcao {
  value: string
  label: string
}

interface Props {
  opcoes:       Opcao[]
  value:        string
  placeholder:  string
  placeholderBusca?: string
  onChange:     (v: string) => void
  disabled?:    boolean
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
        className="flex items-center justify-between gap-2 w-full min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selecionado ? 'text-gray-700' : 'text-gray-400'}`}>
          {selecionado ? selecionado.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); selecionar('') }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {aberto && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Campo de busca */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder={placeholderBusca}
              className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
            />
            {busca && (
              <button onClick={() => setBusca('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-56 overflow-y-auto">
            <div
              onClick={() => selecionar('')}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${!value ? 'text-blue-600 font-medium' : 'text-gray-500'}`}
            >
              {placeholder}
            </div>
            {filtradas.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 text-center">Nenhum resultado.</p>
            ) : filtradas.map(o => (
              <div
                key={o.value}
                onClick={() => selecionar(o.value)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 truncate ${o.value === value ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-700'}`}
                title={o.label}
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
