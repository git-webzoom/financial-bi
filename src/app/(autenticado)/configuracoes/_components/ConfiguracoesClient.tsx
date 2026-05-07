'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatData } from '@/lib/format'
import {
  CheckCircle, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, Loader2,
  Plus, Trash2, Eye, EyeOff, Save, Zap,
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

type Aba = 'integracoes' | 'meta_ads'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasParaVencer(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

function BadgeStatus({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">Nunca executou</span>
  const map: Record<string, { cls: string; label: string }> = {
    success: { cls: 'bg-green-100 text-green-700',   label: 'Sucesso' },
    error:   { cls: 'bg-red-100 text-red-700',       label: 'Erro' },
    running: { cls: 'bg-blue-100 text-blue-700',     label: 'Executando' },
    pending: { cls: 'bg-yellow-100 text-yellow-700', label: 'Pendente' },
  }
  const cfg = map[status] ?? { cls: 'bg-gray-100 text-gray-600', label: status }
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Aba Integrações ──────────────────────────────────────────────────────────

function JobRunLinha({ job, metaAccounts }: { job: JobRun; metaAccounts?: MetaAccount[] }) {
  const nomeConta = job.account_id && metaAccounts
    ? (metaAccounts.find(a => a.account_id === job.account_id)?.nome ?? `act_${job.account_id}`)
    : null

  return (
    <div className="grid grid-cols-5 gap-2 py-2 border-b border-gray-50 last:border-0 text-xs">
      <div className="col-span-2">
        <span className="text-gray-500">{formatData(job.started_at)}</span>
        {nomeConta && <p className="text-gray-400 truncate mt-0.5">{nomeConta}</p>}
      </div>
      <BadgeStatus status={job.status} />
      <span className="text-gray-700 text-center">{job.records_fetched ?? '—'} / {job.records_inserted ?? '—'}</span>
      <span className="text-red-500 truncate">{job.error_message ?? ''}</span>
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
  const dias = diasParaVencer(token?.expires_at ?? null)
  const alertaToken = integracao.key === 'meta_ads' && dias !== null && dias < 7

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center gap-4">
        <span className="text-2xl">{integracao.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-800">{integracao.label}</p>
            {token?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Ativo</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircle className="w-3 h-3" />Inativo</span>
            }
            {alertaToken && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                <AlertTriangle className="w-3 h-3" />Token vence em {dias}d
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Última sync: {formatData(token?.last_sync_at ?? null)}
            </span>
            <BadgeStatus status={token?.last_sync_status ?? null} />
          </div>
        </div>
        <button
          onClick={() => setAberto(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
        >
          {aberto ? <><ChevronUp className="w-4 h-4" />Ocultar logs</> : <><ChevronDown className="w-4 h-4" />Ver logs</>}
        </button>
      </div>

      {aberto && (
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
          {jobs.length === 0
            ? <p className="text-xs text-gray-400 py-2">Nenhuma execução registrada.</p>
            : <>
                <div className="grid grid-cols-5 gap-2 pb-1 text-xs font-medium text-gray-400">
                  <span className="col-span-2">Início</span>
                  <span>Status</span>
                  <span className="text-center">Buscados / Inseridos</span>
                  <span>Erro</span>
                </div>
                {jobs.map(j => <JobRunLinha key={j.id} job={j} metaAccounts={metaAccounts} />)}
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <p className="font-semibold text-gray-800">Webhooks com Falha</p>
        {totalErros > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{totalErros}</span>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {WEBHOOK_TABELAS.map(({ tabela, label }) => {
          const count = webhookErros.find(w => w.tabela === tabela)?.count ?? 0
          const loading = reprocessando === tabela
          return (
            <div key={tabela} className="px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {count === 0
                    ? 'Nenhuma falha'
                    : <span className="text-red-600 font-medium">{count} webhook{count > 1 ? 's' : ''} com erro</span>
                  }
                </p>
              </div>
              <button
                onClick={async () => { setReprocessando(tabela); await onReprocessar(tabela); setReprocessando(null) }}
                disabled={count === 0 || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
  metaToken,
  metaAccounts,
  onRefresh,
}: {
  metaToken: MetaToken | null
  metaAccounts: MetaAccount[]
  onRefresh: () => void
}) {
  const supabase = createClient()

  // Token form
  const [token, setToken]         = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [savingToken, setSavingToken] = useState(false)
  const [tokenMsg, setTokenMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Contas form
  const [accounts, setAccounts]   = useState<MetaAccount[]>(metaAccounts)
  useEffect(() => { setAccounts(metaAccounts) }, [metaAccounts])
  const [novoNome, setNovoNome]   = useState('')
  const [novoId, setNovoId]       = useState('')
  const [addingAccount, setAddingAccount] = useState(false)
  const [accountMsg, setAccountMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Sync manual individual
  const [syncing, setSyncing]     = useState<string | null>(null)

  // Sync geral
  const [syncingAll, setSyncingAll]   = useState(false)
  const [syncAllMsg, setSyncAllMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const dias = diasParaVencer(metaToken?.expires_at ?? null)

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
    // Normaliza: remove "act_" se o usuário digitou
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
      if (data) {
        setAccounts(prev => prev.map(a => a.account_id === accountId ? data : a))
      }
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

      // Rebusca status de todas as contas
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔑</span>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">Access Token</p>
              <p className="text-xs text-gray-400 mt-0.5">
                User Token ou System User Token do Meta Business Manager
              </p>
            </div>
            {metaToken?.ativo
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Configurado</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><XCircle className="w-3 h-3" />Não configurado</span>
            }
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Alerta de expiração */}
          {dias !== null && dias < 14 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${dias < 7 ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {dias <= 0 ? 'Token expirado!' : `Token vence em ${dias} dia${dias !== 1 ? 's' : ''}.`} Atualize abaixo.
            </div>
          )}

          {metaToken && (
            <div className="flex items-center gap-6 text-xs text-gray-500 pb-1">
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
                className="w-full pr-10 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <input
              type="date"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
              title="Data de expiração do token"
            />
            <button
              onClick={salvarToken}
              disabled={savingToken || !token.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#1E3A5F' }}
            >
              {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          </div>

          {tokenMsg && (
            <p className={`text-xs ${tokenMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {tokenMsg.text}
            </p>
          )}
        </div>
      </div>

      {/* Contas de anúncio */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800">Contas de Anúncio</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Adicione as contas que deseja sincronizar. O ID está no formato <code className="bg-gray-100 px-1 rounded">act_123456789</code>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-400">{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</span>
            <button
              onClick={sincronizarTudo}
              disabled={syncingAll || syncing !== null || accounts.filter(a => a.ativo).length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#1E3A5F' }}
              title="Sincroniza todas as contas ativas sequencialmente (28 dias)"
            >
              {syncingAll
                ? <><Loader2 className="w-4 h-4 animate-spin" />Sincronizando…</>
                : <><RefreshCw className="w-4 h-4" />Sync Geral</>
              }
            </button>
          </div>
        </div>

        {/* Feedback sync geral */}
        {syncAllMsg && (
          <div className={`px-5 py-2 text-xs border-b border-gray-100 flex items-center gap-2 ${syncAllMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {syncAllMsg.type === 'ok' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
            {syncAllMsg.text}
          </div>
        )}

        {/* Formulário adicionar */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              placeholder="Nome da conta (ex: Financial Move BR)"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <input
              type="text"
              value={novoId}
              onChange={e => setNovoId(e.target.value)}
              placeholder="ID (ex: act_123456789)"
              className="w-52 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
              onKeyDown={e => e.key === 'Enter' && adicionarConta()}
            />
            <button
              onClick={adicionarConta}
              disabled={addingAccount || !novoNome.trim() || !novoId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: '#1E3A5F' }}
            >
              {addingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Adicionar
            </button>
          </div>
          {accountMsg && (
            <p className={`text-xs mt-2 ${accountMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
              {accountMsg.text}
            </p>
          )}
        </div>

        {/* Lista de contas */}
        {accounts.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Nenhuma conta cadastrada. Adicione acima.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {accounts.map(acc => (
              <div key={acc.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{acc.nome}</p>
                    {acc.ativo
                      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">Ativa</span>
                      : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-500">Inativa</span>
                    }
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400 font-mono">act_{acc.account_id}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
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
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-colors"
                  >
                    {syncing === acc.account_id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Zap className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={() => toggleAtivo(acc.id, acc.ativo)}
                    title={acc.ativo ? 'Desativar' : 'Ativar'}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                  >
                    {acc.ativo ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => removerConta(acc.id)}
                    title="Remover conta"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConfiguracoesClient({ inicial }: { inicial: DadosConfiguracao }) {
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
          .order('started_at', { ascending: false }).limit(50),
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
    return dados.jobs.filter(j => j.integration === integration).slice(0, 10)
  }

  const abas: { key: Aba; label: string }[] = [
    { key: 'integracoes', label: 'Integrações' },
    { key: 'meta_ads',    label: 'Meta Ads' },
  ]

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Configurações</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            <span suppressHydrationWarning>
              Atualizado às {ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {' '}· polling 60s
          </p>
        </div>
        <button
          onClick={buscarDados}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />Atualizar
        </button>
      </div>

      {/* Abas */}
      <div className="flex border-b border-gray-200">
        {abas.map(a => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              aba === a.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
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
    </div>
  )
}
