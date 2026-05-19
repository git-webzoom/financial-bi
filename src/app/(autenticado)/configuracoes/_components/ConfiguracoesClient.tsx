'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatData } from '@/lib/format'
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw, Loader2,
  Plus, Trash2, Eye, EyeOff, Save, Zap, Users, ShieldCheck, User,
} from 'lucide-react'
import type { FiltroPersonalizado, RegraFiltro, Modulo, Operador } from '@/lib/filtros-personalizados'
import { CAMPOS_POR_MODULO, OPERADORES } from '@/lib/filtros-personalizados'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Token {
  integration: string
  ativo: boolean
  last_sync_at: string | null
  last_sync_status: string | null
  expires_at: string | null
}

interface JobRun {
  id: string
  integration: string
  status: string
  account_id: string | null
  started_at: string
  finished_at: string | null
  records_fetched: number | null
  records_inserted: number | null
  records_error: number | null
  error_message: string | null
}

interface WebhookErro {
  tabela: string
  count: number
}

interface MetaAccount {
  id: string
  account_id: string
  nome: string
  ativo: boolean
  last_sync_at: string | null
  last_sync_status: string | null
}

interface MetaToken {
  expires_at: string | null
  ativo: boolean
  last_sync_at: string | null
  last_sync_status: string | null
}

