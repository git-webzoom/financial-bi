'use client'

import { useEffect, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatData, formatMoeda } from '@/lib/format'
import type { InscritoCrm } from './CrmClient'

type AbaDetalhe = 'captacao' | 'webinarios' | 'vendas' | 'engajamento'

interface Props {
  inscrito: InscritoCrm
  onClose: () => void
}

function BadgeTemperatura({ temp }: { temp: string | null }) {
  if (!temp) return null
  const map: Record<string, { bg: string; text: string }> = {
    'Quente': { bg: '#2A0F0F', text: '#DC2626' },
    'Morno':  { bg: '#2A1A0F', text: '#EA580C' },
    'Frio':   { bg: '#0F1A2A', text: '#2563EB' },
  }
  const cfg = map[temp] ?? { bg: '#1A1A1A', text: '#888888' }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      {temp}
    </span>
  )
}

function Campo({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#555555' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: valor ? '#FFFFFF' : '#444444' }}>{valor || '—'}</p>
    </div>
  )
}

function AbaCaptacao({ inscrito }: { inscrito: InscritoCrm }) {
  const [utmAtual, setUtmAtual] = useState<{
    utm_source: string | null; utm_campaign: string | null; utm_medium: string | null;
    utm_content: string | null; utm_term: string | null; utm_id: string | null;
  } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    // Busca UTM atual do crm para comparar com a de captação
    supabase
      .from('crm')
      .select('utm_source, utm_campaign, utm_medium, utm_content, utm_term, utm_id')
      .eq('id', inscrito.crm_id)
      .single()
      .then(({ data }) => setUtmAtual(data))
  }, [inscrito.crm_id])

  const utmMudou = utmAtual && (
    utmAtual.utm_source   !== inscrito.utm_source   ||
    utmAtual.utm_campaign !== inscrito.utm_campaign ||
    utmAtual.utm_medium   !== inscrito.utm_medium
  )

  return (
    <div className="space-y-5 p-5">

      {/* UTM de captação — congelada no momento da inscrição */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#555555' }}>UTM de Captação</p>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>
            Tráfego original · congelada
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="utm_source"   valor={inscrito.utm_source} />
          <Campo label="utm_campaign" valor={inscrito.utm_campaign} />
          <Campo label="utm_medium"   valor={inscrito.utm_medium} />
          <Campo label="utm_content"  valor={inscrito.utm_content} />
          <Campo label="utm_term"     valor={inscrito.utm_term} />
          <Campo label="utm_id"       valor={inscrito.utm_id} />
        </div>
      </div>

      {/* UTM atual do AC — só exibe se for diferente da de captação */}
      {utmMudou && utmAtual && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#555555' }}>UTM Atual no AC</p>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#2A1A0F', color: '#FB923C' }}>
              Sobrescrita (provável UTM de venda)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="utm_source"   valor={utmAtual.utm_source} />
            <Campo label="utm_campaign" valor={utmAtual.utm_campaign} />
            <Campo label="utm_medium"   valor={utmAtual.utm_medium} />
            <Campo label="utm_content"  valor={utmAtual.utm_content} />
            <Campo label="utm_term"     valor={utmAtual.utm_term} />
            <Campo label="utm_id"       valor={utmAtual.utm_id} />
          </div>
        </div>
      )}
    </div>
  )
}

