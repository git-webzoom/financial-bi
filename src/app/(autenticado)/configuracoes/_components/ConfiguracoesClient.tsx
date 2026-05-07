'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatData } from '@/lib/format'
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RefreshCw, Loader2,
  Plus, Trash2, Eye, EyeOff, Save, Zap, Users, ShieldCheck, User,
} from 'lucide-react'

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
  { tabela: 'raw_vendas',     label: 'Manager Guru — Vendas' },
  { tabela: 'raw_webnario',   label: 'Webinários' },
  { tabela: 'raw_grupos_wpp', label: 'Grupos WhatsApp' },
]

type Aba = 'integracoes' | 'meta_ads' | 'activecampaign' | 'usuarios'

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

function CardWebhooksErro({
  webhookErros, onReprocessar,
}: {
  webhookErros: WebhookErro[]
  onReprocessar: (tabela: string) => Promise<void>
}) {
  const [reprocessando, setReprocessando] = useState<string | null>(null)
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
      </div>
      <div>
        {WEBHOOK_TABELAS.map(({ tabela, label }) => {
          const count = webhookErros.find(w => w.tabela === tabela)?.count ?? 0
          const loading = reprocessando === tabela
          return (
            <div
              key={tabela}
              className="px-5 py-3 flex items-center justify-between gap-4"
              style={{ borderBottom: '1px solid #1E1E1E' }}
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
              <button
                onClick={async () => { setReprocessando(tabela); await onReprocessar(tabela); setReprocessando(null) }}
                disabled={count === 0 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ border: '1px solid #333333', color: '#888888', backgroundColor: 'transparent' }}
                onMouseEnter={e => { if (count > 0 && !loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1A1A' }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
              >
                {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Reprocessando…</> : <><RefreshCw className="w-3.5 h-3.5" />Reprocessar</>}
              </button>
            </div>
          )
        })}
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

  const [syncing, setSyncing]       = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncAllMsg, setSyncAllMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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

      const { data } = await supabase
        .from('meta_ad_accounts')
        .select('id, account_id, nome, ativo, last_sync_at, last_sync_status')
        .order('nome')
      if (data) setAccounts(data)

      const erros = json.records_error ?? 0
      setSyncAllMsg({
        type: erros > 0 ? 'err' : 'ok',
        text: `Concluído — ${json.records_fetched ?? 0} registros buscados, ${json.records_inserted ?? 0} inseridos${erros > 0 ? `, ${erros} erros` : ''}.`,
      })
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
              onClick={sincronizarTudo}
              disabled={syncingAll || syncing !== null || accounts.filter(a => a.ativo).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!syncingAll) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#C9A84C'}
              title="Sincroniza todas as contas ativas (últimos 2 dias)"
            >
              {syncingAll
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sync Geral</>
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
                    disabled={syncing === acc.account_id || syncingAll}
                    title={syncingAll ? 'Sync geral em andamento…' : 'Sincronizar esta conta agora'}
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
  const [apiToken, setApiToken]       = useState('')
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
    if (!apiToken.trim()) return
    setSavingToken(true)
    setTokenMsg(null)
    try {
      const res = await fetch('/api/activecampaign/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apiToken.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setApiToken('')
      setTokenMsg({ type: 'ok', text: 'Token salvo com sucesso.' })
      onRefresh()
    } catch (e: unknown) {
      setTokenMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao salvar token.' })
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
      const erros = json.records_error ?? 0
      setSyncMsg({
        type: erros > 0 ? 'err' : 'ok',
        text: `Concluído — ${json.records_fetched ?? 0} buscados, ${json.records_inserted ?? 0} inseridos${erros > 0 ? `, ${erros} erros` : ''}.`,
      })
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

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={e => setApiToken(e.target.value)}
                placeholder={token ? 'Novo token (deixe vazio para manter o atual)' : 'Cole seu API token aqui'}
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
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: '#C9A84C', color: '#000000' }}
              onMouseEnter={e => { if (!savingToken && apiToken.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = '#E2C06A' }}
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
            A sincronização pode levar alguns minutos dependendo do número de contatos. O resultado aparecerá acima quando concluir.
          </p>
        </div>
      </div>
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
        ...['raw_vendas', 'raw_webnario', 'raw_grupos_wpp'].map(t =>
          supabase.from(t as 'raw_vendas').select('id', { count: 'exact', head: true })
            .eq('processed', false).not('error', 'is', null)
        ),
        supabase.from('meta_ad_accounts')
          .select('id, account_id, nome, ativo, last_sync_at, last_sync_status')
          .order('nome'),
        supabase.from('integration_tokens')
          .select('expires_at, ativo, last_sync_at, last_sync_status')
          .eq('integration', 'meta_ads').maybeSingle(),
      ])

      const webhookErros = ['raw_vendas', 'raw_webnario', 'raw_grupos_wpp'].map((t, i) => ({
        tabela: t,
        count: (rest[i] as { count: number | null }).count ?? 0,
      }))

      setDados({
        tokens:        tokens ?? [],
        jobs:          jobs ?? [],
        webhookErros,
        metaAccounts:  (rest[3] as { data: MetaAccount[] | null }).data ?? [],
        metaToken:     (rest[4] as { data: MetaToken | null }).data ?? null,
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
    { key: 'integracoes',     label: 'Integrações' },
    { key: 'meta_ads',        label: 'Meta Ads' },
    { key: 'activecampaign',  label: 'ActiveCampaign' },
    { key: 'usuarios',        label: 'Usuários' },
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

      {aba === 'usuarios' && (
        <AbaUsuarios meuId={meuId} />
      )}
    </div>
  )
}