interface DadosConfiguracao {
  tokens: Token[]
  jobs: JobRun[]
  webhookErros: WebhookErro[]
  metaAccounts: MetaAccount[]
  metaToken: MetaToken | null
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const INTEGRACOES = [
  { key: 'manager_guru',    label: 'Manager Guru',   icon: '🔗' },
  { key: 'meta_ads',        label: 'Meta Ads',       icon: '📊' },
  { key: 'active_campaign', label: 'ActiveCampaign', icon: '✉️' },
  { key: 'hotwebnar',       label: 'Hotwebnar',      icon: '🎥' },
  { key: 'sendflow',        label: 'Sendflow',       icon: '📨' },
]

const WEBHOOK_TABELAS = [
  { tabela: 'raw_vendas', label: 'Manager Guru — Vendas' },
]

type Aba = 'integracoes' | 'manager_guru' | 'meta_ads' | 'activecampaign' | 'sendflow' | 'usuarios' | 'filtros'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasParaVencer(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

function BadgeStatus({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs" style={{ color: '#555555' }}>Nunca executou</span>
  const map: Record<string, { bg: string; text: string; label: string }> = {
    success: { bg: '#0F2A1A', text: '#4ADE80', label: 'Sucesso' },
    error:   { bg: '#2A0F0F', text: '#F87171', label: 'Erro' },
    running: { bg: '#0F1A2A', text: '#60A5FA', label: 'Executando' },
    pending: { bg: '#2A2A0F', text: '#FACC15', label: 'Pendente' },
  }
  const cfg = map[status] ?? { bg: '#1A1A1A', text: '#888888', label: status }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}

// ─── Aba Integrações ──────────────────────────────────────────────────────────

function JobRunLinha({ job, metaAccounts }: { job: JobRun; metaAccounts?: MetaAccount[] }) {
  const nomeConta = job.account_id && metaAccounts?.length
    ? (metaAccounts.find(a => a.account_id === job.account_id)?.nome ?? job.account_id)
    : job.account_id ?? null

  return (
    <div
      className="grid grid-cols-5 gap-2 py-2 last:border-0 text-xs"
      style={{ borderBottom: '1px solid #1E1E1E' }}
    >
      <div className="col-span-2">
        <span style={{ color: '#888888' }}>{formatData(job.started_at)}</span>
        {nomeConta && <p className="truncate mt-0.5" style={{ color: '#555555' }}>{nomeConta}</p>}
      </div>
      <BadgeStatus status={job.status} />
      <span className="text-center" style={{ color: '#FFFFFF' }}>{job.records_fetched ?? '—'} / {job.records_inserted ?? '—'}</span>
      <span className="truncate" style={{ color: '#F87171' }}>{job.error_message ?? ''}</span>
    </div>
  )
}

function CardIntegracao({
  integracao, token, jobs, metaAccounts,
}: {
  integracao: typeof INTEGRACOES[number]
  token: Token | undefined
  jobs: JobRun[]
  metaAccounts?: MetaAccount[]
}) {
  const [aberto, setAberto] = useState(false)
  const [pagina, setPagina] = useState(0)
  const dias = diasParaVencer(token?.expires_at ?? null)
  const alertaToken = integracao.key === 'meta_ads' && dias !== null && dias < 7

  const pageSize = Math.max(metaAccounts?.filter(a => a.ativo).length ?? 1, 1)
  const totalPaginas = Math.ceil(jobs.length / pageSize)
  const jobsPagina = jobs.slice(pagina * pageSize, pagina * pageSize + pageSize)

  function toggleAberto() {
    setAberto(v => !v)
    setPagina(0)
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        <span className="text-2xl">{integracao.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>{integracao.label}</p>
            {token?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}><CheckCircle className="w-3 h-3" />Ativo</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}><XCircle className="w-3 h-3" />Inativo</span>
            }
            {alertaToken && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#2A1A0F', color: '#FB923C' }}>
                <AlertTriangle className="w-3 h-3" />Token vence em {dias}d
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="text-xs flex items-center gap-1" style={{ color: '#555555' }}>
              <Clock className="w-3 h-3" />
              Última sync: {formatData(token?.last_sync_at ?? null)}
            </span>
            <BadgeStatus status={token?.last_sync_status ?? null} />
          </div>
        </div>
        <button
          onClick={toggleAberto}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors shrink-0"
          style={{ color: '#888888', border: '1px solid #333333', backgroundColor: 'transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
            ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#888888'
          }}
        >
          {aberto ? <><ChevronUp className="w-4 h-4" />Ocultar logs</> : <><ChevronDown className="w-4 h-4" />Ver logs</>}
        </button>
      </div>

      {aberto && (
        <div className="px-5 py-3" style={{ borderTop: '1px solid #1E1E1E', backgroundColor: '#0A0A0A' }}>
          {jobs.length === 0
            ? <p className="text-xs py-2" style={{ color: '#555555' }}>Nenhuma execução registrada.</p>
            : <>
                <div className="grid grid-cols-5 gap-2 pb-1 text-xs font-medium" style={{ color: '#555555' }}>
                  <span className="col-span-2">Início</span>
                  <span>Status</span>
                  <span className="text-center">Buscados / Inseridos</span>
                  <span>Erro</span>
                </div>
                {jobsPagina.map(j => <JobRunLinha key={j.id} job={j} metaAccounts={metaAccounts} />)}

                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid #1E1E1E' }}>
                    <span className="text-xs" style={{ color: '#555555' }}>
                      Página {pagina + 1} de {totalPaginas}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setPagina(p => p - 1)}
                        disabled={pagina === 0}
                        className="p-1 rounded transition-colors disabled:opacity-30"
                        style={{ color: '#888888' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPagina(p => p + 1)}
                        disabled={pagina >= totalPaginas - 1}
                        className="p-1 rounded transition-colors disabled:opacity-30"
                        style={{ color: '#888888' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
          }
        </div>
      )}
    </div>
  )
}

interface WebhookDetalhe {
  id: string
  error: string
  payload: Record<string, unknown>
  received_at: string
}

function ModalWebhook({ wh, onClose }: { wh: WebhookDetalhe; onClose: () => void }) {
  const email   = (wh.payload?.contact as Record<string, unknown>)?.email as string | undefined
  const nome    = (wh.payload?.contact as Record<string, unknown>)?.name  as string | undefined
  const status  = wh.payload?.status as string | undefined
  const produto = (wh.payload?.product as Record<string, unknown>)?.name  as string | undefined
  const valor   = (wh.payload?.payment as Record<string, unknown>)?.total as number | undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl overflow-hidden flex flex-col"
        style={{ backgroundColor: '#111111', border: '1px solid #333333', maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3 shrink-0" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#F87171' }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: '#FFFFFF' }}>Detalhe do Erro</p>
            <p className="text-xs mt-0.5 font-mono truncate" style={{ color: '#555555' }}>{wh.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg shrink-0"
            style={{ color: '#888888' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#888888'}
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Erro */}
          <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: '#2A0F0F', border: '1px solid #F8717133' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#888888' }}>MENSAGEM DE ERRO</p>
            <p className="text-sm font-mono" style={{ color: '#F87171' }}>{wh.error}</p>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Recebido em', value: new Date(wh.received_at).toLocaleString('pt-BR') },
              { label: 'Status', value: status ?? '—' },
              { label: 'E-mail', value: email ?? '—' },
              { label: 'Nome', value: nome ?? '—' },
              { label: 'Produto', value: produto ?? '—' },
              { label: 'Valor', value: valor != null ? `R$ ${Number(valor).toFixed(2)}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="px-3 py-2 rounded-lg" style={{ backgroundColor: '#0A0A0A', border: '1px solid #222222' }}>
                <p className="text-xs mb-0.5" style={{ color: '#555555' }}>{label}</p>
                <p className="text-sm truncate" style={{ color: '#FFFFFF' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Payload completo */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: '#555555' }}>PAYLOAD COMPLETO</p>
            <pre
              className="text-xs rounded-lg p-4 overflow-x-auto"
              style={{ backgroundColor: '#0A0A0A', border: '1px solid #222222', color: '#888888', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {JSON.stringify(wh.payload, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

function SecaoWebhookTabela({
  tabela, label, count, onReprocessar,
}: {
  tabela: string
  label: string
  count: number
  onReprocessar: (tabela: string) => Promise<void>
}) {
  const [aberto, setAberto]               = useState(false)
  const [carregando, setCarregando]       = useState(false)
  const [reprocessando, setReprocessando] = useState(false)
  const [webhooks, setWebhooks]           = useState<WebhookDetalhe[]>([])
  const [selecionado, setSelecionado]     = useState<WebhookDetalhe | null>(null)

  async function abrir() {
    if (aberto) { setAberto(false); return }
    if (count === 0) return
    setAberto(true)
    setCarregando(true)
    const res = await fetch(`/api/webhooks-erro?tabela=${tabela}`)
    const json = await res.json()
    setWebhooks(json.webhooks ?? [])
    setCarregando(false)
  }

  async function reprocessar() {
    setReprocessando(true)
    await onReprocessar(tabela)
    setWebhooks([])
    setAberto(false)
    setReprocessando(false)
  }

  return (
    <>
      {selecionado && <ModalWebhook wh={selecionado} onClose={() => setSelecionado(null)} />}

      <div style={{ borderBottom: '1px solid #1E1E1E' }}>
        {/* Linha principal */}
        <div className="px-5 py-3 flex items-center justify-between gap-4">
          <button
            onClick={abrir}
            disabled={count === 0}
            className="flex items-center gap-2 text-left flex-1 disabled:cursor-default"
          >
            <div>
              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{label}</p>
              <p className="text-xs mt-0.5">
                {count === 0
                  ? <span style={{ color: '#555555' }}>Nenhuma falha</span>
                  : <span className="font-medium" style={{ color: '#F87171' }}>{count} webhook{count > 1 ? 's' : ''} com erro</span>
                }
              </p>
            </div>
            {count > 0 && (
              aberto
                ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: '#555555' }} />
                : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: '#555555' }} />
            )}
          </button>

          <button
            onClick={reprocessar}
            disabled={count === 0 || reprocessando}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
            onMouseEnter={e => { if (count > 0 && !reprocessando) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
          >
            {reprocessando ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Reprocessando…</> : <><RefreshCw className="w-3.5 h-3.5" />Reprocessar</>}
          </button>
        </div>

        {/* Lista expandida */}
        {aberto && (
          <div style={{ backgroundColor: '#0A0A0A', borderTop: '1px solid #1E1E1E' }}>
            {carregando ? (
              <div className="flex items-center gap-2 px-5 py-4 text-xs" style={{ color: '#555555' }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando falhas…
              </div>
            ) : webhooks.length === 0 ? (
              <p className="px-5 py-4 text-xs" style={{ color: '#555555' }}>Nenhum webhook encontrado.</p>
            ) : (
              <>
                <div
                  className="grid gap-2 px-5 py-1.5 text-xs font-medium"
                  style={{ gridTemplateColumns: '1fr 2fr 1fr', color: '#555555', borderBottom: '1px solid #1E1E1E' }}
                >
                  <span>Recebido</span>
                  <span>Erro</span>
                  <span />
                </div>
                {webhooks.map(wh => {
                  const email = (wh.payload?.contact as Record<string, unknown>)?.email as string | undefined
                  return (
                    <div
                      key={wh.id}
                      className="grid gap-2 px-5 py-2.5 items-center cursor-pointer transition-colors"
                      style={{ gridTemplateColumns: '1fr 2fr 1fr', borderBottom: '1px solid #1A1A1A' }}
                      onClick={() => setSelecionado(wh)}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#111111'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <p className="text-xs" style={{ color: '#888888' }}>
                          {new Date(wh.received_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {email && <p className="text-xs mt-0.5 truncate" style={{ color: '#555555' }}>{email}</p>}
                      </div>
                      <p className="text-xs truncate" style={{ color: '#F87171' }}>{wh.error}</p>
                      <div className="flex justify-end">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}>
                          Ver detalhes →
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function CardWebhooksErro({
  webhookErros, onReprocessar,
}: {
  webhookErros: WebhookErro[]
  onReprocessar: (tabela: string) => Promise<void>
}) {
  const totalErros = webhookErros.reduce((s, w) => s + w.count, 0)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#111111', border: '1px solid #222222' }}
    >
      <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #1E1E1E' }}>
        <AlertTriangle className="w-5 h-5" style={{ color: '#FB923C' }} />
        <p className="font-semibold" style={{ color: '#FFFFFF' }}>Webhooks com Falha</p>
        {totalErros > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#2A0F0F', color: '#F87171' }}>{totalErros}</span>
        )}
        <p className="text-xs ml-auto" style={{ color: '#555555' }}>Clique na linha para ver o erro</p>
      </div>
      <div>
        {WEBHOOK_TABELAS.map(({ tabela, label }) => (
          <SecaoWebhookTabela
            key={tabela}
            tabela={tabela}
            label={label}
            count={webhookErros.find(w => w.tabela === tabela)?.count ?? 0}
            onReprocessar={onReprocessar}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Aba Meta Ads ─────────────────────────────────────────────────────────────

function AbaMetaAds({
  metaToken, metaAccounts, onRefresh,
}: {
  metaToken: MetaToken | null
  metaAccounts: MetaAccount[]
  onRefresh: () => void
}) {
  const supabase = createClient()

  const [token, setToken]           = useState('')
  const [expiresAt, setExpiresAt]   = useState('')
  const [showToken, setShowToken]   = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [accounts, setAccounts]     = useState<MetaAccount[]>(metaAccounts)
  useEffect(() => { setAccounts(metaAccounts) }, [metaAccounts])
  const [novoNome, setNovoNome]     = useState('')
  const [novoId, setNovoId]         = useState('')
  const [addingAccount, setAddingAccount] = useState(false)
  const [accountMsg, setAccountMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [syncing, setSyncing]           = useState<string | null>(null)
  const [syncingAll, setSyncingAll]     = useState(false)
  const [syncingWeekly, setSyncingWeekly] = useState(false)
  const [syncAllMsg, setSyncAllMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const dias = diasParaVencer(metaToken?.expires_at ?? null)

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    border: '1px solid #333333',
    color: '#FFFFFF',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  async function salvarToken() {
    if (!token.trim()) return
    setSavingToken(true)
    setTokenMsg(null)
    try {
      const res = await fetch('/api/meta-ads/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), expires_at: expiresAt || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setToken('')
      setTokenMsg({ type: 'ok', text: 'Token salvo com sucesso.' })
      onRefresh()
    } catch (e: unknown) {
      setTokenMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao salvar token.' })
    } finally {
      setSavingToken(false)
    }
  }

  async function adicionarConta() {
    if (!novoNome.trim() || !novoId.trim()) return
    setAddingAccount(true)
    setAccountMsg(null)
    const accountId = novoId.trim().replace(/^act_/i, '')
    const { data, error } = await supabase
      .from('meta_ad_accounts')
      .insert({ account_id: accountId, nome: novoNome.trim(), ativo: true })
      .select('id, account_id, nome, ativo, last_sync_at, last_sync_status')
      .single()
    if (error) {
      setAccountMsg({ type: 'err', text: error.message })
    } else {
      setAccounts(prev => [...prev, data])
      setNovoNome('')
      setNovoId('')
      setAccountMsg({ type: 'ok', text: 'Conta adicionada. Carga inicial sendo processada...' })
    }
    setAddingAccount(false)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('meta_ad_accounts').update({ ativo: !ativo }).eq('id', id)
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ativo: !ativo } : a))
  }

  async function removerConta(id: string) {
    if (!confirm('Remover esta conta? Os dados de tráfego já importados serão mantidos.')) return
    await supabase.from('meta_ad_accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  async function sincronizarConta(accountId: string) {
    setSyncing(accountId)
    try {
      await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      })
      const { data } = await supabase
        .from('meta_ad_accounts')
        .select('id, account_id, nome, ativo, last_sync_at, last_sync_status')
        .eq('account_id', accountId)
        .single()
      if (data) setAccounts(prev => prev.map(a => a.account_id === accountId ? data : a))
      onRefresh()
    } finally {
      setSyncing(null)
    }
  }

  async function sincronizarSemanal() {
    setSyncingWeekly(true)
    setSyncAllMsg(null)
    try {
      const res = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'weekly' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setSyncAllMsg({ type: 'ok', text: json.message ?? 'Sync iniciado em background.' })
      onRefresh()
    } catch (e: unknown) {
      setSyncAllMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally {
      setSyncingWeekly(false)
    }
  }

  async function sincronizarTudo() {
    setSyncingAll(true)
    setSyncAllMsg(null)
    try {
      const res = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setSyncAllMsg({ type: 'ok', text: json.message ?? 'Sync iniciado em background.' })
      onRefresh()
    } catch (e: unknown) {
      setSyncAllMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally {
      setSyncingAll(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Token */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🔑</span>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#FFFFFF' }}>Access Token</p>
              <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                User Token ou System User Token do Meta Business Manager
              </p>
            </div>
            {metaToken?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}><CheckCircle className="w-3 h-3" />Configurado</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}><XCircle className="w-3 h-3" />Não configurado</span>
            }
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {dias !== null && dias < 14 && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
              style={dias < 7
                ? { backgroundColor: '#2A0F0F', color: '#F87171' }
                : { backgroundColor: '#2A1A0F', color: '#FB923C' }
              }
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {dias <= 0 ? 'Token expirado!' : `Token vence em ${dias} dia${dias !== 1 ? 's' : ''}.`} Atualize abaixo.
            </div>
          )}

          {metaToken && (
            <div className="flex items-center gap-6 text-xs pb-1" style={{ color: '#555555' }}>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Última sync: {formatData(metaToken.last_sync_at)}</span>
              <BadgeStatus status={metaToken.last_sync_status} />
              {metaToken.expires_at && <span>Expira: {new Date(metaToken.expires_at).toLocaleDateString('pt-BR')}</span>}
            </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={metaToken ? 'Novo token (deixe vazio para manter o atual)' : 'Cole seu access token aqui'}
                style={{ ...inputStyle, paddingRight: '2.5rem', fontFamily: 'monospace' }}
                onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                onBlur={e => (e.target.style.borderColor = '#333333')}
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: '#555555' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              style={{ ...inputStyle, width: 'auto' }}
              title="Data de expiração do token"
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
            <button
              onClick={salvarToken}
              disabled={savingToken || !token.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!savingToken && token.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
            >
              {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>

          {tokenMsg && (
            <p className="text-xs" style={{ color: tokenMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {tokenMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Contas de anúncio */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>Contas de Anúncio</p>
            <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
              Adicione as contas que deseja sincronizar. O ID está no formato{' '}
              <code
                className="px-1 rounded text-xs"
                style={{ backgroundColor: '#1A1A1A', color: '#C9A84C', fontFamily: 'monospace' }}
              >
                act_123456789
              </code>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs" style={{ color: '#555555' }}>{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</span>
            <button
              onClick={sincronizarSemanal}
              disabled={syncingWeekly || syncingAll || syncing !== null || accounts.filter(a => a.ativo).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#1A1A1A', color: '#C9A84C', border: '1px solid #C9A84C' }}
              onMouseEnter={e => { if (!syncingWeekly) (e.currentTarget as HTMLElement).style.backgroundColor = '#2A2A2A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
              title="Rebusca os últimos 7 dias na API Meta (use após mudar campos)"
            >
              {syncingWeekly
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sync 8 dias</>
              }
            </button>
            <button
              onClick={sincronizarTudo}
              disabled={syncingAll || syncingWeekly || syncing !== null || accounts.filter(a => a.ativo).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!syncingAll) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              title="Sincroniza todas as contas ativas (últimos 2 dias)"
            >
              {syncingAll
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sync 2 dias</>
              }
            </button>
          </div>
        </div>

        {syncAllMsg && (
          <div
            className="px-5 py-2 text-xs flex items-center gap-2"
            style={{
              borderBottom: '1px solid #1E1E1E',
              backgroundColor: syncAllMsg.type === 'ok' ? '#0F2A1A' : '#2A0F0F',
              color: syncAllMsg.type === 'ok' ? '#4ADE80' : '#F87171',
            }}
          >
            {syncAllMsg.type === 'ok' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
            {syncAllMsg.text}
          </div>
        )}

        {/* Formulário adicionar */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E', backgroundColor: '#0A0A0A' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              placeholder="Nome da conta (ex: Financial Move BR)"
              className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
              style={{ backgroundColor: '#111111', border: '1px solid #333333', color: '#FFFFFF' }}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
            <input
              type="text"
              value={novoId}
              onChange={e => setNovoId(e.target.value)}
              placeholder="ID (ex: act_123456789)"
              className="w-52 px-3 py-2 text-sm rounded-lg outline-none font-mono"
              style={{ backgroundColor: '#111111', border: '1px solid #333333', color: '#FFFFFF' }}
              onKeyDown={e => e.key === 'Enter' && adicionarConta()}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
            <button
              onClick={adicionarConta}
              disabled={addingAccount || !novoNome.trim() || !novoId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!addingAccount) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
            >
              {addingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </button>
          </div>
          {accountMsg && (
            <p className="text-xs mt-2" style={{ color: accountMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {accountMsg.text}
            </p>
          )}
        </div>

        {/* Lista de contas */}
        {accounts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm" style={{ color: '#555555' }}>
            Nenhuma conta cadastrada. Adicione acima.
          </div>
        ) : (
          <div>
            {accounts.map(acc => (
              <div
                key={acc.id}
                className="px-5 py-3 flex items-center gap-4"
                style={{ borderBottom: '1px solid #1E1E1E' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{acc.nome}</p>
                    {acc.ativo
                      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>Ativa</span>
                      : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}>Inativa</span>
                    }
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-mono" style={{ color: '#555555' }}>act_{acc.account_id}</span>
                    <span style={{ color: '#333333' }}>·</span>
                    <span className="text-xs flex items-center gap-1" style={{ color: '#555555' }}>
                      <Clock className="w-3 h-3" />
                      {acc.last_sync_at ? formatData(acc.last_sync_at) : 'Nunca sincronizado'}
                    </span>
                    {acc.last_sync_status && <BadgeStatus status={acc.last_sync_status} />}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => sincronizarConta(acc.account_id)}
                    disabled={syncing === acc.account_id || syncingAll || syncingWeekly}
                    title={syncingAll || syncingWeekly ? 'Sync em andamento…' : 'Sincronizar esta conta agora'}
                    className="p-1.5 rounded-lg disabled:opacity-40 transition-colors"
                    style={{ color: '#888888' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = '#C9A84C'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = '#888888'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    {syncing === acc.account_id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Zap className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => toggleAtivo(acc.id, acc.ativo)}
                    title={acc.ativo ? 'Desativar' : 'Ativar'}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#888888' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = '#FB923C'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = '#888888'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    {acc.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => removerConta(acc.id)}
                    title="Remover conta"
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#888888' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = '#F87171'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = '#888888'
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aba Usuários ─────────────────────────────────────────────────────────────

interface Usuario {
  id: string
  nome: string
  email: string | null
  perfil: string
  ativo: boolean
  created_at: string
}

function AbaUsuarios({ meuId }: { meuId: string }) {
  const [usuarios, setUsuarios]   = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(true)

  // Formulário novo usuário
  const [nome, setNome]       = useState('')
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [perfil, setPerfil]   = useState<'user' | 'admin'>('user')
  const [showSenha, setShowSenha] = useState(false)
  const [criando, setCriando] = useState(false)
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Edição inline de senha
  const [editandoSenhaId, setEditandoSenhaId] = useState<string | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const [removendoId, setRemovendoId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    border: '1px solid #333333',
    color: '#FFFFFF',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  async function carregar() {
    setCarregando(true)
    const res = await fetch('/api/usuarios')
    const json = await res.json()
    setUsuarios(json.usuarios ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function criarUsuario() {
    if (!nome.trim() || !email.trim() || !senha.trim()) return
    setCriando(true)
    setFormMsg(null)
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, perfil }),
    })
    const json = await res.json()
    if (!res.ok) {
      setFormMsg({ type: 'err', text: json.error })
    } else {
      setUsuarios(prev => [...prev, json.usuario])
      setNome(''); setEmail(''); setSenha(''); setPerfil('user')
      setFormMsg({ type: 'ok', text: 'Usuário criado com sucesso.' })
    }
    setCriando(false)
  }

  async function toggleAtivo(u: Usuario) {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, ativo: !u.ativo }),
    })
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, ativo: !x.ativo } : x))
  }

  async function alterarPerfil(u: Usuario, novoPerfil: 'user' | 'admin') {
    await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, perfil: novoPerfil }),
    })
    setUsuarios(prev => prev.map(x => x.id === u.id ? { ...x, perfil: novoPerfil } : x))
  }

  async function salvarSenha(id: string) {
    if (novaSenha.length < 6) {
      setMsg({ type: 'err', text: 'Senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setSalvandoSenha(true)
    const res = await fetch('/api/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, senha: novaSenha }),
    })
    const json = await res.json()
    setSalvandoSenha(false)
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error })
    } else {
      setMsg({ type: 'ok', text: 'Senha alterada com sucesso.' })
      setEditandoSenhaId(null)
      setNovaSenha('')
    }
  }

  async function remover(u: Usuario) {
    if (!confirm(`Remover "${u.nome}"? Esta ação não pode ser desfeita.`)) return
    setRemovendoId(u.id)
    const res = await fetch('/api/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: json.error })
    } else {
      setUsuarios(prev => prev.filter(x => x.id !== u.id))
    }
    setRemovendoId(null)
  }

  return (
    <div className="space-y-6">

      {/* Feedback global */}
      {msg && (
        <div
          className="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
          style={{
            backgroundColor: msg.type === 'ok' ? '#0F2A1A' : '#2A0F0F',
            color: msg.type === 'ok' ? '#4ADE80' : '#F87171',
            border: `1px solid ${msg.type === 'ok' ? '#4ADE8033' : '#F8717133'}`,
          }}
        >
          {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {msg.text}
          <button
            onClick={() => setMsg(null)}
            className="ml-auto"
            style={{ color: 'inherit', opacity: 0.6 }}
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Formulário — Novo Usuário */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <p className="font-semibold" style={{ color: '#FFFFFF' }}>Novo Usuário</p>
          <p className="text-xs mt-0.5" style={{ color: '#888888' }}>Crie uma conta de acesso ao sistema</p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Nome completo</label>
              <input
                type="text"
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: João Silva"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                onBlur={e => (e.target.style.borderColor = '#333333')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="joao@empresa.com"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                onBlur={e => (e.target.style.borderColor = '#333333')}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ ...inputStyle, paddingRight: '2.5rem' }}
                  onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.target.style.borderColor = '#333333')}
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: '#555555' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Perfil</label>
              <select
                value={perfil}
                onChange={e => setPerfil(e.target.value as 'user' | 'admin')}
                style={{
                  backgroundColor: '#0A0A0A',
                  border: '1px solid #333333',
                  color: '#FFFFFF',
                  borderRadius: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.875rem',
                  outline: 'none',
                  width: '100%',
                }}
                onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                onBlur={e => (e.target.style.borderColor = '#333333')}
              >
                <option value="user">Usuário — acesso padrão</option>
                <option value="admin">Admin — acesso total</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={criarUsuario}
              disabled={criando || !nome.trim() || !email.trim() || !senha.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!criando) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
            >
              {criando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar Usuário
            </button>
            {formMsg && (
              <p className="text-xs" style={{ color: formMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
                {formMsg.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Lista de usuários */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <Users className="w-4 h-4" style={{ color: '#C9A84C' }} />
          <p className="font-semibold" style={{ color: '#FFFFFF' }}>Usuários do Sistema</p>
          <span className="text-xs ml-auto" style={{ color: '#555555' }}>{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</span>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#555555' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: '#555555' }}>
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div>
            {usuarios.map(u => (
              <div
                key={u.id}
                className="px-5 py-4"
                style={{ borderBottom: '1px solid #1E1E1E' }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                      style={{ backgroundColor: '#1A1A1A', color: '#C9A84C', border: '1px solid #C9A84C33' }}
                    >
                      {u.nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{u.nome}</p>
                        {u.perfil === 'admin'
                          ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#2A1A0A', color: '#C9A84C' }}>
                              <ShieldCheck className="w-3 h-3" />Admin
                            </span>
                          : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}>
                              <User className="w-3 h-3" />Usuário
                            </span>
                        }
                        {!u.ativo && (
                          <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#2A0F0F', color: '#F87171' }}>Inativo</span>
                        )}
                        {u.id === meuId && (
                          <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#0F1A2A', color: '#60A5FA' }}>Você</span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#555555' }}>{u.email ?? '—'}</p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Trocar perfil */}
                    {u.id !== meuId && (
                      <button
                        onClick={() => alterarPerfil(u, u.perfil === 'admin' ? 'user' : 'admin')}
                        title={u.perfil === 'admin' ? 'Rebaixar para Usuário' : 'Promover para Admin'}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#888888' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.color = '#C9A84C'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.color = '#888888'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    )}
                    {/* Trocar senha */}
                    <button
                      onClick={() => {
                        setEditandoSenhaId(editandoSenhaId === u.id ? null : u.id)
                        setNovaSenha('')
                        setMsg(null)
                      }}
                      title="Alterar senha"
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: '#888888' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = '#60A5FA'
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = '#888888'
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {/* Ativar / Desativar */}
                    {u.id !== meuId && (
                      <button
                        onClick={() => toggleAtivo(u)}
                        title={u.ativo ? 'Desativar' : 'Ativar'}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#888888' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.color = '#FB923C'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.color = '#888888'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        {u.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                    )}
                    {/* Remover */}
                    {u.id !== meuId && (
                      <button
                        onClick={() => remover(u)}
                        disabled={removendoId === u.id}
                        title="Remover usuário"
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-40"
                        style={{ color: '#888888' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.color = '#F87171'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.color = '#888888'
                          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                        }}
                      >
                        {removendoId === u.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Formulário inline de nova senha */}
                {editandoSenhaId === u.id && (
                  <div className="mt-3 flex items-center gap-2" style={{ paddingLeft: '3rem' }}>
                    <input
                      type="password"
                      value={novaSenha}
                      onChange={e => setNovaSenha(e.target.value)}
                      placeholder="Nova senha (mín. 6 caracteres)"
                      className="flex-1 px-3 py-1.5 text-sm rounded-lg outline-none"
                      style={{ backgroundColor: '#0A0A0A', border: '1px solid #333333', color: '#FFFFFF' }}
                      onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                      onBlur={e => (e.target.style.borderColor = '#333333')}
                      onKeyDown={e => e.key === 'Enter' && salvarSenha(u.id)}
                    />
                    <button
                      onClick={() => salvarSenha(u.id)}
                      disabled={salvandoSenha || novaSenha.length < 6}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: '#C9A84C', color: '#000000' }}
                      onMouseEnter={e => { if (!salvandoSenha) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
                    >
                      {salvandoSenha ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Salvar
                    </button>
                    <button
                      onClick={() => { setEditandoSenhaId(null); setNovaSenha('') }}
                      className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                      style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aba ActiveCampaign ───────────────────────────────────────────────────────

function AbaActiveCampaign({
  token, onRefresh,
}: {
  token: Token | null
  onRefresh: () => void
}) {
  const supabase = createClient()
  const [apiToken, setApiToken]       = useState('')
  const [baseUrl, setBaseUrl]         = useState('')
  const [showToken, setShowToken]     = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [syncing, setSyncing]   = useState(false)
  const [syncMsg, setSyncMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [semanas, setSemanas]   = useState('')

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    border: '1px solid #333333',
    color: '#FFFFFF',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  async function salvarToken() {
    if (!apiToken.trim() || !baseUrl.trim()) return
    setSavingToken(true)
    setTokenMsg(null)
    try {
      const res = await fetch('/api/activecampaign/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apiToken.trim(), base_url: baseUrl.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setApiToken('')
      setBaseUrl('')
      setTokenMsg({ type: 'ok', text: 'Token e URL salvos com sucesso.' })
      onRefresh()
    } catch (e: unknown) {
      setTokenMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSavingToken(false)
    }
  }

  async function sincronizar() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const body: { semanas?: number[] } = {}
      if (semanas.trim()) {
        const nums = semanas.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
        if (nums.length > 0) body.semanas = nums
      }
      const res = await fetch('/api/activecampaign/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')

      // Edge function responde imediatamente com { status: 'started', jobs: [...] }
      // Fazer polling até todos os jobs terminarem
      const jobIds: string[] = json.jobs ?? []
      if (jobIds.length === 0) throw new Error('Nenhum job iniciado')

      setSyncMsg({ type: 'ok', text: `Processando ${json.semanas?.length ?? 1} semana(s) em background…` })

      const INTERVALO = 4000
      const TIMEOUT   = 30 * 60 * 1000 // 30 min máximo de polling
      const inicio    = Date.now()

      while (true) {
        await new Promise(r => setTimeout(r, INTERVALO))

        const { data: jobs } = await supabase
          .from('integration_job_runs')
          .select('id, status, records_fetched, records_inserted, records_error, error_message')
          .in('id', jobIds)

        const todos = jobs ?? []
        const pendentes = todos.filter(j => j.status === 'running')

        if (pendentes.length === 0) {
          // Todos terminaram
          const totalFetched   = todos.reduce((s, j) => s + (j.records_fetched   ?? 0), 0)
          const totalInserted  = todos.reduce((s, j) => s + (j.records_inserted  ?? 0), 0)
          const totalErros     = todos.reduce((s, j) => s + (j.records_error     ?? 0), 0)
          const temErro        = todos.some(j => j.status === 'error')
          const temPartial     = todos.some(j => j.status === 'partial')
          const msgErro        = todos.find(j => j.error_message)?.error_message

          setSyncMsg({
            type: temErro && totalFetched === 0 ? 'err' : 'ok',
            text: temErro && totalFetched === 0
              ? `Erro: ${msgErro ?? 'falha no processamento'}`
              : `Concluído${temPartial ? ' com avisos' : ''} — ${totalFetched} buscados, ${totalInserted} inseridos${totalErros > 0 ? `, ${totalErros} erros` : ''}`,
          })
          onRefresh()
          break
        }

        // Atualiza mensagem com progresso parcial
        const concluidos = todos.length - pendentes.length
        setSyncMsg({ type: 'ok', text: `Processando… ${concluidos}/${todos.length} semana(s) concluída(s)` })

        if (Date.now() - inicio > TIMEOUT) {
          setSyncMsg({ type: 'err', text: 'Timeout: o processamento está demorando mais que o esperado. Verifique o log de integrações.' })
          break
        }
      }
    } catch (e: unknown) {
      setSyncMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Token */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🔑</span>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#FFFFFF' }}>API Token</p>
              <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                Encontre em ActiveCampaign → Settings → Developer → API Access
              </p>
            </div>
            {token?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}><CheckCircle className="w-3 h-3" />Configurado</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}><XCircle className="w-3 h-3" />Não configurado</span>
            }
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {token && (
            <div className="flex items-center gap-6 text-xs pb-1" style={{ color: '#555555' }}>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Última sync: {formatData(token.last_sync_at)}</span>
              <BadgeStatus status={token.last_sync_status} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder={token ? 'Novo API token (deixe vazio para manter)' : 'Cole seu API token aqui'}
                  style={{ ...inputStyle, paddingRight: '2.5rem', fontFamily: 'monospace' }}
                  onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.target.style.borderColor = '#333333')}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: '#555555' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="URL base (ex: https://suaconta.api-us1.com)"
                style={{ ...inputStyle, fontFamily: 'monospace' }}
                onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                onBlur={e => (e.target.style.borderColor = '#333333')}
              />
              <button
                onClick={salvarToken}
                disabled={savingToken || !apiToken.trim() || !baseUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
                style={{ backgroundColor: '#C9A84C', color: '#000000' }}
                onMouseEnter={e => { if (!savingToken && apiToken.trim() && baseUrl.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              >
                {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>

          {tokenMsg && (
            <p className="text-xs" style={{ color: tokenMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {tokenMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Sincronização manual */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div>
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>Sincronização Manual — Webinário</p>
            <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
              Busca inscritos nas tags de semana do ActiveCampaign e salva no banco
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={semanas}
              onChange={e => setSemanas(e.target.value)}
              placeholder="Semanas (ex: 172,173) — vazio = últimas 5"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
            <button
              onClick={sincronizar}
              disabled={syncing || !token?.ativo}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!syncing) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              title={!token?.ativo ? 'Configure o token primeiro' : 'Sincronizar agora'}
            >
              {syncing
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sincronizar</>
              }
            </button>
          </div>

          {syncMsg && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{
                backgroundColor: syncMsg.type === 'ok' ? '#0F2A1A' : '#2A0F0F',
                color: syncMsg.type === 'ok' ? '#4ADE80' : '#F87171',
              }}
            >
              {syncMsg.type === 'ok' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
              {syncMsg.text}
            </div>
          )}

          <p className="text-xs" style={{ color: '#555555' }}>
            O processamento roda em background. Esta tela aguarda automaticamente e exibe o resultado quando terminar.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Aba Sendflow ─────────────────────────────────────────────────────────────

interface SendflowCampanha {
  id: string
  nome: string
  total_grupos: number
  total_membros: number
  ativo: boolean
  monitorada: boolean
  coletar_metricas: boolean
  synced_at: string | null
}

function AbaConfigSendflow({
  token, onRefresh,
}: {
  token: Token | null
  onRefresh: () => void
}) {
  const supabase = createClient()
  const [apiToken, setApiToken]       = useState('')
  const [baseUrl, setBaseUrl]         = useState('')
  const [showToken, setShowToken]     = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [syncingGrupos, setSyncingGrupos]     = useState(false)
  const [syncingMetricas, setSyncingMetricas] = useState(false)
  const [syncGruposMsg, setSyncGruposMsg]     = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [syncMetricasMsg, setSyncMetricasMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [campanhas, setCampanhas] = useState<SendflowCampanha[]>([])
  const [novaId, setNovaId]               = useState('')
  const [adicionando, setAdicionando]     = useState(false)
  const [addMsg, setAddMsg]               = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [removendo, setRemovendo]         = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    border: '1px solid #333333',
    color: '#FFFFFF',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  function carregarCampanhas() {
    supabase
      .from('sendflow_campanhas')
      .select('id, nome, total_grupos, total_membros, ativo, monitorada, coletar_metricas, synced_at')
      .eq('monitorada', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => setCampanhas(data ?? []))
  }

  useEffect(() => {
    carregarCampanhas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function salvarToken() {
    if (!apiToken.trim()) return
    setSavingToken(true)
    setTokenMsg(null)
    try {
      const res = await fetch('/api/sendflow/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apiToken.trim(), base_url: baseUrl.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setApiToken('')
      setBaseUrl('')
      setTokenMsg({ type: 'ok', text: 'Token salvo com sucesso.' })
      onRefresh()
    } catch (e: unknown) {
      setTokenMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSavingToken(false)
    }
  }

  async function sincronizarGrupos() {
    setSyncingGrupos(true)
    setSyncGruposMsg(null)
    try {
      const res = await fetch('/api/sendflow/sync-grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setSyncGruposMsg({ type: 'ok', text: `Concluído — ${json.grupos ?? 0} grupo${json.grupos !== 1 ? 's' : ''} sincronizados.` })
      carregarCampanhas()
      onRefresh()
    } catch (e: unknown) {
      setSyncGruposMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally {
      setSyncingGrupos(false)
    }
  }

  async function sincronizarMetricas() {
    setSyncingMetricas(true)
    setSyncMetricasMsg(null)
    try {
      const res = await fetch('/api/sendflow/sync-metricas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setSyncMetricasMsg({ type: 'ok', text: `Concluído — ${json.upserted ?? 0} registros de métricas.` })
      onRefresh()
    } catch (e: unknown) {
      setSyncMetricasMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally {
      setSyncingMetricas(false)
    }
  }

  async function adicionarCampanha() {
    if (!novaId.trim()) return
    setAdicionando(true)
    setAddMsg(null)
    try {
      const res = await fetch('/api/sendflow/campanha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: novaId.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setAddMsg({ type: 'ok', text: `Campanha "${json.nome}" adicionada.` })
      setNovaId('')
      carregarCampanhas()
    } catch (e: unknown) {
      setAddMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao adicionar.' })
    } finally {
      setAdicionando(false)
    }
  }

  async function toggleColetarMetricas(id: string, valor: boolean) {
    setCampanhas(prev => prev.map(c => c.id === id ? { ...c, coletar_metricas: valor } : c))
    try {
      const res = await fetch('/api/sendflow/campanha', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, coletar_metricas: valor }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
    } catch (e: unknown) {
      console.error('Erro ao atualizar coletar_metricas:', e)
      setCampanhas(prev => prev.map(c => c.id === id ? { ...c, coletar_metricas: !valor } : c))
    }
  }

  async function removerCampanha(id: string) {
    setRemovendo(id)
    try {
      const res = await fetch('/api/sendflow/campanha', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      carregarCampanhas()
    } catch (e: unknown) {
      console.error('Erro ao remover campanha:', e)
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Token */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🔑</span>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#FFFFFF' }}>API Token</p>
              <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                Encontre em Sendflow → Configurações → Integrações → API
              </p>
            </div>
            {token?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}><CheckCircle className="w-3 h-3" />Configurado</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}><XCircle className="w-3 h-3" />Não configurado</span>
            }
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {token && (
            <div className="flex items-center gap-6 text-xs pb-1" style={{ color: '#555555' }}>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Última sync: {formatData(token.last_sync_at)}</span>
              <BadgeStatus status={token.last_sync_status} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  placeholder={token ? 'Novo API token (deixe vazio para manter)' : 'Cole seu API token aqui'}
                  style={{ ...inputStyle, paddingRight: '2.5rem', fontFamily: 'monospace' }}
                  onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.target.style.borderColor = '#333333')}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: '#555555' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FFFFFF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={salvarToken}
                disabled={savingToken || !apiToken.trim()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
                style={{ backgroundColor: '#C9A84C', color: '#000000' }}
                onMouseEnter={e => { if (!savingToken && apiToken.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              >
                {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
            <input
              type="text"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="URL base da API (opcional — ex: https://app.sendflow.com.br/api)"
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
            />
          </div>

          {tokenMsg && (
            <p className="text-xs" style={{ color: tokenMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {tokenMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Sincronização manual */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <p className="font-semibold" style={{ color: '#FFFFFF' }}>Sincronização Manual</p>
          <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
            Campanhas/grupos sincronizam automaticamente a cada 1h
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Grupos */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Campanhas e Grupos</p>
              <p className="text-xs mt-0.5" style={{ color: '#555555' }}>Busca todas as campanhas e seus grupos na Sendflow</p>
              {syncGruposMsg && (
                <p className="text-xs mt-1" style={{ color: syncGruposMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
                  {syncGruposMsg.text}
                </p>
              )}
            </div>
            <button
              onClick={sincronizarGrupos}
              disabled={syncingGrupos || !token?.ativo}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!syncingGrupos && token?.ativo) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              title={!token?.ativo ? 'Configure o token primeiro' : 'Sincronizar agora'}
            >
              {syncingGrupos
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sync Grupos</>
              }
            </button>
          </div>

          {/* Métricas */}
          <div className="flex items-center gap-3" style={{ borderTop: '1px solid #1E1E1E', paddingTop: '1rem' }}>
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>Métricas (entradas/saídas)</p>
              <p className="text-xs mt-0.5" style={{ color: '#555555' }}>Busca dados de hoje nas campanhas com coleta ativa</p>
              {syncMetricasMsg && (
                <p className="text-xs mt-1" style={{ color: syncMetricasMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
                  {syncMetricasMsg.text}
                </p>
              )}
            </div>
            <button
              onClick={sincronizarMetricas}
              disabled={syncingMetricas || !token?.ativo}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!syncingMetricas && token?.ativo) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              title={!token?.ativo ? 'Configure o token primeiro' : 'Sincronizar métricas agora'}
            >
              {syncingMetricas
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sync Métricas</>
              }
            </button>
          </div>

        </div>
      </div>

      {/* Campanhas Monitoradas */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <p className="font-semibold" style={{ color: '#FFFFFF' }}>Campanhas Monitoradas</p>
          <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
            Somente essas campanhas serão sincronizadas automaticamente
          </p>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={novaId}
              onChange={e => setNovaId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionarCampanha()}
              placeholder="Cole o ID da campanha (ex: OEZjXU3Pish6qR8gF7fv)"
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              onFocus={e => (e.target.style.borderColor = '#C9A84C')}
              onBlur={e => (e.target.style.borderColor = '#333333')}
              disabled={!token?.ativo}
            />
            <button
              onClick={adicionarCampanha}
              disabled={adicionando || !novaId.trim() || !token?.ativo}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shrink-0"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!adicionando && novaId.trim() && token?.ativo) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              title={!token?.ativo ? 'Configure o token primeiro' : 'Adicionar campanha'}
            >
              {adicionando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </button>
          </div>

          {addMsg && (
            <p className="text-xs" style={{ color: addMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {addMsg.text}
            </p>
          )}
        </div>

        {campanhas.length === 0 ? (
          <div className="px-5 pb-6 text-center text-sm" style={{ color: '#555555' }}>
            Nenhuma campanha monitorada. Cole o ID acima para adicionar.
          </div>
        ) : (
          <div style={{ borderTop: '1px solid #1E1E1E' }}>
            {campanhas.map((c, idx) => (
              <div
                key={c.id}
                className="px-5 py-3 flex items-center gap-4"
                style={{ borderBottom: idx < campanhas.length - 1 ? '1px solid #1A1A1A' : 'none' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{c.nome}</p>
                    {c.ativo
                      ? <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>Ativa</span>
                      : <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}>Inativa</span>
                    }
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
                    <span className="font-mono">{c.id}</span>
                    {c.total_grupos > 0 && ` · ${c.total_grupos} grupo${c.total_grupos !== 1 ? 's' : ''} · ${c.total_membros.toLocaleString('pt-BR')} membros`}
                    {c.synced_at ? ` · sync ${formatData(c.synced_at)}` : ''}
                  </p>
                </div>
                {/* Toggle coletar métricas */}
                <button
                  onClick={() => toggleColetarMetricas(c.id, !c.coletar_metricas)}
                  className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: c.coletar_metricas ? '#0F2A1A' : '#1A1A1A',
                    color: c.coletar_metricas ? '#4ADE80' : '#555555',
                    border: `1px solid ${c.coletar_metricas ? '#166534' : '#333333'}`,
                  }}
                  title={c.coletar_metricas ? 'Coleta de métricas ativa — clique para desativar' : 'Clique para ativar coleta de métricas'}
                >
                  {c.coletar_metricas ? '● Métricas' : '○ Métricas'}
                </button>
                <button
                  onClick={() => removerCampanha(c.id)}
                  disabled={removendo === c.id}
                  className="shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ color: '#555555' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#F87171'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#555555'}
                  title="Remover da monitoração"
                >
                  {removendo === c.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aba Manager Guru ─────────────────────────────────────────────────────────

function AbaManagerGuru({
  token, jobs, onRefresh,
}: {
  token: Token | null
  jobs: JobRun[]
  onRefresh: () => void
}) {
  const [apiToken, setApiToken]       = useState('')
  const [showToken, setShowToken]     = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [syncing, setSyncing]         = useState(false)
  const [syncMsg, setSyncMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    border: '1px solid #333333',
    color: '#FFFFFF',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
    width: '100%',
  }

  async function salvarToken() {
    if (!apiToken.trim()) return
    setSavingToken(true)
    setTokenMsg(null)
    try {
      const res = await fetch('/api/manager-guru/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apiToken.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setApiToken('')
      setTokenMsg({ type: 'ok', text: 'Token salvo com sucesso.' })
      onRefresh()
    } catch (e: unknown) {
      setTokenMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao salvar.' })
    } finally {
      setSavingToken(false)
    }
  }

  async function sincronizar() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/manager-guru/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido')
      setSyncMsg({ type: 'ok', text: `Concluído — ${json.products ?? 0} produtos e ${json.offers ?? 0} ofertas sincronizados.` })
      onRefresh()
    } catch (e: unknown) {
      setSyncMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao sincronizar.' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Token */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🔑</span>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#FFFFFF' }}>API Token</p>
              <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                Encontre em Manager Guru → Configurações → Integrações → API
              </p>
            </div>
            {token?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}><CheckCircle className="w-3 h-3" />Configurado</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}><XCircle className="w-3 h-3" />Não configurado</span>
            }
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                placeholder="Cole o token aqui..."
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: '#555555' }}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              onClick={salvarToken}
              disabled={savingToken || !apiToken.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
            >
              {savingToken ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </button>
          </div>
          {tokenMsg && (
            <p className="text-xs" style={{ color: tokenMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {tokenMsg.text}
            </p>
          )}
          {token?.last_sync_at && (
            <p className="text-xs" style={{ color: '#555555' }}>
              Último sync: {formatData(token.last_sync_at)} · <BadgeStatus status={token.last_sync_status} />
            </p>
          )}
        </div>
      </div>

      {/* Sync Manual */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">🔄</span>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: '#FFFFFF' }}>Sincronização</p>
              <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                Sincroniza automaticamente todo dia às 03h BRT. Use o botão para sync manual.
              </p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={sincronizar}
              disabled={syncing || !token?.ativo}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #C9A84C', color: '#C9A84C' }}
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              Sync Manual
            </button>
            {!token?.ativo && (
              <p className="text-xs" style={{ color: '#555555' }}>Configure o token primeiro</p>
            )}
          </div>
          {syncMsg && (
            <p className="text-xs" style={{ color: syncMsg.type === 'ok' ? '#4ADE80' : '#F87171' }}>
              {syncMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Histórico de Jobs */}
      {jobs.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
          <div className="px-5 py-3" style={{ borderBottom: '1px solid #1E1E1E' }}>
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Histórico de Execuções</p>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {jobs.slice(0, 10).map(job => (
              <div key={job.id} className="px-5 py-3 grid grid-cols-4 gap-2 text-xs" style={{ borderBottom: '1px solid #1A1A1A' }}>
                <div style={{ color: '#888888' }}>{formatData(job.started_at)}</div>
                <div><BadgeStatus status={job.status} /></div>
                <div style={{ color: '#CCCCCC' }}>
                  {job.integration === 'manager_guru'
                    ? `${job.records_fetched ?? 0} produtos · ${job.records_inserted ?? 0} ofertas`
                    : `${job.records_fetched ?? 0} buscados · ${job.records_inserted ?? 0} salvos`
                  }
                </div>
                <div className="truncate" style={{ color: '#F87171' }}>{job.error_message ?? ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba Filtros Personalizados ───────────────────────────────────────────────

function AbaFiltrosPersonalizados() {
  const supabase = createClient()

  const [filtros,     setFiltros]     = useState<FiltroPersonalizado[]>([])
  const [carregando,  setCarregando]  = useState(true)
  const [msg,         setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [editando,    setEditando]    = useState<FiltroPersonalizado | null>(null)
  const [formAberto,  setFormAberto]  = useState(false)
  const [formNome,    setFormNome]    = useState('')
  const [formModulo,  setFormModulo]  = useState<Modulo>('trafego')
  const [formRegras,  setFormRegras]  = useState<RegraFiltro[]>([
    { campo: 'campaign_name', operador: 'contem', valor: '', ordem: 0 },
  ])
  const [salvando,    setSalvando]    = useState(false)
  const [removendoId, setRemovendoId] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0A0A0A',
    border: '1px solid #333333',
    color: '#FFFFFF',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    outline: 'none',
  }

  async function carregar() {
    setCarregando(true)
    const { data: filtrosData } = await supabase
      .from('filtros_personalizados')
      .select('id, nome, modulo, ativo, criado_por, created_at')
      .order('modulo').order('nome')

    if (!filtrosData) { setCarregando(false); return }

    const ids = filtrosData.map(f => f.id)
    const { data: regrasData } = ids.length > 0
      ? await supabase
          .from('filtros_personalizados_regras')
          .select('id, filtro_id, campo, operador, valor, ordem')
          .in('filtro_id', ids)
          .order('ordem')
      : { data: [] }

    setFiltros(filtrosData.map(f => ({
      ...f,
      regras: (regrasData ?? []).filter(r => r.filtro_id === f.id),
    })))
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function abrirCriacao() {
    setEditando(null)
    setFormNome('')
    setFormModulo('trafego')
    setFormRegras([{ campo: 'campaign_name', operador: 'contem', valor: '', ordem: 0 }])
    setFormAberto(true)
  }

  function abrirEdicao(f: FiltroPersonalizado) {
    setEditando(f)
    setFormNome(f.nome)
    setFormModulo(f.modulo as Modulo)
    setFormRegras(f.regras.length > 0
      ? f.regras.map(r => ({ ...r }))
      : [{ campo: CAMPOS_POR_MODULO[f.modulo as Modulo][0].value, operador: 'contem' as Operador, valor: '', ordem: 0 }]
    )
    setFormAberto(true)
  }

  function adicionarRegra() {
    const campoDefault = CAMPOS_POR_MODULO[formModulo][0].value
    setFormRegras(prev => [
      ...prev,
      { campo: campoDefault, operador: 'contem' as Operador, valor: '', ordem: prev.length },
    ])
  }

  function removerRegra(idx: number) {
    setFormRegras(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, ordem: i })))
  }

  function atualizarRegra(idx: number, patch: Partial<RegraFiltro>) {
    setFormRegras(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  async function salvar() {
    if (!formNome.trim()) { setMsg({ type: 'err', text: 'Informe um nome para o filtro.' }); return }
    if (formRegras.some(r => !r.valor.trim())) { setMsg({ type: 'err', text: 'Preencha o valor de todas as regras.' }); return }

    setSalvando(true)
    setMsg(null)

    try {
      if (editando) {
        const { error: errFiltro } = await supabase
          .from('filtros_personalizados')
          .update({ nome: formNome.trim(), modulo: formModulo, updated_at: new Date().toISOString() })
          .eq('id', editando.id)
        if (errFiltro) throw new Error(errFiltro.message)

        await supabase.from('filtros_personalizados_regras').delete().eq('filtro_id', editando.id)
        const { error: errRegras } = await supabase
          .from('filtros_personalizados_regras')
          .insert(formRegras.map((r, i) => ({
            filtro_id: editando.id,
            campo:     r.campo,
            operador:  r.operador,
            valor:     r.valor.trim(),
            ordem:     i,
          })))
        if (errRegras) throw new Error(errRegras.message)
        setMsg({ type: 'ok', text: 'Filtro atualizado com sucesso.' })
      } else {
        const { data: novoFiltro, error: errFiltro } = await supabase
          .from('filtros_personalizados')
          .insert({ nome: formNome.trim(), modulo: formModulo })
          .select('id')
          .single()
        if (errFiltro || !novoFiltro) throw new Error(errFiltro?.message ?? 'Erro ao criar filtro.')

        const { error: errRegras } = await supabase
          .from('filtros_personalizados_regras')
          .insert(formRegras.map((r, i) => ({
            filtro_id: novoFiltro.id,
            campo:     r.campo,
            operador:  r.operador,
            valor:     r.valor.trim(),
            ordem:     i,
          })))
        if (errRegras) throw new Error(errRegras.message)
        setMsg({ type: 'ok', text: 'Filtro criado com sucesso.' })
      }

      setFormAberto(false)
      await carregar()
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro desconhecido.' })
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id: string, nome: string) {
    if (!confirm(`Remover o filtro "${nome}"? Esta ação não pode ser desfeita.`)) return
    setRemovendoId(id)
    const { error } = await supabase.from('filtros_personalizados').delete().eq('id', id)
    if (error) {
      setMsg({ type: 'err', text: error.message })
    } else {
      setFiltros(prev => prev.filter(f => f.id !== id))
    }
    setRemovendoId(null)
  }

  async function toggleAtivo(f: FiltroPersonalizado) {
    await supabase.from('filtros_personalizados').update({ ativo: !f.ativo }).eq('id', f.id)
    setFiltros(prev => prev.map(x => x.id === f.id ? { ...x, ativo: !x.ativo } : x))
  }

  const porModulo: Record<string, FiltroPersonalizado[]> = {
    trafego: filtros.filter(f => f.modulo === 'trafego'),
    vendas:  filtros.filter(f => f.modulo === 'vendas'),
  }

  const labelModulo: Record<string, string> = {
    trafego: 'Tráfego',
    vendas:  'Vendas',
  }

  return (
    <div className="space-y-6">

      {msg && (
        <div
          className="px-4 py-3 rounded-lg text-sm flex items-center gap-2"
          style={{
            backgroundColor: msg.type === 'ok' ? '#0F2A1A' : '#2A0F0F',
            color:            msg.type === 'ok' ? '#4ADE80' : '#F87171',
            border:           `1px solid ${msg.type === 'ok' ? '#4ADE8033' : '#F8717133'}`,
          }}
        >
          {msg.type === 'ok'
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <XCircle     className="w-4 h-4 shrink-0" />
          }
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto" style={{ color: 'inherit', opacity: 0.6 }}>
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {!formAberto && (
        <div className="flex justify-end">
          <button
            onClick={abrirCriacao}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg"
            style={{ backgroundColor: '#C9A84C', color: '#000000' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
          >
            <Plus className="w-4 h-4" />
            Novo Filtro
          </button>
        </div>
      )}

      {formAberto && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
            <p className="font-semibold" style={{ color: '#FFFFFF' }}>
              {editando ? 'Editar filtro' : 'Novo filtro'}
            </p>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Nome do filtro</label>
                <input
                  type="text"
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Retargeting Brasil"
                  style={{ ...inputStyle, width: '100%' }}
                  onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.target.style.borderColor = '#333333')}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Módulo</label>
                <select
                  value={formModulo}
                  onChange={e => {
                    const m = e.target.value as Modulo
                    setFormModulo(m)
                    setFormRegras([{ campo: CAMPOS_POR_MODULO[m][0].value, operador: 'contem', valor: '', ordem: 0 }])
                  }}
                  style={{ ...inputStyle, width: '100%' }}
                  onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.target.style.borderColor = '#333333')}
                >
                  <option value="trafego">Tráfego</option>
                  <option value="vendas">Vendas</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#888888' }}>Regras</p>

              {formRegras.map((regra, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <select
                    value={regra.campo}
                    onChange={e => atualizarRegra(idx, { campo: e.target.value })}
                    style={{ ...inputStyle, flex: '1', minWidth: '160px' }}
                    onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                    onBlur={e => (e.target.style.borderColor = '#333333')}
                  >
                    {CAMPOS_POR_MODULO[formModulo].map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>

                  <select
                    value={regra.operador}
                    onChange={e => atualizarRegra(idx, { operador: e.target.value as Operador })}
                    style={{ ...inputStyle, width: '140px' }}
                    onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                    onBlur={e => (e.target.style.borderColor = '#333333')}
                  >
                    {OPERADORES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={regra.valor}
                    onChange={e => atualizarRegra(idx, { valor: e.target.value })}
                    placeholder="Valor..."
                    style={{ ...inputStyle, flex: '1', minWidth: '140px' }}
                    onFocus={e => (e.target.style.borderColor = '#C9A84C')}
                    onBlur={e => (e.target.style.borderColor = '#333333')}
                  />

                  {formRegras.length > 1 && (
                    <button
                      onClick={() => removerRegra(idx)}
                      className="p-1.5 rounded-lg shrink-0"
                      style={{ color: '#888888' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.color = '#F87171'
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.color = '#888888'
                        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={adicionarRegra}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ color: '#888888', border: '1px solid #333333', backgroundColor: 'transparent' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                  ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#888888'
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar regra
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#C9A84C', color: '#000000' }}
                onMouseEnter={e => { if (!salvando) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editando ? 'Salvar alterações' : 'Criar filtro'}
              </button>
              <button
                onClick={() => setFormAberto(false)}
                className="px-4 py-2 text-sm rounded-lg"
                style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#555555' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando filtros...</span>
        </div>
      ) : filtros.length === 0 ? (
        <div
          className="rounded-xl border-dashed flex flex-col items-center justify-center py-16"
          style={{ border: '1px dashed #222222' }}
        >
          <p className="text-sm" style={{ color: '#555555' }}>Nenhum filtro criado ainda.</p>
          <p className="text-xs mt-1" style={{ color: '#444444' }}>Clique em &quot;Novo Filtro&quot; para começar.</p>
        </div>
      ) : (
        Object.entries(porModulo).map(([mod, lista]) =>
          lista.length === 0 ? null : (
            <div key={mod} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#111111', border: '1px solid #222222' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E1E1E' }}>
                <p className="font-semibold" style={{ color: '#FFFFFF' }}>{labelModulo[mod]}</p>
                <p className="text-xs mt-0.5" style={{ color: '#555555' }}>{lista.length} filtro{lista.length !== 1 ? 's' : ''}</p>
              </div>

              <div>
                {lista.map(f => (
                  <div key={f.id} className="px-5 py-4" style={{ borderBottom: '1px solid #1A1A1A' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{f.nome}</p>
                          {f.ativo
                            ? <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#0F2A1A', color: '#4ADE80' }}>Ativo</span>
                            : <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#1A1A1A', color: '#888888' }}>Inativo</span>
                          }
                        </div>

                        <div className="mt-2 space-y-1">
                          {f.regras.map((r, i) => {
                            const campoLabel = CAMPOS_POR_MODULO[f.modulo as Modulo]?.find(c => c.value === r.campo)?.label ?? r.campo
                            const opLabel    = OPERADORES.find(o => o.value === r.operador)?.label ?? r.operador
                            return (
                              <p key={i} className="text-xs" style={{ color: '#555555' }}>
                                <span style={{ color: '#888888' }}>{campoLabel}</span>
                                {' '}<span style={{ color: '#C9A84C' }}>{opLabel}</span>
                                {' '}<span style={{ color: '#FFFFFF' }}>&quot;{r.valor}&quot;</span>
                                {i < f.regras.length - 1 && <span style={{ color: '#444444' }}> + AND</span>}
                              </p>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => abrirEdicao(f)}
                          title="Editar"
                          className="p-1.5 rounded-lg"
                          style={{ color: '#888888' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = '#C9A84C'
                            ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = '#888888'
                            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                          }}
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleAtivo(f)}
                          title={f.ativo ? 'Desativar' : 'Ativar'}
                          className="p-1.5 rounded-lg"
                          style={{ color: '#888888' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = '#FB923C'
                            ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = '#888888'
                            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                          }}
                        >
                          {f.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => remover(f.id, f.nome)}
                          disabled={removendoId === f.id}
                          title="Remover"
                          className="p-1.5 rounded-lg disabled:opacity-40"
                          style={{ color: '#888888' }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = '#F87171'
                            ;(e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = '#888888'
                            ;(e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                          }}
                        >
                          {removendoId === f.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2  className="w-4 h-4" />
                          }
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConfiguracoesClient({ inicial, meuId }: { inicial: DadosConfiguracao; meuId: string }) {
  const supabase = createClient()
  const [aba, setAba] = useState<Aba>('integracoes')
  const [dados, setDados] = useState<DadosConfiguracao>(inicial)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date())
  const [, startTransition] = useTransition()

  const buscarDados = useCallback(async () => {
    startTransition(async () => {
      const [
        { data: tokens },
        { data: jobs },
        ...rest
      ] = await Promise.all([
        supabase.from('integration_tokens').select('integration, ativo, last_sync_at, last_sync_status, expires_at'),
        supabase.from('integration_job_runs')
          .select('id, integration, account_id, status, started_at, finished_at, records_fetched, records_inserted, records_error, error_message')
          .order('started_at', { ascending: false }).limit(500),
        supabase.from('raw_vendas').select('id', { count: 'exact', head: true })
          .eq('processed', false).not('error', 'is', null),
        supabase.from('meta_ad_accounts')
          .select('id, account_id, nome, ativo, last_sync_at, last_sync_status')
          .order('nome'),
        supabase.from('integration_tokens')
          .select('expires_at, ativo, last_sync_at, last_sync_status')
          .eq('integration', 'meta_ads').maybeSingle(),
      ])

      const webhookErros = [{
        tabela: 'raw_vendas',
        count: (rest[0] as { count: number | null }).count ?? 0,
      }]

      setDados({
        tokens:        tokens ?? [],
        jobs:          jobs ?? [],
        webhookErros,
        metaAccounts:  (rest[1] as { data: MetaAccount[] | null }).data ?? [],
        metaToken:     (rest[2] as { data: MetaToken | null }).data ?? null,
      })
      setUltimaAtualizacao(new Date())
    })
  }, [supabase])

  useEffect(() => {
    const id = setInterval(buscarDados, 60_000)
    return () => clearInterval(id)
  }, [buscarDados])

  async function reprocessar(tabela: string) {
    const res = await fetch('/api/reprocessar-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabela }),
    })
    if (res.ok) await buscarDados()
  }

  function jobsDe(integration: string): JobRun[] {
    return dados.jobs.filter(j => j.integration === integration)
  }

  const abas: { key: Aba; label: string }[] = [
    { key: 'integracoes',    label: 'Integrações' },
    { key: 'manager_guru',   label: 'Manager Guru' },
    { key: 'meta_ads',       label: 'Meta Ads' },
    { key: 'activecampaign', label: 'ActiveCampaign' },
    { key: 'sendflow',       label: 'Sendflow' },
    { key: 'usuarios',       label: 'Usuários' },
    { key: 'filtros',        label: 'Filtros Personalizados' },
  ]

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold" style={{ color: '#FFFFFF' }}>Configurações</h2>
          <p className="text-xs mt-0.5" style={{ color: '#555555' }}>
            <span suppressHydrationWarning>
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {' '}· polling 60s
          </p>
        </div>
        <button
          onClick={buscarDados}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A'
            ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = '#888888'
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex" style={{ borderBottom: '1px solid #1E1E1E' }}>
        {abas.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
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

      {/* Conteúdo das abas */}
      {aba === 'integracoes' && (
        <div className="space-y-3">
          {INTEGRACOES.map(integracao => (
            <CardIntegracao
              key={integracao.key}
              integracao={integracao}
              token={dados.tokens.find(t => t.integration === integracao.key)}
              jobs={jobsDe(integracao.key)}
              metaAccounts={integracao.key === 'meta_ads' ? dados.metaAccounts : undefined}
            />
          ))}
          <CardWebhooksErro webhookErros={dados.webhookErros} onReprocessar={reprocessar} />
        </div>
      )}

      {aba === 'meta_ads' && (
        <AbaMetaAds
          metaToken={dados.metaToken}
          metaAccounts={dados.metaAccounts}
          onRefresh={buscarDados}
        />
      )}

      {aba === 'activecampaign' && (
        <AbaActiveCampaign
          token={dados.tokens.find(t => t.integration === 'activecampaign') ?? null}
          onRefresh={buscarDados}
        />
      )}

      {aba === 'manager_guru' && (
        <AbaManagerGuru
          token={dados.tokens.find(t => t.integration === 'manager_guru') ?? null}
          jobs={jobsDe('manager_guru')}
          onRefresh={buscarDados}
        />
      )}

      {aba === 'sendflow' && (
        <AbaConfigSendflow
          token={dados.tokens.find(t => t.integration === 'sendflow') ?? null}
          onRefresh={buscarDados}
        />
      )}

      {aba === 'usuarios' && (
        <AbaUsuarios meuId={meuId} />
      )}

      {aba === 'filtros' && (
        <AbaFiltrosPersonalizados />
      )}
    </div>
  )
}
