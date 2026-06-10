'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface AbaItem {
  id: string
  nome: string
}

interface Props {
  abas: AbaItem[]              // já unificada: Webinário em [0] + dinâmicas depois
  ativaId: string
  onSelect: (id: string) => void
  carregando?: boolean
}

function botaoEstilo(ativo: boolean): React.CSSProperties {
  return {
    backgroundColor: ativo ? '#C9A84C' : 'transparent',
    color: ativo ? '#0A0A0A' : '#888888',
  }
}

export default function SeletorAbas({ abas, ativaId, onSelect, carregando }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const ativoRef    = useRef<HTMLButtonElement>(null)
  const [canLeft,  setCanLeft]  = useState(false)
  const [canRight, setCanRight] = useState(false)

  function medir() {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanLeft(scrollLeft > 1)
    setCanRight(scrollLeft + clientWidth < scrollWidth - 1)
  }

  // Mede no mount e sempre que a largura do container ou o nº de abas muda.
  useEffect(() => {
    medir()
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [abas.length])

  // Traz a aba ativa para o centro ao trocar (sem rolar a página na vertical).
  useEffect(() => {
    ativoRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [ativaId])

  function rolar(dir: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  function setaEstilo(visivel: boolean, lado: 'left' | 'right'): React.CSSProperties {
    const dir = lado === 'left' ? 'to right' : 'to left'
    return {
      minWidth: 36,
      color: '#888888',
      background: `linear-gradient(${dir}, #111111 55%, transparent)`,
      opacity: visivel ? 1 : 0,
      pointerEvents: visivel ? 'auto' : 'none',
    }
  }

  return (
    <div className="relative w-fit max-w-full">
      {/* Seta esquerda — só visível quando há conteúdo escondido à esquerda */}
      <button
        type="button"
        aria-label="Rolar abas para a esquerda"
        onClick={() => rolar(-1)}
        className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center rounded-l-xl transition-opacity"
        style={setaEstilo(canLeft, 'left')}
        onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
        onMouseLeave={e => (e.currentTarget.style.color = '#888888')}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Faixa rolável das abas */}
      <div
        ref={scrollerRef}
        onScroll={medir}
        role="tablist"
        className="no-scrollbar flex gap-1 p-1 rounded-xl overflow-x-auto scroll-smooth"
        style={{
          backgroundColor: '#111111',
          border: '1px solid #222222',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {abas.map((aba) => {
          const ativo = aba.id === ativaId
          return (
            <button
              key={aba.id}
              ref={ativo ? ativoRef : undefined}
              role="tab"
              aria-selected={ativo}
              onClick={() => onSelect(aba.id)}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap shrink-0"
              style={botaoEstilo(ativo)}
            >
              {aba.nome}
            </button>
          )
        })}

        {carregando && (
          <span className="px-3 py-2 text-xs self-center shrink-0" style={{ color: '#555555' }}>carregando…</span>
        )}
      </div>

      {/* Seta direita — só visível quando há conteúdo escondido à direita */}
      <button
        type="button"
        aria-label="Rolar abas para a direita"
        onClick={() => rolar(1)}
        className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center rounded-r-xl transition-opacity"
        style={setaEstilo(canRight, 'right')}
        onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
        onMouseLeave={e => (e.currentTarget.style.color = '#888888')}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
