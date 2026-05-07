'use client'

import { useState, useCallback, useTransition, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda, formatData } from '@/lib/format'
import VendaDrawer from './VendaDrawer'
import { Search, X, ChevronDown } from 'lucide-react'

const PAGE_SIZE = 20

export interface Produto { id: string; nome: string }

export interface Venda {
  id: string
  data_aprovacao: string | null
  data_pedido: string | null
  data_cancelamento: string | null
  data_garantia: string | null
  nome_contato: string | null
  email_contato: string | null
  telefone_contato: string | null
  doc_contato: string | null
  estado_contato: string | null
  pais_contato: string | null
  produto_id: string | null
  oferta_id: string | null
  nome_oferta: string | null
  marketplace: string
  marketplace_id: string | null
  status: string
  pagamento: string | null
  parcelas: number | null
  moeda: string
  valor_venda: number | null
  valor_liquido: number | null
  valor_marketplace: number | null
  valor_afiliado: number | null
  valor_desconto: number | null
  valor_parcela: number | null
  utm_source: string | null
  utm_campaign: string | null
  utm_medium: string | null
  utm_content: string | null
  motivo_reembolso: string | null
}

interface Kpis {
  faturamentoBruto: number
  faturamentoLiquido: number
  totalVendas: number
  ticketMedio: number
  reembolsos: number
  chargebacks: number
}

interface Props {
  produtos: Produto[]
  initialVendas: Venda[]
  initialTotal: number
  initialKpis: Kpis
  dataInicioDefault: string
  dataFimDefault: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'approved',   label: 'Aprovada' },
  { value: 'refunded',   label: 'Reembolsada' },
  { value: 'chargeback', label: 'Chargeback' },
  { value: 'cancelled',  label: 'Cancelada' },
  { value: 'pending',    label: 'Pendente' },
]

const PAGAMENTO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pix',         label: 'PIX' },
  { value: 'credit_card', label: 'Cartão' },
  { value: 'boleto',      label: 'Boleto' },
]

const MARKETPLACE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'pagarme2',    label: 'Pagarme' },
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'stripe',      label: 'Stripe' },
]

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  approved:     { bg: '#0F2A1A', text: '#4ADE80' },
  complete:     { bg: '#0F2A1A', text: '#4ADE80' },
  refunded:     { bg: '#2A0F0F', text: '#F87171' },
  refunded_sol: { bg: '#2A1A0F', text: '#FB923C' },
  chargeback:   { bg: '#2A0F0F', text: '#F87171' },
  cancelled:    { bg: '#1A1A1A', text: '#888888' },
  pending:      { bg: '#2A2A0F', text: '#FACC15' },
}