function AbaWebinarios({ inscrito }: { inscrito: InscritoCrm }) {
  const [semanas, setSemanas] = useState<Array<{
    numero_semana: number; data_evento: string | null; data_inscricao: string | null;
  }>>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('webinario_inscritos')
      .select('numero_semana, data_inscricao, webinario_semanas:numero_semana(data_evento)')
      .eq('contato_id', inscrito.contato_id)
      .order('numero_semana', { ascending: false })
      .then(({ data }) => {
        setSemanas((data ?? []).map(r => ({
          numero_semana: r.numero_semana,
          data_inscricao: r.data_inscricao as string ?? null,
          data_evento: (r.webinario_semanas as { data_evento?: string } | null)?.data_evento ?? null,
        })))
      })
  }, [inscrito.contato_id])

  if (semanas.length === 0) {
    return <p className="p-5 text-sm" style={{ color: '#555555' }}>Nenhum webinário encontrado.</p>
  }

  return (
    <div className="space-y-2 p-5">
      {semanas.map(s => (
        <div
          key={s.numero_semana}
          className="rounded-lg px-4 py-3"
          style={{ backgroundColor: '#0A0A0A', border: '1px solid #1E1E1E' }}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Semana {s.numero_semana}</p>
            {s.data_evento && (
              <p className="text-xs" style={{ color: '#888888' }}>
                {new Date(s.data_evento).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
          <p className="text-xs" style={{ color: '#555555' }}>
            Inscrito em: {formatData(s.data_inscricao)}
          </p>
          <div className="flex gap-4 mt-2 text-xs" style={{ color: '#444444' }}>
            <span>Acessou: —</span>
            <span>Pitch: —</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function AbaVendas({ inscrito }: { inscrito: InscritoCrm }) {
  const [vendas, setVendas] = useState<Array<{
    id: string; data_aprovacao: string | null; nome_oferta: string | null;
    valor_venda: number | null; valor_liquido: number | null; status: string;
    pagamento: string | null; parcelas: number | null; moeda: string | null;
  }>>([])
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('vendas')
      .select('id, data_aprovacao, nome_oferta, valor_venda, valor_liquido, status, pagamento, parcelas, moeda')
      .eq('email_contato', inscrito.email)
      .order('data_aprovacao', { ascending: false })
      .then(({ data }) => setVendas(data ?? []))
  }, [inscrito.email])

  const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
    approved:  { bg: '#0F2A1A', text: '#4ADE80', label: 'Aprovada' },
    complete:  { bg: '#0F2A1A', text: '#4ADE80', label: 'Completa' },
    refunded:  { bg: '#2A0F0F', text: '#F87171', label: 'Reembolsada' },
    cancelled: { bg: '#1A1A1A', text: '#888888', label: 'Cancelada' },
    pending:   { bg: '#2A2A0F', text: '#FACC15', label: 'Pendente' },
  }

  const STATUS_APROVADO = ['approved', 'complete', 'completed', 'paid', 'active', 'confirmed']
  const totalLiquido = vendas.filter(v => STATUS_APROVADO.includes(v.status)).reduce((s, v) => s + (v.valor_liquido ?? 0), 0)

  if (vendas.length === 0) {
    return (
      <div className="p-10 text-center text-sm" style={{ color: '#555555' }}>
        Sem compras registradas.
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="space-y-2 mb-4">
        {vendas.map(v => {
          const cfg = STATUS_MAP[v.status] ?? { bg: '#1A1A1A', text: '#888888', label: v.status }
          return (
            <div
              key={v.id}
              className="rounded-lg px-4 py-3 grid gap-2"
              style={{ backgroundColor: '#0A0A0A', border: '1px solid #1E1E1E', gridTemplateColumns: '1fr auto' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{v.nome_oferta || '—'}</p>
                <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                  {formatData(v.data_aprovacao)} · {v.pagamento?.replace('_',' ') ?? '—'}{v.parcelas && v.parcelas > 1 ? ` ${v.parcelas}x` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{formatMoeda(v.valor_venda, v.moeda ?? 'BRL')}</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-0.5" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between items-center pt-3" style={{ borderTop: '1px solid #1E1E1E' }}>
        <p className="text-xs" style={{ color: '#888888' }}>Total líquido (aprovadas)</p>
        <p className="text-sm font-bold" style={{ color: '#C9A84C' }}>{formatMoeda(totalLiquido)}</p>
      </div>
    </div>
  )
}

function AbaEngajamento({ inscrito }: { inscrito: InscritoCrm }) {
  const taxa = inscrito.emails_enviados && inscrito.emails_abertos
    ? (inscrito.emails_abertos / inscrito.emails_enviados * 100).toFixed(1) + '%'
    : '—'

  const items = [
    { label: 'Emails Enviados',    valor: inscrito.emails_enviados ?? '—' },
    { label: 'Emails Abertos',     valor: inscrito.emails_abertos ?? '—' },
    { label: 'Taxa de Abertura',   valor: taxa },
    { label: 'Cliques',            valor: inscrito.cliques_email ?? '—' },
    { label: 'Última Interação',   valor: formatData(inscrito.ultima_interacao) },
    { label: 'Última Abertura',    valor: formatData(inscrito.data_abertura_email) },
    { label: 'Último Clique',      valor: formatData(inscrito.ultimo_clique) },
    { label: 'Último Envio',       valor: formatData(inscrito.ultimo_envio_email) },
    { label: 'Limite Engajamento', valor: inscrito.limite_engajamento ?? '—' },
    { label: 'Recadastros',        valor: inscrito.numeros_recadastro ?? '—' },
  ]

  return (
    <div className="p-5 grid grid-cols-2 gap-4">
      {items.map(({ label, valor }) => (
        <div key={label} className="rounded-lg px-3 py-2" style={{ backgroundColor: '#0A0A0A', border: '1px solid #1E1E1E' }}>
          <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: '#555555' }}>{label}</p>
          <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{valor}</p>
        </div>
      ))}
    </div>
  )
}

export default function CrmPainelDetalhe({ inscrito, onClose }: Props) {
  const [aba, setAba] = useState<AbaDetalhe>('captacao')
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const abas: { key: AbaDetalhe; label: string }[] = [
    { key: 'captacao',    label: 'Captação' },
    { key: 'webinarios',  label: 'Webinários' },
    { key: 'vendas',      label: 'Vendas' },
    { key: 'engajamento', label: 'Engajamento' },
  ]

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={onClose}
      />

      {/* Painel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col shadow-2xl"
        style={{ width: 'min(600px, 100vw)', backgroundColor: '#111111', borderLeft: '1px solid #222222' }}
      >
        {/* Cabeçalho */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #222222', backgroundColor: '#1A1A1A' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-bold truncate" style={{ color: '#FFFFFF' }}>{inscrito.nome || '—'}</p>
              <p className="text-sm mt-0.5 truncate" style={{ color: '#888888' }}>{inscrito.email}</p>
              {inscrito.telefone && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm" style={{ color: '#888888' }}>{inscrito.telefone}</p>
                  <button
                    onClick={() => copiar(inscrito.telefone!)}
                    className="p-0.5 rounded"
                    style={{ color: '#555555' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
                  >
                    {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-2">
                {(inscrito.cidade || inscrito.estado) && (
                  <span className="text-xs" style={{ color: '#555555' }}>
                    {[inscrito.cidade, inscrito.estado].filter(Boolean).join(', ')}
                  </span>
                )}
                <BadgeTemperatura temp={inscrito.temperatura} />
                {inscrito.comprou && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>
                    ✓ Comprou
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg shrink-0"
              style={{ color: '#888888' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLElement).style.backgroundColor = '#333333' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#888888'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex" style={{ borderBottom: '1px solid #222222' }}>
          {abas.map(a => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
              style={aba === a.key
                ? { borderColor: '#C9A84C', color: '#C9A84C' }
                : { borderColor: 'transparent', color: '#888888' }
              }
              onMouseEnter={e => { if (aba !== a.key) (e.currentTarget as HTMLElement).style.color = '#FFFFFF' }}
              onMouseLeave={e => { if (aba !== a.key) (e.currentTarget as HTMLElement).style.color = '#888888' }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {aba === 'captacao'    && <AbaCaptacao    inscrito={inscrito} />}
          {aba === 'webinarios'  && <AbaWebinarios  inscrito={inscrito} />}
          {aba === 'vendas'      && <AbaVendas      inscrito={inscrito} />}
          {aba === 'engajamento' && <AbaEngajamento inscrito={inscrito} />}
        </div>
      </div>
    </>
  )
}
