'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Search, X, Package, Tag, ChevronDown } from 'lucide-react'
import { formatMoeda, formatData } from '@/lib/format'

const PAGE_SIZE = 20

interface Produto {
  id: string
  marketplace_id: string
  marketplace: string
  nome: string
  ativo: boolean
  created_at: string
  updated_at: string
}

interface Oferta {
  id: string
  produto_id: string
  mg_offer_id: string | null
  nome: string
  checkout_url: string | null
  valor: number
  moeda: string
  ativa: boolean
  pagamentos: string[] | null
  parcelas_default: number | null
  funil: string | null
  mg_created_at: string | null
  updated_at: string
}

interface Props {
  initialProdutos: Produto[]
  initialOfertas: Oferta[]
}

type Aba = 'produtos' | 'ofertas'

const inputStyle: React.CSSProperties = {
  backgroundColor: '#0A0A0A',
  border: '1px solid #222222',
  color: '#FFFFFF',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
  fontSize: '0.875rem',
  outline: 'none',
  width: '100%',
}

function ProdutoCombobox({
  produtos, value, onChange,
}: {
  produtos: Produto[]
  value: string
  onChange: (id: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selecionado = produtos.find(p => p.id === value)
  const filtrados = produtos.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase())
  )

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

  function selecionar(id: string) {
    onChange(id)
    setAberto(false)
    setBusca('')
  }

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm w-full outline-none transition-colors"
        style={{
          backgroundColor: '#0A0A0A',
          border: '1px solid #222222',
          color: selecionado ? '#FFFFFF' : '#555555',
        }}
      >
        <span className="truncate">{selecionado?.nome ?? 'Todos os produtos'}</span>
        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: '#555555' }} />
      </button>

      {aberto && (
        <div
          className="absolute z-50 top-full mt-1 left-0 w-80 rounded-xl shadow-2xl overflow-hidden"
          style={{ backgroundColor: '#111111', border: '1px solid #333333' }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid #1E1E1E' }}>
            <div
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{ border: '1px solid #222222' }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#555555' }} />
              <input
                autoFocus
                type="text"
                placeholder="Buscar produto..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: '#FFFFFF' }}
              />
              {busca && (
                <button onClick={() => setBusca('')} style={{ color: '#555555' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            <button
              onClick={() => selecionar('')}
              className="w-full text-left px-4 py-2 text-sm transition-colors"
              style={{ color: value === '' ? '#C9A84C' : '#888888' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              Todos os produtos
            </button>
            {filtrados.length === 0 ? (
              <p className="px-4 py-2 text-sm" style={{ color: '#555555' }}>Nenhum produto encontrado</p>
            ) : (
              filtrados.map(p => (
                <button
                  key={p.id}
                  onClick={() => selecionar(p.id)}
                  className="w-full text-left px-4 py-2 text-sm truncate transition-colors"
                  style={{ color: value === p.id ? '#C9A84C' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                >
                  {p.nome}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BadgeAtivo({ ativo }: { ativo: boolean }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={ativo
        ? { backgroundColor: '#0F2A1A', color: '#4ADE80' }
        : { backgroundColor: '#1A1A1A', color: '#555555' }
      }
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

function Paginacao({
  pagina, totalPaginas, onChange,
}: {
  pagina: number
  totalPaginas: number
  onChange: (p: number) => void
}) {
  if (totalPaginas <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #1E1E1E' }}>
      <button
        onClick={() => onChange(pagina - 1)}
        disabled={pagina === 0}
        className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
        style={{ backgroundColor: '#1A1A1A', color: '#CCCCCC' }}
      >
        Anterior
      </button>
      <span className="text-xs" style={{ color: '#888888' }}>
        Página {pagina + 1} de {totalPaginas}
      </span>
      <button
        onClick={() => onChange(pagina + 1)}
        disabled={pagina >= totalPaginas - 1}
        className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-30 transition-colors"
        style={{ backgroundColor: '#1A1A1A', color: '#CCCCCC' }}
      >
        Próxima
      </button>
    </div>
  )
}

function AbaProdutos({ produtos, ofertas }: { produtos: Produto[]; ofertas: Oferta[] }) {
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return q ? produtos.filter(p => p.nome.toLowerCase().includes(q)) : produtos
  }, [produtos, busca])

  const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE)
  const pagina_atual = Math.min(pagina, Math.max(0, totalPaginas - 1))
  const slice = filtrados.slice(pagina_atual * PAGE_SIZE, pagina_atual * PAGE_SIZE + PAGE_SIZE)

  function handleBusca(v: string) {
    setBusca(v)
    setPagina(0)
  }

  const ofertasPorProduto = useMemo(() => {
    const m: Record<string, number> = {}
    for (const o of ofertas) m[o.produto_id] = (m[o.produto_id] ?? 0) + 1
    return m
  }, [ofertas])

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#555555' }} />
        <input
          type="text"
          placeholder="Buscar produto por nome..."
          value={busca}
          onChange={e => handleBusca(e.target.value)}
          style={inputStyle}
        />
        {busca && (
          <button
            onClick={() => handleBusca('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: '#555555' }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <p className="text-xs" style={{ color: '#555555' }}>
        {filtrados.length} produto{filtrados.length !== 1 ? 's' : ''}
      </p>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #222222' }}>
        {/* Header */}
        <div
          className="grid text-xs font-medium uppercase tracking-wide px-4 py-3"
          style={{
            gridTemplateColumns: '2fr 1fr 80px 80px 110px',
            backgroundColor: '#0D0D0D',
            color: '#555555',
            borderBottom: '1px solid #1E1E1E',
          }}
        >
          <div>Nome</div>
          <div>Marketplace</div>
          <div className="text-center">Ofertas</div>
          <div className="text-center">Status</div>
          <div>Atualizado em</div>
        </div>

        {slice.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: '#555555' }}>
            {busca ? 'Nenhum produto encontrado para essa busca.' : 'Nenhum produto cadastrado. Sincronize na aba Configurações → Manager Guru.'}
          </div>
        ) : (
          slice.map(p => (
            <div
              key={p.id}
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: '2fr 1fr 80px 80px 110px',
                borderBottom: '1px solid #111111',
              }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{p.nome}</p>
                <p className="text-xs mt-0.5" style={{ color: '#555555' }}>ID: {p.marketplace_id}</p>
              </div>
              <div className="text-sm capitalize" style={{ color: '#888888' }}>
                {p.marketplace.replace('_', ' ')}
              </div>
              <div className="text-center">
                <span
                  className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: '#1A1A2A', color: '#C9A84C' }}
                >
                  {ofertasPorProduto[p.id] ?? 0}
                </span>
              </div>
              <div className="text-center">
                <BadgeAtivo ativo={p.ativo} />
              </div>
              <div className="text-xs" style={{ color: '#555555' }}>
                {formatData(p.updated_at)}
              </div>
            </div>
          ))
        )}

        <Paginacao pagina={pagina_atual} totalPaginas={totalPaginas} onChange={setPagina} />
      </div>
    </div>
  )
}

function AbaOfertas({ produtos, ofertas }: { produtos: Produto[]; ofertas: Oferta[] }) {
  const [busca, setBusca] = useState('')
  const [produtoFiltro, setProdutoFiltro] = useState('')
  const [pagina, setPagina] = useState(0)

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim()
    return ofertas.filter(o => {
      if (produtoFiltro && o.produto_id !== produtoFiltro) return false
      if (q && !o.nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [ofertas, busca, produtoFiltro])

  const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE)
  const pagina_atual = Math.min(pagina, Math.max(0, totalPaginas - 1))
  const slice = filtrados.slice(pagina_atual * PAGE_SIZE, pagina_atual * PAGE_SIZE + PAGE_SIZE)

  const nomePorProdutoId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of produtos) m[p.id] = p.nome
    return m
  }, [produtos])

  function handleFiltro(v: string) {
    setProdutoFiltro(v)
    setPagina(0)
  }

  function handleBusca(v: string) {
    setBusca(v)
    setPagina(0)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative" style={{ flex: '1 1 50%' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#555555' }} />
          <input
            type="text"
            placeholder="Buscar oferta por nome..."
            value={busca}
            onChange={e => handleBusca(e.target.value)}
            style={inputStyle}
          />
          {busca && (
            <button
              onClick={() => handleBusca('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#555555' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div style={{ flex: '1 1 50%' }}>
          <ProdutoCombobox
            produtos={produtos}
            value={produtoFiltro}
            onChange={handleFiltro}
          />
        </div>
      </div>

      <p className="text-xs" style={{ color: '#555555' }}>
        {filtrados.length} oferta{filtrados.length !== 1 ? 's' : ''}
      </p>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #222222' }}>
        <div
          className="grid text-xs font-medium uppercase tracking-wide px-4 py-3"
          style={{
            gridTemplateColumns: '2fr 1.5fr 100px 80px 100px',
            backgroundColor: '#0D0D0D',
            color: '#555555',
            borderBottom: '1px solid #1E1E1E',
          }}
        >
          <div>Nome da Oferta</div>
          <div>Produto</div>
          <div className="text-right">Valor</div>
          <div className="text-center">Status</div>
          <div>Pagamentos</div>
        </div>

        {slice.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: '#555555' }}>
            {busca || produtoFiltro ? 'Nenhuma oferta encontrada para esses filtros.' : 'Nenhuma oferta cadastrada. Sincronize na aba Configurações → Manager Guru.'}
          </div>
        ) : (
          slice.map(o => (
            <div
              key={o.id}
              className="grid items-center px-4 py-3"
              style={{
                gridTemplateColumns: '2fr 1.5fr 100px 80px 100px',
                borderBottom: '1px solid #111111',
              }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{o.nome}</p>
                {o.checkout_url && (
                  <a
                    href={o.checkout_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs mt-0.5 truncate block hover:underline"
                    style={{ color: '#C9A84C', maxWidth: '280px' }}
                  >
                    {o.checkout_url}
                  </a>
                )}
              </div>
              <div className="text-sm truncate" style={{ color: '#888888' }}>
                {nomePorProdutoId[o.produto_id] ?? '—'}
              </div>
              <div className="text-sm text-right font-medium" style={{ color: '#FFFFFF' }}>
                {formatMoeda(o.valor, o.moeda)}
              </div>
              <div className="text-center">
                <BadgeAtivo ativo={o.ativa} />
              </div>
              <div className="text-xs" style={{ color: '#888888' }}>
                {o.pagamentos?.map(pg => {
                  const label: Record<string, string> = {
                    pix: 'PIX',
                    credit_card: 'Cartão',
                    boleto: 'Boleto',
                    bank_transfer: 'TED',
                  }
                  return label[pg] ?? pg
                }).join(', ') ?? '—'}
              </div>
            </div>
          ))
        )}

        <Paginacao pagina={pagina_atual} totalPaginas={totalPaginas} onChange={setPagina} />
      </div>
    </div>
  )
}

export default function ProdutosClient({ initialProdutos, initialOfertas }: Props) {
  const [aba, setAba] = useState<Aba>('produtos')

  const abas: { key: Aba; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'produtos', label: 'Produtos', icon: <Package className="w-4 h-4" />, count: initialProdutos.length },
    { key: 'ofertas',  label: 'Ofertas',  icon: <Tag className="w-4 h-4" />,     count: initialOfertas.length },
  ]

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold" style={{ color: '#FFFFFF' }}>Produtos</h2>
        <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
          Produtos e ofertas sincronizados do Manager Guru
        </p>
      </div>

      {/* Abas */}
      <div style={{ borderBottom: '1px solid #1E1E1E' }}>
        <div className="flex gap-1">
          {abas.map(a => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={aba === a.key
                ? { borderColor: '#C9A84C', color: '#C9A84C' }
                : { borderColor: 'transparent', color: '#888888' }
              }
              onMouseEnter={e => { if (aba !== a.key) (e.currentTarget as HTMLElement).style.color = '#FFFFFF' }}
              onMouseLeave={e => { if (aba !== a.key) (e.currentTarget as HTMLElement).style.color = '#888888' }}
            >
              {a.icon}
              {a.label}
              <span
                className="px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: aba === a.key ? '#2A200A' : '#1A1A1A',
                  color: aba === a.key ? '#C9A84C' : '#555555',
                }}
              >
                {a.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {aba === 'produtos' && (
        <AbaProdutos produtos={initialProdutos} ofertas={initialOfertas} />
      )}
      {aba === 'ofertas' && (
        <AbaOfertas produtos={initialProdutos} ofertas={initialOfertas} />
      )}
    </div>
  )
}