const STATUS_LABEL: Record<string, string> = {
  approved:     'Aprovada',
  complete:     'Completa',
  refunded:     'Reembolsada',
  refunded_sol: 'Reembolso Sol.',
  chargeback:   'Chargeback',
  cancelled:    'Cancelada',
  pending:      'Pendente',
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { bg: '#1A1A1A', text: '#888888' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ─── Combobox de produto com busca ───────────────────────────────────────────

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

  const selecionado = produtos.find((p) => p.id === value)
  const filtrados = produtos.filter((p) =>
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm min-w-[180px] max-w-[220px] outline-none transition-colors"
        style={{
          backgroundColor: '#111111',
          border: '1px solid #222222',
          color: selecionado ? '#FFFFFF' : '#555555',
        }}
      >
        <span className="truncate">{selecionado?.nome ?? 'Todos os produtos'}</span>
        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: '#555555' }} />
      </button>

      {aberto && (
        <div
          className="absolute z-50 top-full mt-1 left-0 w-72 rounded-xl shadow-2xl overflow-hidden"
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
                onChange={(e) => setBusca(e.target.value)}
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

          <div className="max-h-56 overflow-y-auto py-1">
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
              filtrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selecionar(p.id)}
                  className="w-full text-left px-4 py-2 text-sm truncate transition-colors"
                  style={{
                    color: value === p.id ? '#C9A84C' : '#FFFFFF',
                    fontWeight: value === p.id ? 500 : 400,
                  }}
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

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: '#888888' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{valor}</p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #222222',
  color: '#FFFFFF',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  backgroundColor: '#111111',
  border: '1px solid #222222',
  color: '#FFFFFF',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function VendasClient({
  produtos,
  initialVendas,
  initialTotal,
  initialKpis,
  dataInicioDefault,
  dataFimDefault,
}: Props) {
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [dataInicio, setDataInicio] = useState(dataInicioDefault)
  const [dataFim, setDataFim]       = useState(dataFimDefault)
  const [produtoId, setProdutoId]   = useState('')
  const [status, setStatus]         = useState('')
  const [pagamento, setPagamento]   = useState('')
  const [marketplace, setMarketplace] = useState('')

  const [vendas, setVendas]   = useState<Venda[]>(initialVendas)
  const [total, setTotal]     = useState(initialTotal)
  const [kpis, setKpis]       = useState<Kpis>(initialKpis)
  const [pagina, setPagina]   = useState(0)

  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null)

  const totalPaginas = Math.ceil(total / PAGE_SIZE)

  const buscar = useCallback(async (params: {
    dataInicio: string; dataFim: string; produtoId: string
    status: string; pagamento: string; marketplace: string; pagina: number
  }) => {
    startTransition(async () => {
      const inicio = params.dataInicio + 'T00:00:00-03:00'
      const fim    = params.dataFim    + 'T23:59:59-03:00'

      let q = supabase
        .from('vendas')
        .select('*', { count: 'exact' })
        .gte('data_pedido', inicio)
        .lte('data_pedido', fim)
        .order('data_pedido', { ascending: false })
        .range(params.pagina * PAGE_SIZE, params.pagina * PAGE_SIZE + PAGE_SIZE - 1)

      if (params.produtoId)   q = q.eq('produto_id', params.produtoId)
      if (params.status)      q = q.eq('status', params.status)
      if (params.pagamento)   q = q.ilike('pagamento', `%${params.pagamento}%`)
      if (params.marketplace) q = q.eq('marketplace', params.marketplace)

      const { data, count } = await q
      setVendas((data as Venda[]) ?? [])
      setTotal(count ?? 0)

      const { data: kdata } = await supabase.rpc('get_kpis_vendas', {
        p_inicio:      inicio,
        p_fim:         fim,
        p_produto_id:  params.produtoId  || null,
        p_marketplace: params.marketplace || null,
      })

      const k = kdata ?? {}
      const bruto   = k.faturamentoBruto  ?? 0
      const nVendas = k.totalVendas       ?? 0

      setKpis({
        faturamentoBruto:   bruto,
        faturamentoLiquido: k.faturamentoLiquido ?? 0,
        totalVendas:        nVendas,
        ticketMedio:        nVendas > 0 ? bruto / nVendas : 0,
        reembolsos:         k.reembolsos  ?? 0,
        chargebacks:        k.chargebacks ?? 0,
      })
    })
  }, [supabase])

  function aplicarFiltros(novaPagina = 0) {
    setPagina(novaPagina)
    buscar({ dataInicio, dataFim, produtoId, status, pagamento, marketplace, pagina: novaPagina })
  }

  function limparFiltros() {
    setProdutoId(''); setStatus(''); setPagamento(''); setMarketplace('')
    setPagina(0)
    buscar({ dataInicio, dataFim, produtoId: '', status: '', pagamento: '', marketplace: '', pagina: 0 })
  }

  function mudarPagina(nova: number) {
    setPagina(nova)
    buscar({ dataInicio, dataFim, produtoId, status, pagamento, marketplace, pagina: nova })
  }

  return (
    <div className="p-6 space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Faturamento Bruto"   valor={formatMoeda(kpis.faturamentoBruto)} />
        <KpiCard label="Faturamento Líquido" valor={formatMoeda(kpis.faturamentoLiquido)} />
        <KpiCard label="Total de Vendas"     valor={kpis.totalVendas.toLocaleString('pt-BR')} />
        <KpiCard label="Ticket Médio"        valor={formatMoeda(kpis.ticketMedio)} />
        <KpiCard label="Reembolsos"          valor={kpis.reembolsos.toLocaleString('pt-BR')} />
        <KpiCard label="Chargebacks"         valor={kpis.chargebacks.toLocaleString('pt-BR')} />
      </div>

      {/* Filtros */}
      <div
        className="rounded-xl p-4"
        style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
      >
        <div className="flex flex-wrap gap-3 items-end">

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>De</label>
            <input type="date" value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#222222')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Até</label>
            <input type="date" value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#222222')}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Produto</label>
            <ProdutoCombobox produtos={produtos} value={produtoId} onChange={setProdutoId} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={selectStyle}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#222222')}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Pagamento</label>
            <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} style={selectStyle}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#222222')}
            >
              {PAGAMENTO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Marketplace</label>
            <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)} style={selectStyle}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#222222')}
            >
              {MARKETPLACE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pb-0.5">
            <button
              onClick={() => aplicarFiltros(0)}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => { if (!isPending) (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C' }}
            >
              {isPending ? 'Buscando…' : 'Buscar'}
            </button>
            <button
              onClick={limparFiltros}
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'transparent', border: '1px solid #333333', color: '#888888' }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = '#888888'
              }}
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#111111' }}>
                {['Data Pedido', 'Nome', 'Produto', 'Oferta', 'Valor', 'Status', 'Pagamento'].map(h => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 font-medium whitespace-nowrap text-xs uppercase tracking-wide"
                    style={{ color: '#888888' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={isPending ? 'opacity-50' : ''}>
              {vendas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm" style={{ color: '#555555' }}>
                    Nenhuma venda encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                vendas.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => setVendaSelecionada(v)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#0A0A0A' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#111111'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#0A0A0A'}
                  >
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#888888' }}>
                      {formatData(v.data_pedido)}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="font-medium truncate" style={{ color: '#FFFFFF' }}>{v.nome_contato ?? '—'}</p>
                      <p className="text-xs truncate" style={{ color: '#555555' }}>{v.email_contato ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: '#FFFFFF' }}>
                      {produtos.find((p) => p.id === v.produto_id)?.nome ?? v.produto_id ?? '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[160px] truncate" style={{ color: '#888888' }}>
                      {v.nome_oferta ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap" style={{ color: '#C9A84C' }}>
                      {formatMoeda(v.valor_venda, v.moeda)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: '#888888' }}>
                      {v.pagamento?.replace('_', ' ') ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid #1E1E1E', backgroundColor: '#111111' }}
        >
          <p className="text-sm" style={{ color: '#555555' }}>
            {total === 0
              ? '0 registros'
              : `${pagina * PAGE_SIZE + 1}–${Math.min((pagina + 1) * PAGE_SIZE, total)} de ${total.toLocaleString('pt-BR')} registros`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => mudarPagina(pagina - 1)}
              disabled={pagina === 0 || isPending}
              className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              ← Anterior
            </button>
            <button
              onClick={() => mudarPagina(pagina + 1)}
              disabled={pagina >= totalPaginas - 1 || isPending}
              className="px-3 py-1.5 text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
            >
              Próximo →
            </button>
          </div>
        </div>
      </div>

      {vendaSelecionada && (
        <VendaDrawer venda={vendaSelecionada} onClose={() => setVendaSelecionada(null)} />
      )}
    </div>
  )
}
