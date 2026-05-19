'use client'

import { useState, useCallback, useTransition, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatMoeda, formatData } from '@/lib/format'
import VendaDrawer from './VendaDrawer'
import { Search, X, ChevronDown } from 'lucide-react'
import type { FiltroPersonalizado, RegraFiltro } from '@/lib/filtros-personalizados'

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
  { value: 'dispute',    label: 'Disputa' },
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
  dispute:      { bg: '#2A1A2A', text: '#C084FC' },
  cancelled:    { bg: '#1A1A1A', text: '#888888' },
  pending:      { bg: '#2A2A0F', text: '#FACC15' },
}

const STATUS_LABEL: Record<string, string> = {
  approved:     'Aprovada',
  complete:     'Completa',
  refunded:     'Reembolsada',
  refunded_sol: 'Reembolso Sol.',
  chargeback:   'Chargeback',
  dispute:      'Disputa',
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarRegras(q: any, regras: RegraFiltro[]) {
  for (const { campo, operador, valor } of regras) {
    switch (operador) {
      case 'contem':     q = q.ilike(campo, `%${valor}%`); break
      case 'nao_contem': q = q.not(campo, 'ilike', `%${valor}%`); break
      case 'igual':      q = q.eq(campo, valor); break
      case 'comeca_com': q = q.ilike(campo, `${valor}%`); break
      case 'maior_que':  q = q.filter(`${campo}::int`, 'gt', valor); break
      case 'menor_que':  q = q.filter(`${campo}::int`, 'lt', valor); break
    }
  }
  return q
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

  const filtroPersonalizadoRef = useRef<FiltroPersonalizado | null>(null)

  const [filtrosSalvos,    setFiltrosSalvos]    = useState<FiltroPersonalizado[]>([])
  const [filtroSalvoAtivo, setFiltroSalvoAtivo] = useState('')

  const [dataInicio, setDataInicio] = useState(dataInicioDefault)
  const [dataFim, setDataFim]       = useState(dataFimDefault)
  const [produtoId, setProdutoId]   = useState('')
  const [status, setStatus]         = useState('')
  const [pagamento, setPagamento]   = useState('')
  const [marketplace, setMarketplace] = useState('')
  const [emailsFiltro, setEmailsFiltro] = useState<string[]>([])
  const [todasVendasEmails, setTodasVendasEmails] = useState<Venda[]>([])

  const [vendas, setVendas]   = useState<Venda[]>(initialVendas)
  const [total, setTotal]     = useState(initialTotal)
  const [kpis, setKpis]       = useState<Kpis>(initialKpis)
  const [pagina, setPagina]   = useState(0)

  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null)

  const totalPaginas = Math.ceil(total / PAGE_SIZE)

  useEffect(() => {
    async function carregarFiltrosSalvos() {
      const { data: filtrosData } = await supabase
        .from('filtros_personalizados')
        .select('id, nome, modulo, ativo, criado_por, created_at')
        .eq('modulo', 'vendas')
        .eq('ativo', true)
        .order('nome')

      if (!filtrosData?.length) return

      const { data: regrasData } = await supabase
        .from('filtros_personalizados_regras')
        .select('id, filtro_id, campo, operador, valor, ordem')
        .in('filtro_id', filtrosData.map(f => f.id))
        .order('ordem')

      setFiltrosSalvos(filtrosData.map(f => ({
        ...f,
        regras: (regrasData ?? []).filter(r => r.filtro_id === f.id),
      })))
    }
    carregarFiltrosSalvos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Lê filtro de e-mails vindo do CRM (card Compradores)
  useEffect(() => {
    const raw = sessionStorage.getItem('vendas_filtro_emails')
    if (!raw) return
    sessionStorage.removeItem('vendas_filtro_emails')
    try {
      const emails: string[] = JSON.parse(raw)
      if (emails.length > 0) {
        setEmailsFiltro(emails)
        buscarComEmails(emails)
      }
    } catch { /* ignorar */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const STATUS_APROVADO = ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed']

  const calcularKpisLocais = useCallback((todasVendas: Venda[]) => {
    const aprovadas = todasVendas.filter(v => STATUS_APROVADO.includes(v.status))
    const bruto     = aprovadas.reduce((s, v) => s + (v.valor_venda   ?? 0), 0)
    const liquido   = aprovadas.reduce((s, v) => s + (v.valor_liquido ?? 0), 0)
    const nVendas   = aprovadas.length
    setKpis({
      faturamentoBruto:   bruto,
      faturamentoLiquido: liquido,
      totalVendas:        nVendas,
      ticketMedio:        nVendas > 0 ? bruto / nVendas : 0,
      reembolsos:         todasVendas.filter(v => ['refunded','refunded_sol'].includes(v.status)).length,
      chargebacks:        todasVendas.filter(v => v.status === 'chargeback').length,
    })
  }, [])

  const buscarComEmails = useCallback((emails: string[]) => {
    startTransition(async () => {
      // Busca todas as vendas (sem paginação) para calcular KPIs corretos
      const { data: todas } = await supabase
        .from('vendas')
        .select('*')
        .in('email_contato', emails)
        .order('data_pedido', { ascending: false })

      const lista = (todas ?? []) as Venda[]
      calcularKpisLocais(lista)
      setTodasVendasEmails(lista)
      setTotal(lista.length)
      setVendas(lista.slice(0, PAGE_SIZE))
      setPagina(0)
    })
  }, [supabase, calcularKpisLocais])

  const buscar = useCallback(async (params: {
    dataInicio: string; dataFim: string; produtoId: string
    status: string; pagamento: string; marketplace: string; pagina: number
    emails?: string[]
  }) => {
    startTransition(async () => {
      const inicio = params.dataInicio + 'T00:00:00-03:00'
      const fim    = params.dataFim    + 'T23:59:59.999-03:00'

      let q = supabase
        .from('vendas')
        .select('*', { count: 'exact' })
        .order('data_pedido', { ascending: false })
        .range(params.pagina * PAGE_SIZE, params.pagina * PAGE_SIZE + PAGE_SIZE - 1)

      // Filtro por e-mails tem prioridade — ignora intervalo de datas
      if (params.emails && params.emails.length > 0) {
        q = q.in('email_contato', params.emails)
      } else {
        q = q.gte('data_pedido', inicio).lte('data_pedido', fim)
      }

      if (params.produtoId)   q = q.eq('produto_id', params.produtoId)
      if (params.status)      q = q.eq('status', params.status)
      if (params.pagamento)   q = q.ilike('pagamento', `%${params.pagamento}%`)
      if (params.marketplace) q = q.eq('marketplace', params.marketplace)
      if (filtroPersonalizadoRef.current?.regras?.length) q = aplicarRegras(q, filtroPersonalizadoRef.current.regras)

      const { data, count } = await q
      setVendas((data as Venda[]) ?? [])
      setTotal(count ?? 0)

      if (!params.emails?.length) {
        // Se há filtro personalizado ativo, busca todas as vendas filtradas para calcular KPIs localmente
        if (filtroPersonalizadoRef.current?.regras?.length) {
          let qAll = supabase
            .from('vendas')
            .select('*')
            .gte('data_pedido', inicio)
            .lte('data_pedido', fim)

          if (params.produtoId)   qAll = qAll.eq('produto_id', params.produtoId)
          if (params.status)      qAll = qAll.eq('status', params.status)
          if (params.pagamento)   qAll = qAll.ilike('pagamento', `%${params.pagamento}%`)
          if (params.marketplace) qAll = qAll.eq('marketplace', params.marketplace)
          qAll = aplicarRegras(qAll, filtroPersonalizadoRef.current.regras)

          const { data: todas } = await qAll
          calcularKpisLocais((todas as Venda[]) ?? [])
        } else {
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
        }
      }
    })
  }, [supabase])

  function aplicarFiltros(novaPagina = 0) {
    setPagina(novaPagina)
    buscar({ dataInicio, dataFim, produtoId, status, pagamento, marketplace, pagina: novaPagina, emails: emailsFiltro })
  }

  function handleFiltroSalvo(id: string) {
    const filtro = filtrosSalvos.find(f => f.id === id) ?? null
    filtroPersonalizadoRef.current = filtro
    setFiltroSalvoAtivo(id)
    aplicarFiltros(0)
  }

  function limparFiltros() {
    setProdutoId(''); setStatus(''); setPagamento(''); setMarketplace('')
    setEmailsFiltro([])
    setTodasVendasEmails([])
    filtroPersonalizadoRef.current = null
    setFiltroSalvoAtivo('')
    setPagina(0)
    buscar({ dataInicio, dataFim, produtoId: '', status: '', pagamento: '', marketplace: '', pagina: 0, emails: [] })
  }

  function mudarPagina(nova: number) {
    setPagina(nova)
    if (emailsFiltro.length > 0) {
      setVendas(todasVendasEmails.slice(nova * PAGE_SIZE, nova * PAGE_SIZE + PAGE_SIZE))
    } else {
      buscar({ dataInicio, dataFim, produtoId, status, pagamento, marketplace, pagina: nova, emails: [] })
    }
  }

  return (
    <div className="p-6 space-y-5">

      {/* Banner filtro CRM */}
      {emailsFiltro.length > 0 && (
        <div
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: '#2A1E08', border: '1px solid #C9A84C44', color: '#C9A84C' }}
        >
          <span>
            Mostrando vendas dos <strong>{emailsFiltro.length} compradores</strong> do CRM — sem filtro de data
          </span>
          <button
            onClick={limparFiltros}
            className="text-xs px-3 py-1 rounded-lg transition-colors shrink-0"
            style={{ border: '1px solid #C9A84C66', color: '#C9A84C' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#3A2E10'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            Limpar filtro
          </button>
        </div>
      )}

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

          {filtrosSalvos.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Filtro salvo</label>
              <select
                value={filtroSalvoAtivo}
                onChange={e => handleFiltroSalvo(e.target.value)}
                style={selectStyle}
                onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                onBlur={e => (e.target.style.borderColor = '#222222')}
              >
                <option value="">Nenhum</option>
                {filtrosSalvos.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
          )}

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
